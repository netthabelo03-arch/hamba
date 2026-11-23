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
  const tee = await market.saveProduct(shop.id, null, { title: 'Venda print tee', description: 'Cotton tee, S to XL.', category: 'fashion', price_cents: 35000, stock: 5, photos: [] });
  assert.equal((await market.listProducts({ q: 'venda' })).length, 0);
  assert.equal(await market.getProduct(tee.id, 'someone-else'), null);
  assert.equal((await market.getProduct(tee.id, 'u1')).title, 'Venda print tee'); // the owner can still see it
  await market.setShopStatus(shop.id, 'approved');
  assert.equal((await market.listProducts({ q: 'venda' })).length, 1);
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
