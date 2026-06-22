// Vercel serverless function: nhận đơn từ form web Skin Night → tạo đơn trong Pancake POS (shop Vikora Group)
// API key lấy từ biến môi trường POS_API_KEY (không hard-code, không lộ ra client).

const SHOP_ID = '20100144';
// variation_id của sản phẩm "Skin Night Cream" trong POS Vikora. Lấy bằng lệnh tạm ?admin=list rồi điền vào đây.
const VARIATION_ID = 'REPLACE_ME';
const API_BASE = 'https://pos.pages.fm/api/v1';
const TMP_TOKEN = 'ba12-tmp-7x9k'; // token tạm cho lệnh quản trị, sẽ xóa sau khi lấy variation_id

module.exports = async (req, res) => {
  const key = process.env.POS_API_KEY;

  // ===== LỆNH TẠM: liệt kê sản phẩm để lấy variation_id (sẽ xóa) =====
  if (req.method === 'GET') {
    if (req.query && req.query.admin === 'list' && req.query.t === TMP_TOKEN) {
      if (!key) { res.status(200).json({ ok: false, error: 'no_key' }); return; }
      try {
        const r = await fetch(API_BASE + '/shops/' + SHOP_ID + '/products?api_key=' + encodeURIComponent(key) + '&page_size=100&page_number=1');
        const d = await r.json().catch(() => ({}));
        const list = (d.data || []).map(p => ({
          name: p.name,
          variations: (p.variations || p.product_variations || []).map(v => ({ id: v.id, retail_price: v.retail_price, fields: v.fields || v.name }))
        }));
        res.status(200).json({ ok: true, count: list.length, products: list });
      } catch (e) { res.status(200).json({ ok: false, error: 'list_exception' }); }
      return;
    }
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const qty = Math.max(1, parseInt(body.qty, 10) || 1);
    const name = ((body.fullname || '') + '').trim().slice(0, 200) || 'Khách web';
    const phone = ((body.phone || '') + '').trim().slice(0, 30);
    const address = ((body.address || '') + '').trim().slice(0, 500);
    const email = ((body.email || '') + '').trim().slice(0, 120);
    const product = ((body.product || 'Skin Night Cream') + '').trim().slice(0, 200);
    const total = Math.max(0, parseInt(body.total, 10) || 0);

    if (!key) { res.status(200).json({ ok: false, error: 'no_key' }); return; }

    // POS theo GIÁ TRÊN TRANG: gửi đơn giá (total/qty) qua variation_info.retail_price.
    const unit = (total > 0) ? Math.round(total / qty) : 0;
    const item = { variation_id: VARIATION_ID, quantity: qty };
    if (unit > 0) { item.variation_info = { retail_price: unit }; }

    const order = {
      items: [item],
      bill_full_name: name,
      bill_phone_number: phone,
      shipping_address: { full_name: name, phone_number: phone, address: address },
      note: 'Đơn từ web kemnam.ba12days.com | SP: ' + product + (email ? (' | Email: ' + email) : ''),
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
