// Sample shops and products for demo mode, so browsing, the bag and checkout
// can be tried before real sellers join. Pictures are simple drawings in the
// style of the Hamba screens. Clearly marked as sample data on screen.

function svg(body) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#d4d4d1"/><rect y="120" width="200" height="80" fill="#c2c2be"/>${body}</svg>`)}`;
}

const SHOE = (fill, stripe) => svg(`<ellipse cx="104" cy="160" rx="66" ry="7" fill="#9b9b97"/><polygon points="38,133 46,96 73,91 93,73 116,80 144,109 169,122 167,142 38,142" fill="${fill}" stroke="#0d0d0d" stroke-width="3"/><rect x="36" y="142" width="135" height="13" fill="#f2f2f2" stroke="#0d0d0d" stroke-width="3"/><rect x="36" y="148" width="135" height="3" fill="${stripe}"/>`);
const TEE = (fill, stripe) => svg(`<ellipse cx="100" cy="160" rx="56" ry="6" fill="#9b9b97"/><polygon points="73,44 89,40 100,49 111,40 127,44 156,64 142,82 131,76 131,153 69,153 69,76 58,82 44,64" fill="${fill}" stroke="#0d0d0d" stroke-width="3"/><rect x="69" y="142" width="62" height="5" fill="${stripe}"/>`);
const JAR = (fill, lid) => svg(`<ellipse cx="100" cy="160" rx="44" ry="6" fill="#9b9b97"/><rect x="66" y="78" width="68" height="78" rx="12" fill="${fill}" stroke="#0d0d0d" stroke-width="3"/><rect x="72" y="60" width="56" height="22" rx="5" fill="${lid}" stroke="#0d0d0d" stroke-width="3"/><rect x="78" y="104" width="44" height="22" rx="3" fill="#f2f2f2"/>`);
const CAP = (fill, peak) => svg(`<ellipse cx="100" cy="150" rx="60" ry="6" fill="#9b9b97"/><path d="M48 128 Q52 70 100 68 Q148 70 150 128 Z" fill="${fill}" stroke="#0d0d0d" stroke-width="3"/><path d="M120 126 Q168 124 178 138 L118 140 Z" fill="${peak}" stroke="#0d0d0d" stroke-width="3"/>`);
const BASKET = (fill, band) => svg(`<ellipse cx="100" cy="160" rx="62" ry="7" fill="#9b9b97"/><path d="M44 84 L156 84 L142 156 L58 156 Z" fill="${fill}" stroke="#0d0d0d" stroke-width="3"/><rect x="50" y="106" width="100" height="10" fill="${band}"/><rect x="54" y="128" width="92" height="8" fill="#0d0d0d"/>`);

export const SAMPLE_SHOPS = [
  { id: 'shop-kasi', owner_id: 'sample', name: 'Kasi Kicks', about: 'Hand-finished sneakers and slides, made in Soweto.', city: 'Soweto', phone: '+27821110001', status: 'approved', created_at: '2026-11-01T08:00:00Z' },
  { id: 'shop-runjozi', owner_id: 'sample', name: 'Run Jozi', about: 'Running kit for Joburg streets: quick-dry tees, caps and reflective gear.', city: 'Johannesburg', phone: '+27821110002', status: 'approved', created_at: '2026-11-02T08:00:00Z' },
  { id: 'shop-glow', owner_id: 'sample', name: 'Glow Durban', about: 'Small-batch shea butter, body oils and lip balm from Durban.', city: 'Durban', phone: '+27821110003', status: 'approved', created_at: '2026-11-03T08:00:00Z' },
  { id: 'shop-weave', owner_id: 'sample', name: 'Ilala Weave', about: 'Woven ilala palm baskets and homeware from KwaZulu-Natal.', city: 'Eshowe', phone: '+27821110004', status: 'approved', created_at: '2026-11-04T08:00:00Z' },
];

const P = (id, shop_id, title, category, rands, stock, photo, day, description) => ({
  id, shop_id, title, category, price_cents: rands * 100, stock, photos: [photo], hidden: false,
  created_at: `2026-11-${String(day).padStart(2, '0')}T09:00:00Z`, description,
});

export const SAMPLE_PRODUCTS = [
  P('p-runner', 'shop-kasi', 'Township Runner', 'sneakers', 899, 6, SHOE('#1f1f1f', '#ff2e88'), 22, 'Black runner with a pink stripe. Sizes 4 to 11. Cushioned sole for tar and gravel.'),
  P('p-white', 'shop-kasi', 'Vilakazi Low, white', 'sneakers', 1199, 3, SHOE('#f2f2f2', '#0d0d0d'), 19, 'Clean white leather low-top. Sizes 5 to 10.'),
  P('p-slides', 'shop-kasi', 'Kasi slides', 'sneakers', 249, 12, SHOE('#ff2e88', '#0d0d0d'), 12, 'Pink pool slides with a soft footbed. Sizes 4 to 12.'),
  P('p-tee', 'shop-runjozi', 'Quick-dry running tee', 'sport', 329, 20, TEE('#1f1f1f', '#ff2e88'), 21, 'Light, quick-dry tee for hot Joburg runs. S to XXL.'),
  P('p-tee-pink', 'shop-runjozi', 'Night run tee, reflective', 'sport', 389, 0, TEE('#ff2e88', '#f2f2f2'), 15, 'Pink tee with reflective print for early-morning runs. Back in stock soon.'),
  P('p-cap', 'shop-runjozi', 'Run Jozi cap', 'fashion', 199, 15, CAP('#1f1f1f', '#ff2e88'), 18, 'Breathable running cap, one size, adjustable.'),
  P('p-shea', 'shop-glow', 'Whipped shea butter', 'beauty', 145, 30, JAR('#f6e7d0', '#ff2e88'), 20, '250 ml whipped shea butter with coconut oil. For skin and hair.'),
  P('p-oil', 'shop-glow', 'Marula body oil', 'beauty', 185, 8, JAR('#e8c36a', '#1f1f1f'), 14, '100 ml cold-pressed marula oil.'),
  P('p-basket', 'shop-weave', 'Ilala palm basket', 'home', 450, 4, BASKET('#d9b36c', '#ff2e88'), 17, 'Hand-woven ilala palm basket, about 30 cm wide. Each one is different.'),
  P('p-bowl', 'shop-weave', 'Woven fruit bowl', 'crafts', 320, 2, BASKET('#c99b52', '#1f1f1f'), 10, 'Small woven bowl, about 22 cm wide.'),
];
