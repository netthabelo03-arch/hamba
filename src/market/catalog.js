// Categories, and the search, filter and sort rules for browsing products.
// The demo shops use filterProducts directly; the Supabase query follows the same rules.

export const CATEGORIES = [
  { id: 'sneakers', name: 'Sneakers' },
  { id: 'fashion', name: 'Fashion' },
  { id: 'sport', name: 'Sport' },
  { id: 'beauty', name: 'Beauty' },
  { id: 'home', name: 'Home' },
  { id: 'crafts', name: 'Crafts' },
];

export const SORTS = [
  { id: 'new', name: 'Newest' },
  { id: 'price-low', name: 'Price: low to high' },
  { id: 'price-high', name: 'Price: high to low' },
];

export function isCategory(id) {
  return CATEGORIES.some((c) => c.id === id);
}

export function categoryName(id) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? '';
}

/** Tidy filters from the screen: unknown values are dropped. */
export function cleanFilters({ q = '', category = '', min = null, max = null, sort = 'new' } = {}) {
  const lo = Number.isInteger(min) && min >= 0 ? min : null;
  const hi = Number.isInteger(max) && max >= 0 ? max : null;
  return {
    q: String(q).trim().slice(0, 60),
    category: isCategory(category) ? category : '',
    min: lo !== null && hi !== null && lo > hi ? hi : lo,
    max: lo !== null && hi !== null && lo > hi ? lo : hi,
    sort: SORTS.some((s) => s.id === sort) ? sort : 'new',
  };
}

/** Words in the search must all appear in the title, description, category or shop name. */
export function matchesSearch(product, q) {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [product.title, product.description, categoryName(product.category), product.shop?.name, product.shop?.city].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * Products to show for these filters: only visible products from approved shops.
 * @param {object[]} products each with { title, description, category, price_cents, created_at, hidden, shop: { status, name } }
 */
export function filterProducts(products, filters) {
  const f = cleanFilters(filters);
  const shown = products.filter((p) => !p.hidden && p.shop?.status === 'approved'
    && (!f.category || p.category === f.category)
    && (f.min === null || p.price_cents >= f.min)
    && (f.max === null || p.price_cents <= f.max)
    && matchesSearch(p, f.q));
  const by = {
    new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    'price-low': (a, b) => a.price_cents - b.price_cents || String(b.created_at).localeCompare(String(a.created_at)),
    'price-high': (a, b) => b.price_cents - a.price_cents || String(b.created_at).localeCompare(String(a.created_at)),
  }[f.sort];
  return shown.sort(by);
}

/** The sentence shown when nothing matches, with what to try next. */
export function noResultsMessage(filters) {
  const f = cleanFilters(filters);
  const tried = [];
  if (f.q) tried.push(`"${f.q}"`);
  if (f.category) tried.push(categoryName(f.category));
  if (f.min !== null || f.max !== null) tried.push('that price range');
  if (tried.length === 0) return 'No products yet. The first shops are being approved.';
  return `Nothing matches ${tried.join(', ')}. Try fewer words, another category or clear the filters.`;
}
