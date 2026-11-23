import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRand, parseRand, centsToInput, sellerShare, DELIVERY_FEE_CENTS } from '../src/market/money.js';
import { filterProducts, cleanFilters, noResultsMessage, CATEGORIES } from '../src/market/catalog.js';
import { addToBag, setQty, removeFromBag, priceBag, bagCount, readBag, writeBag } from '../src/market/bag.js';
import { checkShop, checkProduct, checkPhotoFile, checkDelivery } from '../src/market/validate.js';

const NBSP = ' ';

test('prices show as South African rand', () => {
  assert.equal(formatRand(89900), 'R899.00');
  assert.equal(formatRand(123456), `R1${NBSP}234.56`);
  assert.equal(formatRand(5), 'R0.05');
  assert.equal(formatRand(-8000), '-R80.00');
});

test('typed prices become cents; anything else is refused', () => {
  const cases = { '899': 89900, '899.5': 89950, '899,50': 89950, 'R 899': 89900, '1 299': 129900, ' 0.99 ': 99 };
  for (const [typed, cents] of Object.entries(cases)) assert.equal(parseRand(typed), cents, typed);
  for (const bad of ['', 'abc', '8.999', '-5', '1e3', '12.']) assert.equal(parseRand(bad), null, bad);
  assert.equal(centsToInput(89950), '899.50');
});

test('sellers keep 86% of the price after the 14% commission', () => {
  assert.equal(sellerShare(100000), 86000);
  assert.equal(sellerShare(89900), 89900 - 12586);
});

const shopA = { id: 'a', name: 'Kasi Kicks', city: 'Soweto', status: 'approved' };
const shopB = { id: 'b', name: 'Run Jozi', city: 'Johannesburg', status: 'approved' };
const pending = { id: 'p', name: 'New Shop', status: 'pending' };
const products = [
  { id: '1', title: 'Township Runner', description: 'Black running shoe', category: 'sneakers', price_cents: 89900, stock: 5, hidden: false, created_at: '2026-11-20', shop: shopA },
  { id: '2', title: 'Quick-dry tee', description: 'Running tee', category: 'sport', price_cents: 32900, stock: 0, hidden: false, created_at: '2026-11-22', shop: shopB },
  { id: '3', title: 'Hidden cap', description: 'Cap', category: 'fashion', price_cents: 19900, stock: 3, hidden: true, created_at: '2026-11-23', shop: shopB },
  { id: '4', title: 'Pending sneaker', description: 'Shoe', category: 'sneakers', price_cents: 50000, stock: 3, hidden: false, created_at: '2026-11-23', shop: pending },
  { id: '5', title: 'Soweto slides', description: 'Pool slides', category: 'sneakers', price_cents: 24900, stock: 2, hidden: false, created_at: '2026-11-21', shop: shopA },
];

test('hidden products and pending shops never show', () => {
  assert.deepEqual(filterProducts(products, {}).map((p) => p.id), ['2', '5', '1']);
});

test('search, category, price range and sorting all apply', () => {
  assert.deepEqual(filterProducts(products, { q: 'running' }).map((p) => p.id), ['2', '1']);
  assert.deepEqual(filterProducts(products, { q: 'soweto' }).map((p) => p.id), ['5', '1']);
  assert.deepEqual(filterProducts(products, { category: 'sneakers', sort: 'price-low' }).map((p) => p.id), ['5', '1']);
  assert.deepEqual(filterProducts(products, { min: 30000, sort: 'price-high' }).map((p) => p.id), ['1', '2']);
  assert.deepEqual(cleanFilters({ min: 500, max: 100, category: 'cars', sort: 'x' }), { q: '', category: '', min: 100, max: 500, sort: 'new' });
  assert.equal(CATEGORIES.length, 6);
});

test('an empty result explains what to try', () => {
  assert.match(noResultsMessage({ q: 'boat', category: 'beauty' }), /"boat", Beauty/);
  assert.match(noResultsMessage({}), /No products yet/);
});

test('the bag never holds more than the stock', () => {
  const runner = products[0];
  let r = addToBag([], runner, 3);
  assert.deepEqual(r.items, [{ productId: '1', qty: 3 }]);
  r = addToBag(r.items, runner, 4);
  assert.equal(r.added, 2);
  assert.deepEqual(r.items, [{ productId: '1', qty: 5 }]);
  r = addToBag(r.items, runner, 1);
  assert.equal(r.added, 0);
  assert.equal(r.limit, 5);
  assert.deepEqual(setQty(r.items, runner, 9), [{ productId: '1', qty: 5 }]);
  assert.deepEqual(setQty(r.items, runner, 0), []);
  assert.deepEqual(removeFromBag(r.items, '1'), []);
  assert.equal(addToBag([], products[1], 1).added, 0); // sold out
});

