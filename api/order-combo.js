// Vercel serverless function: nhận đơn COMBO "mua 2 kem nám tặng 1 chống nắng" từ trang /mua2tang1.html
// → tạo đơn trong Pancake POS (shop Vikora Group) với 2 dòng hàng: 2 hũ Skin Night (498k/hũ) + 1 tuýp Love The Sun (0đ, quà tặng).
// API key lấy từ biến môi trường POS_API_KEY (không hard-code, không lộ ra client).

const SHOP_ID = '20100144';
const VAR_NIGHT = '3e984a57-7007-47ae-adc5-4200aa0070a0'; // Skin Night Cream (kem nám đêm) 20g
const VAR_SUN   = 'c860bf5b-a592-4ef8-83b1-387803a1fb6a'; // Kem chống nắng Love The Sun SPF50+ PA+++ 40ml
const UNIT_NIGHT = 498000;  // đơn giá kem đêm trong combo
const API_BASE = 'https://pos.pages.fm/api/v1';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    // sets = số BỘ khách đặt (1 bộ = 2 hũ kem đêm + 1 tuýp chống nắng tặng)
    const sets = Math.max(1, parseInt(body.sets, 10) || 1);
    const name = ((body.fullname || '') + '').trim().slice(0, 200) || 'Khách web';
    const phone = ((body.phone || '') + '').trim().slice(0, 30);
    const address = ((body.address || '') + '').trim().slice(0, 500);
    const email = ((body.email || '') + '').trim().slice(0, 120);
    const total = Math.max(0, parseInt(body.total, 10) || (sets * 2 * UNIT_NIGHT));

    const key = process.env.POS_API_KEY;
    if (!key) { res.status(200).json({ ok: false, error: 'no_key' }); return; }

    const items = [
      { variation_id: VAR_NIGHT, quantity: sets * 2, variation_info: { retail_price: UNIT_NIGHT } },
      { variation_id: VAR_SUN,   quantity: sets,     variation_info: { retail_price: 0 } }
    ];

    const order = {
      items: items,
      bill_full_name: name,
      bill_phone_number: phone,
      shipping_address: { full_name: name, phone_number: phone, address: address },
      note: 'Đơn COMBO mua 2 tặng 1 từ web kemnam.ba12days.com/mua2tang1.html'
        + ' | ' + sets + ' bộ (mỗi bộ: 2 Skin Night Cream + TẶNG 1 Love The Sun 40g giá 0đ)'
        + ' | TỔNG THU: ' + total.toLocaleString('vi-VN') + 'đ'
        + (email ? (' | Email: ' + email) : ''),
      status: 0
    };

    const r = await fetch(API_BASE + '/shops/' + SHOP_ID + '/orders?api_key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    const data = await r.json().catch(() => ({}));

    if (data && data.success) {
      res.status(200).json({ ok: true, id: (data.data && data.data.id) || null });
    } else {
      res.status(200).json({ ok: false, error: 'pos_failed' });
    }
  } catch (e) {
    res.status(200).json({ ok: false, error: 'exception' });
  }
};
