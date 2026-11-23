import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsReview, brandsMentioned, checklistComplete, SHOP_CHECKLIST, CALL_GUIDE, canAddProduct, NEW_SELLER } from '../src/market/review.js';
import { checkApplicationPhotos } from '../src/market/validate.js';
import { categoryLabel, isLive } from '../src/market/catalog.js';

const live = { title: 'Tee', description: 'Cotton tee', category: 'clothing', subcategory: 'Tops & tees', photos: ['a.jpg'], price_cents: 1000, stock: 3, hidden: false };

test('changing what shoppers read or see, or the price, needs review; stock and hiding do not', () => {
  assert.equal(needsReview(null, live), true);
  assert.equal(needsReview(live, { ...live, stock: 0, hidden: true }), false);
  for (const change of [{ price_cents: 900 }, { title: 'Tee 2' }, { description: 'New' }, { category: 'sport' }, { subcategory: 'Activewear' }, { photos: ['b.jpg'] }, { photos: ['a.jpg', 'b.jpg'] }]) {
    assert.equal(needsReview(live, { ...live, ...change }), true, JSON.stringify(change));
  }
});

test('big-brand names are flagged for the reviewer', () => {
  assert.deepEqual(brandsMentioned('Nike Air Max style runner', ''), ['nike']);
  assert.deepEqual(brandsMentioned('Kasi runner', 'Like Adidas Superstars, LV print bag'), ['adidas', 'lv']);
  assert.deepEqual(brandsMentioned('Township Runner', 'Handmade in Soweto'), []);
  assert.deepEqual(brandsMentioned('Pumas'), ['puma']);
  assert.deepEqual(brandsMentioned('Pumpkin candle', 'Pumpkin spice'), []);
});

test('a shop is approved only with every check ticked, and the call guide asks the 3 questions', () => {
  assert.equal(checklistComplete({}), false);
  const all = Object.fromEntries(SHOP_CHECKLIST.map((c) => [c.id, true]));
  assert.equal(checklistComplete(all), true);
  assert.equal(checklistComplete({ ...all, phone_call: false }), false);
  assert.equal(CALL_GUIDE.length, 3);
  assert.match(CALL_GUIDE.join(' '), /sell.*make it or buy it.*courier/s);
});

test('the application needs an ID photo, a selfie with the ID and a stock photo', () => {
  const photo = { name: 'a.jpg', type: 'image/jpeg', size: 1000 };
  assert.equal(checkApplicationPhotos({ idPhoto: photo, selfie: photo, stockPhoto: photo }).ok, true);
  const missing = checkApplicationPhotos({ idPhoto: photo });
  assert.deepEqual(Object.keys(missing.errors).sort(), ['selfie', 'stockPhoto']);
  assert.match(checkApplicationPhotos({ idPhoto: { name: 'id.pdf', type: 'application/pdf', size: 10 }, selfie: photo, stockPhoto: photo }).errors.idPhoto, /not a photo/);
});

test('new sellers: up to 20 products (rejected ones do not count)', () => {
  const many = Array.from({ length: 20 }, () => ({ status: 'pending' }));
  assert.deepEqual(canAddProduct(many.slice(0, 19)), { ok: true, used: 19, max: 20 });
  assert.equal(canAddProduct(many).ok, false);
  assert.equal(canAddProduct([...many.slice(1), { status: 'rejected' }]).ok, true);
  assert.equal(canAddProduct(many, { established: true }).ok, true);
  assert.equal(NEW_SELLER.maxSalesCents, 500000);
  assert.equal(NEW_SELLER.trackedCourierOnly, true);
});

test('labels and who sees a product', () => {
  assert.equal(categoryLabel({ category: 'clothing', subcategory: 'Dresses' }), 'Clothing · Dresses');
  assert.equal(categoryLabel({ category: 'other', subcategory: 'Keyrings' }), 'Keyrings');
  const shop = { status: 'approved' };
  assert.equal(isLive({ status: 'approved', hidden: false, shop }), true);
  assert.equal(isLive({ status: 'pending', hidden: false, shop }), false);
  assert.equal(isLive({ status: 'rejected', hidden: false, shop }), false);
  assert.equal(isLive({ status: 'approved', hidden: false, shop: { status: 'pending' } }), false);
});

import { clampOffset, zoomLimits } from '../src/market/cropper.js';

test('the cropper keeps the square covered when zoomed in, and centres the whole photo when zoomed out', () => {
  const limits = zoomLimits(4000, 3000, 400);
  assert.equal(limits.min, 0.1);        // whole photo: 400 px wide
  assert.ok(Math.abs(limits.cover - 400 / 3000) < 1e-9); // fills the square
  // Zoomed in: cannot drag past the edges.
  assert.deepEqual(clampOffset({ x: 50, y: 10 }, 533, 400, 400), { x: 0, y: 0 });
  assert.deepEqual(clampOffset({ x: -500, y: -5 }, 533, 400, 400), { x: -133, y: 0 });
  // Zoomed out: centred, with white around it.
  assert.deepEqual(clampOffset({ x: -999, y: 999 }, 400, 300, 400), { x: 0, y: 50 });
});
