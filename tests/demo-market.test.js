import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoMarket, photoUrl } from '../src/market/api.js';

function memory() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('demo shops are there to browse, newest first', async () => {
  const market = createDemoMarket(memory());
  const all = await market.listProducts({});
  assert.ok(all.length >= 8);
  assert.equal(all[0].title, 'Township Runner');
  assert.ok(all.every((p) => p.shop.status === 'approved'));
  assert.deepEqual((await market.listProducts({ category: 'beauty', sort: 'price-low' })).map((p) => p.title), ['Whipped shea butter', 'Marula body oil']);
});

test('a new shop waits for approval and its products stay hidden until then', async () => {
  const market = createDemoMarket(memory());
  const shop = await market.openShop('u1', { name: 'Thendo Threads', about: 'Bold prints on cotton tees.', city: 'Thohoyandou', phone: '+27821234567' });
  assert.equal(shop.status, 'pending');
  await assert.rejects(market.openShop('u1', { name: 'Again' }), { code: '23505' });
  const tee = await market.saveProduct(shop.id, null, { title: 'Venda print tee', description: 'Cotton tee, S to XL.', category: 'clothing', subcategory: 'Tops & tees', price_cents: 35000, stock: 5, photos: [] });
  assert.equal(tee.status, 'pending');
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0);
  assert.equal(await market.getProduct(tee.id, 'someone-else'), null);
  assert.equal((await market.getProduct(tee.id, 'u1')).title, 'Venda print tee'); // the owner can still see it
  await market.setShopStatus(shop.id, 'approved');
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0, 'the product itself still waits for review');
  await market.reviewProduct(tee.id, 'approved', '');
  assert.equal((await market.listProducts({ q: 'venda' })).length, 1);
  await market.saveProduct(shop.id, tee.id, { price_cents: 30000, stock: 4 });
  assert.equal((await market.listProducts({ q: 'venda' })).length, 1, 'a new price does not need review');
  await market.saveProduct(shop.id, tee.id, { title: 'Venda print tee, new design' });
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0, 'a new name goes back for review');
  await assert.rejects(market.reviewProduct(tee.id, 'rejected', ''), { code: '22023' });
  await market.reviewProduct(tee.id, 'approved', '');
  await market.setHidden(tee.id, true);
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0);
  assert.equal((await market.shopProducts(shop.id)).length, 1);
  await market.setHidden(tee.id, false);
  await market.setShopStatus(shop.id, 'suspended');
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0);
});

test('sellers can only edit their own shop’s products', async () => {
  const market = createDemoMarket(memory());
  await assert.rejects(market.saveProduct('shop-mine', 'p-runner', { price_cents: 100 }), { code: 42501 });
});

test('delivery details are remembered per person', async () => {
  const market = createDemoMarket(memory());
  assert.equal(await market.getDelivery('u1'), null);
  await market.saveDelivery('u1', { name: 'Lerato', city: 'Soweto' });
  assert.deepEqual(await market.getDelivery('u1'), { name: 'Lerato', city: 'Soweto' });
  assert.equal(await market.getDelivery('u2'), null);
});

test('photo paths become addresses; drawings and full addresses pass through', () => {
  assert.equal(photoUrl('data:image/png;base64,xx'), 'data:image/png;base64,xx');
  assert.equal(photoUrl(''), '');
  assert.match(photoUrl('shop-1/a b.jpg'), /\/storage\/v1\/object\/public\/product-photos\/shop-1\/a%20b\.jpg$/);
});

test('new sellers can list up to 20 products', async () => {
  const market = createDemoMarket(memory());
  const shop = await market.openShop('u9', { name: 'Many Things', about: 'A shop with lots of products.', city: 'Pretoria', phone: '+27821234567' });
  for (let i = 0; i < 20; i += 1) await market.saveProduct(shop.id, null, { title: `Thing ${i}`, description: 'A thing for testing.', category: 'other', subcategory: 'Things', price_cents: 1000, stock: 1, photos: [] });
  await assert.rejects(market.saveProduct(shop.id, null, { title: 'One more', description: 'A thing for testing.', category: 'other', subcategory: 'Things', price_cents: 1000, stock: 1, photos: [] }), { code: 'P0001' });
  const [first] = await market.shopProducts(shop.id);
  await market.reviewProduct(first.id, 'rejected', 'Photo is blurry');
  await market.saveProduct(shop.id, null, { title: 'One more', description: 'A thing for testing.', category: 'other', subcategory: 'Things', price_cents: 1000, stock: 1, photos: [] });
});

test('seller checks: admins see the photos, and they are deleted once the shop is decided', async () => {
  const store = memory();
  const market = createDemoMarket(store);
  const shop = await market.openShop('u5', { name: 'Check Me', about: 'A shop that sends its checks.', city: 'Polokwane', phone: '+27821234567' });
  // Photos are shrunk in a browser, so this test puts the stored checks in directly.
  const data = JSON.parse(store.getItem('hamba.market.v1'));
  data.checks = { [shop.id]: { shop_id: shop.id, owner_id: 'u5', id_photo: 'data:x;1', selfie: 'data:x;2', stock_photo: 'data:x;3', checklist: {}, call_notes: '' } };
  store.setItem('hamba.market.v1', JSON.stringify(data));
  const checks = await market.getChecks(shop.id);
  assert.equal(checks.urls.selfie, 'data:x;2');
  await market.saveCheckProgress(shop.id, { checklist: { phone_call: true }, callNotes: 'Sells beadwork, makes it at home, Pargo for parcels.' });
  await market.decideShop(shop.id, 'approved', 'admin-1');
  const after = await market.getChecks(shop.id);
  assert.deepEqual([after.id_photo, after.selfie, after.stock_photo], [null, null, null]);
  assert.equal(after.decided_by, 'admin-1');
  assert.match(after.call_notes, /beadwork/);
  assert.ok(after.documents_deleted_at);
  assert.equal((await market.myShop('u5')).status, 'approved');
});