test('delivery is charged once per shop, and totals add up', () => {
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [{ productId: '1', qty: 2 }, { productId: '5', qty: 1 }, { productId: '2', qty: 1 }, { productId: '3', qty: 1 }];
  const bag = priceBag(items, byId);
  assert.equal(bag.groups.length, 1);
  assert.equal(bag.subtotal, 2 * 89900 + 24900);
  assert.equal(bag.delivery, DELIVERY_FEE_CENTS);
  assert.equal(bag.total, 2 * 89900 + 24900 + 8000);
  assert.deepEqual(bag.problems.map((p) => [p.productId, p.reason]), [['2', 'sold-out'], ['3', 'gone']]);
  const two = priceBag([{ productId: '1', qty: 1 }, { productId: '2', qty: 1 }], new Map(byId).set('2', { ...products[1], stock: 4 }));
  assert.equal(two.groups.length, 2);
  assert.equal(two.delivery, 2 * DELIVERY_FEE_CENTS);
  assert.equal(two.count, 2);
});

test('stock that dropped after adding is flagged and capped', () => {
  const byId = new Map([['1', { ...products[0], stock: 1 }]]);
  const bag = priceBag([{ productId: '1', qty: 3 }], byId);
  assert.equal(bag.groups[0].lines[0].qty, 1);
  assert.match(bag.problems[0].text, /Only 1 left/);
});

test('the bag is saved on the phone', () => {
  const data = new Map();
  const s = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  writeBag([{ productId: '1', qty: 2 }, { productId: 'x', qty: 0 }], s);
  assert.deepEqual(readBag(s), [{ productId: '1', qty: 2 }]);
  assert.equal(bagCount(readBag(s)), 2);
  data.set('hamba.bag.v1', 'not json');
  assert.deepEqual(readBag(s), []);
});

test('shop details are checked', () => {
  const good = checkShop({ name: ' Kasi  Kicks ', about: 'Hand-finished sneakers made in Soweto.', city: 'Soweto', phone: '082 123 4567' });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, { name: 'Kasi Kicks', about: 'Hand-finished sneakers made in Soweto.', city: 'Soweto', phone: '+27821234567' });
  assert.deepEqual(Object.keys(checkShop({ name: 'K', about: 'short', city: '', phone: '011' }).errors).sort(), ['about', 'city', 'name', 'phone']);
});

test('product price and stock are checked', () => {
  const good = checkProduct({ title: 'Township Runner', description: 'Sizes 5 to 11, black and pink.', category: 'sneakers', price: '899', stock: '12' });
  assert.equal(good.ok, true);
  assert.equal(good.value.price_cents, 89900);
  assert.equal(good.value.stock, 12);
  const bad = checkProduct({ title: 'X', description: '', category: 'cars', price: '2', stock: '-1' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['category', 'description', 'price', 'stock', 'title']);
  assert.match(checkProduct({ ...good.value, title: 'Shoe', description: 'A nice shoe for you', price: 'abc', stock: '1.5' }).errors.price, /in rand/);
  assert.equal(checkProduct({ title: 'Shoe', description: 'A nice shoe for you', category: 'sneakers', price: '10', stock: '0' }).ok, true);
});

test('only JPG, PNG and WebP photos up to 8 MB are accepted', () => {
  assert.equal(checkPhotoFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }), null);
  assert.match(checkPhotoFile({ name: 'price.pdf', type: 'application/pdf', size: 1000 }), /not a photo/);
  assert.match(checkPhotoFile({ name: 'a.gif', type: 'image/gif', size: 1000 }), /not a photo/);
  assert.match(checkPhotoFile({ name: 'big.png', type: 'image/png', size: 9 * 1024 * 1024 }), /bigger than 8 MB/);
});

test('every delivery field is required', () => {
  const good = { name: 'Lerato M', phone: '0821234567', street: '12 Vilakazi St', suburb: 'Orlando West', city: 'Soweto', postalCode: '1804', province: 'Gauteng' };
  assert.equal(checkDelivery(good).ok, true);
  assert.equal(checkDelivery(good).value.phone, '+27821234567');
  const empty = checkDelivery({});
  assert.deepEqual(Object.keys(empty.errors).sort(), ['city', 'name', 'phone', 'postalCode', 'province', 'street', 'suburb']);
  assert.ok(checkDelivery({ ...good, postalCode: '18044' }).errors.postalCode);
});
