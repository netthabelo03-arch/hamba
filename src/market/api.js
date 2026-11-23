// Shops, products, photos and delivery details: everything the marketplace
// screens need. Uses Supabase once config.js is filled in, and sample shops
// kept in this browser (demo mode) until then. Functions throw on failure;
// screens show friendlyAuthError(error).

import { getClient } from '../auth/client.js';
import { isConfigured, SUPABASE_URL } from '../config.js';
import { filterProducts, cleanFilters } from './catalog.js';
import { SAMPLE_SHOPS, SAMPLE_PRODUCTS } from './seed.js';
import { shrinkPhoto, blobToDataUrl } from './photos.js';

const BUCKET = 'product-photos';
const SHOP_COLUMNS = 'id, owner_id, name, about, city, phone, status, created_at';
const PRODUCT_COLUMNS = `id, shop_id, title, description, category, price_cents, stock, photos, hidden, created_at, shop:shops!inner(${SHOP_COLUMNS})`;

/** A saved photo path as an address the browser can show. */
export function photoUrl(path) {
  if (typeof path !== 'string' || path === '') return '';
  if (path.startsWith('data:') || path.startsWith('https://')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// ---------------------------------------------------------------- Supabase

const supabaseMarket = {
  async listProducts(filters, limit = 60) {
    const f = cleanFilters(filters);
    const client = await getClient();
    let query = client.from('products').select(PRODUCT_COLUMNS).eq('hidden', false).eq('shop.status', 'approved');
    if (f.category) query = query.eq('category', f.category);
    if (f.min !== null) query = query.gte('price_cents', f.min);
    if (f.max !== null) query = query.lte('price_cents', f.max);
    for (const word of f.q.split(/\s+/).filter(Boolean)) {
      const safe = word.replace(/[%_,().*\\]/g, '');
      if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    if (f.sort === 'price-low') query = query.order('price_cents', { ascending: true });
    else if (f.sort === 'price-high') query = query.order('price_cents', { ascending: false });
    query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async getProduct(id) {
    const client = await getClient();
    const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async getProducts(ids) {
    if (ids.length === 0) return [];
    const client = await getClient();
    const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).in('id', ids);
    if (error) throw error;
    return data;
  },
  async myShop(userId) {
    const client = await getClient();
    const { data, error } = await client.from('shops').select(SHOP_COLUMNS).eq('owner_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async openShop(userId, shop) {
    const client = await getClient();
    const { data, error } = await client.from('shops').insert({ owner_id: userId, ...shop }).select(SHOP_COLUMNS).single();
    if (error) throw error;
    return data;
  },
  async updateShop(shopId, shop) {
    const client = await getClient();
    const { data, error } = await client.from('shops').update(shop).eq('id', shopId).select(SHOP_COLUMNS).single();
    if (error) throw error;
    return data;
  },
  async shopProducts(shopId) {
    const client = await getClient();
    const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('shop_id', shopId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async uploadPhoto(shopId, file) {
    const client = await getClient();
    const blob = await shrinkPhoto(file);
    const path = `${shopId}/${crypto.randomUUID()}.jpg`;
    const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    return path;
  },
  async saveProduct(shopId, productId, product) {
    const client = await getClient();
    const request = productId
      ? client.from('products').update(product).eq('id', productId)
      : client.from('products').insert({ shop_id: shopId, ...product });
    const { data, error } = await request.select(PRODUCT_COLUMNS).single();
    if (error) throw error;
    return data;
  },
  async setHidden(productId, hidden) {
    const client = await getClient();
    const { error } = await client.from('products').update({ hidden }).eq('id', productId);
    if (error) throw error;
  },
  async allShops() {
    const client = await getClient();
    const { data, error } = await client.from('shops').select(SHOP_COLUMNS).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async setShopStatus(shopId, status) {
    const client = await getClient();
    const { error } = await client.rpc('set_shop_status', { shop_id: shopId, new_status: status });
    if (error) throw error;
  },
  async getDelivery(userId) {
    const client = await getClient();
    const { data, error } = await client.from('profiles').select('delivery').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data?.delivery ?? null;
  },
  async saveDelivery(userId, delivery) {
    const client = await getClient();
    const { error } = await client.from('profiles').update({ delivery }).eq('id', userId);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------- Demo

const DEMO_KEY = 'hamba.market.v1';

function memoryStore() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

function pickStore() {
  try {
    const s = globalThis.localStorage;
    s.setItem('hamba.test', '1');
    s.removeItem('hamba.test');
    return s;
  } catch {
    return memoryStore();
  }
}

/** @param {Storage} [store] where to keep the demo shops (tests pass their own) */
export function createDemoMarket(store = pickStore()) {
  function load() {
    try {
      const data = JSON.parse(store.getItem(DEMO_KEY) ?? 'null');
      if (data && Array.isArray(data.shops) && Array.isArray(data.products)) return data;
    } catch { /* start again */ }
    return { shops: structuredClone(SAMPLE_SHOPS), products: structuredClone(SAMPLE_PRODUCTS), delivery: {} };
  }
  function save(data) {
    try {
      store.setItem(DEMO_KEY, JSON.stringify(data));
    } catch {
      throw { code: 'demo_full', message: 'This browser has no room left for more demo photos.' };
    }
  }
  function withShop(data, product) {
    return product ? { ...product, shop: data.shops.find((s) => s.id === product.shop_id) ?? null } : null;
  }
  function visible(product) {
    return product && !product.hidden && product.shop?.status === 'approved';
  }
  const now = () => new Date().toISOString();

  return {
    async listProducts(filters, limit = 60) {
      const data = load();
      return filterProducts(data.products.map((p) => withShop(data, p)), filters).slice(0, limit);
    },
    async getProduct(id, viewerId = null) {
      const data = load();
      const product = withShop(data, data.products.find((p) => p.id === id));
      return visible(product) || (product && product.shop?.owner_id === viewerId) ? product : null;
    },
    async getProducts(ids) {
      const data = load();
      return data.products.filter((p) => ids.includes(p.id)).map((p) => withShop(data, p));
    },
    async myShop(userId) {
      return load().shops.find((s) => s.owner_id === userId) ?? null;
    },
    async openShop(userId, shop) {
      const data = load();
      if (data.shops.some((s) => s.owner_id === userId)) throw { code: '23505', message: 'You already have a shop.' };
      const created = { id: `shop-${crypto.randomUUID()}`, owner_id: userId, ...shop, status: 'pending', created_at: now() };
      data.shops.push(created);
      save(data);
      return created;
    },
    async updateShop(shopId, shop) {
      const data = load();
      const found = data.shops.find((s) => s.id === shopId);
      Object.assign(found, shop);
      save(data);
      return found;
    },
    async shopProducts(shopId) {
      const data = load();
      return data.products.filter((p) => p.shop_id === shopId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => withShop(data, p));
    },
    async uploadPhoto(_shopId, file) {
      // Smaller than real uploads, so a few fit in the browser's storage.
      return blobToDataUrl(await shrinkPhoto(file, 640, 0.72));
    },
    async saveProduct(shopId, productId, product) {
      const data = load();
      let saved;
      if (productId) {
        saved = data.products.find((p) => p.id === productId && p.shop_id === shopId);
        if (!saved) throw { code: 42501 };
        Object.assign(saved, product);
      } else {
        saved = { id: `p-${crypto.randomUUID()}`, shop_id: shopId, hidden: false, created_at: now(), ...product };
        data.products.push(saved);
      }
      save(data);
      return withShop(data, saved);
    },
    async setHidden(productId, hidden) {
      const data = load();
      data.products.find((p) => p.id === productId).hidden = hidden;
      save(data);
    },
    async allShops() {
      return load().shops.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async setShopStatus(shopId, status) {
      const data = load();
      data.shops.find((s) => s.id === shopId).status = status;
      save(data);
    },
    async getDelivery(userId) {
      return load().delivery?.[userId] ?? null;
    },
    async saveDelivery(userId, delivery) {
      const data = load();
      data.delivery = { ...(data.delivery ?? {}), [userId]: delivery };
      save(data);
    },
  };
}

// ---------------------------------------------------------------- Public

let backend = null;
function use() {
  if (backend === null) backend = isConfigured() ? supabaseMarket : createDemoMarket();
  return backend;
}

export const listProducts = (filters, limit) => use().listProducts(filters, limit);
export const getProduct = (id, viewerId) => use().getProduct(id, viewerId);
/** @returns {Promise<Map<string, object>>} the products by id (missing ones are left out) */
export async function getProductsById(ids) {
  const list = await use().getProducts([...new Set(ids)]);
  return new Map(list.map((p) => [p.id, p]));
}
export const myShop = (userId) => use().myShop(userId);
export const openShop = (userId, shop) => use().openShop(userId, shop);
export const updateShop = (shopId, shop) => use().updateShop(shopId, shop);
export const shopProducts = (shopId) => use().shopProducts(shopId);
export const uploadPhoto = (shopId, file) => use().uploadPhoto(shopId, file);
export const saveProduct = (shopId, productId, product) => use().saveProduct(shopId, productId, product);
export const setHidden = (productId, hidden) => use().setHidden(productId, hidden);
export const allShops = () => use().allShops();
export const setShopStatus = (shopId, status) => use().setShopStatus(shopId, status);
export const getDelivery = (userId) => use().getDelivery(userId);
export const saveDelivery = (userId, delivery) => use().saveDelivery(userId, delivery);
