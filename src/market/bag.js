// The bag: what a shopper wants to buy, kept on this phone until checkout.
// Items from several shops can share one bag; each shop charges delivery once.

import { DELIVERY_FEE_CENTS } from './money.js';
import { isLive } from './catalog.js';

const KEY = 'hamba.bag.v1';
export const MAX_PER_ITEM = 10;

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @returns {{ productId: string, qty: number }[]} */
export function readBag(s = store()) {
  try {
    const items = JSON.parse(s?.getItem(KEY) ?? '[]');
    return Array.isArray(items) ? items.filter((i) => typeof i?.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function writeBag(items, s = store()) {
  s?.setItem(KEY, JSON.stringify(items));
  globalThis.dispatchEvent?.(new Event('hamba:bag'));
}

export function bagCount(items = readBag()) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

/**
 * Add a product, never beyond its stock (or 10 of one thing).
 * @returns {{ items: object[], added: number, limit: number }} limit is the most allowed
 */
export function addToBag(items, product, qty = 1) {
  const limit = Math.min(product.stock, MAX_PER_ITEM);
  const current = items.find((i) => i.productId === product.id)?.qty ?? 0;
  const next = Math.min(current + qty, limit);
  const added = Math.max(0, next - current);
  if (added === 0) return { items, added, limit };
  const others = items.filter((i) => i.productId !== product.id);
  return { items: current ? items.map((i) => (i.productId === product.id ? { ...i, qty: next } : i)) : [...others, { productId: product.id, qty: next }], added, limit };
}

/** Change how many; 0 removes it. Never beyond stock. */
export function setQty(items, product, qty) {
  const limit = Math.min(product?.stock ?? 0, MAX_PER_ITEM);
  const next = Math.max(0, Math.min(Math.floor(qty), limit));
  if (next === 0) return items.filter((i) => i.productId !== product.id);
  return items.map((i) => (i.productId === product.id ? { ...i, qty: next } : i));
}

export function removeFromBag(items, productId) {
  return items.filter((i) => i.productId !== productId);
}

/**
 * The bag worked out per shop, with what can and cannot be bought now.
 * @param {{ productId: string, qty: number }[]} items
 * @param {Map<string, object>} products by id, each with { price_cents, stock, hidden, shop: { id, name, status } }
 */
export function priceBag(items, products) {
  const shops = new Map();
  const problems = [];
  for (const item of items) {
    const product = products.get(item.productId);
    if (!isLive(product)) {
      problems.push({ productId: item.productId, reason: 'gone', text: 'No longer available' });
      continue;
    }
    if (product.stock === 0) {
      problems.push({ productId: item.productId, reason: 'sold-out', text: 'Sold out', product });
      continue;
    }
    const qty = Math.min(item.qty, product.stock, MAX_PER_ITEM);
    if (qty < item.qty) problems.push({ productId: item.productId, reason: 'less-stock', text: `Only ${product.stock} left, so your bag has ${qty}`, product });
    const shopId = product.shop.id;
    if (!shops.has(shopId)) shops.set(shopId, { shop: product.shop, lines: [], subtotal: 0, delivery: DELIVERY_FEE_CENTS });
    const group = shops.get(shopId);
    const lineTotal = product.price_cents * qty;
    group.lines.push({ product, qty, lineTotal });
    group.subtotal += lineTotal;
  }
  const groups = [...shops.values()];
  const subtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const delivery = groups.reduce((sum, g) => sum + g.delivery, 0);
  return { groups, problems, subtotal, delivery, total: subtotal + delivery, count: groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.qty, 0), 0) };
}
