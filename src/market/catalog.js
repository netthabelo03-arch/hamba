// Departments and their types (like Shein's menu), and the search, filter and
// sort rules. Sellers are never boxed in: every department has "Something else"
// where they type their own type, and "Something else" as a department is
// for anything that fits nowhere.

export const OTHER = 'other';

/** Departments, each with common product types. */
export const CATEGORIES = [
  { id: 'clothing', name: 'Clothing', types: ['Tops & tees', 'Shirts & blouses', 'Dresses', 'Skirts', 'Pants & jeans', 'Shorts', 'Jackets & coats', 'Hoodies & sweaters', 'Two-piece sets', 'Traditional & heritage wear', 'Activewear', 'Underwear & sleepwear', 'Swimwear', 'Plus size', 'Workwear & uniforms'] },
  { id: 'shoes', name: 'Shoes', types: ['Sneakers', 'Running shoes', 'Boots', 'Heels', 'Flats & loafers', 'Sandals & slides', 'Formal shoes', 'Kids shoes'] },
  { id: 'bags', name: 'Bags & accessories', types: ['Handbags', 'Backpacks', 'Wallets & purses', 'Caps & hats', 'Belts', 'Scarves & head wraps', 'Sunglasses', 'Phone cases', 'Hair accessories'] },
  { id: 'jewellery', name: 'Jewellery & watches', types: ['Necklaces', 'Earrings', 'Bracelets & bangles', 'Rings', 'Beadwork', 'Watches', 'Body jewellery'] },
  { id: 'beauty', name: 'Beauty & care', types: ['Skincare', 'Body care', 'Hair care', 'Wigs & weaves', 'Makeup', 'Nails', 'Fragrance', 'Men’s grooming'] },
  { id: 'sport', name: 'Sport & outdoors', types: ['Running gear', 'Gym & training', 'Soccer', 'Netball', 'Cycling', 'Hiking & camping', 'Water bottles', 'Reflective & safety gear'] },
  { id: 'home', name: 'Home & living', types: ['Decor', 'Baskets & storage', 'Kitchen & dining', 'Bedding & cushions', 'Candles & scents', 'Plants & garden', 'Furniture'] },
  { id: 'kids', name: 'Kids & baby', types: ['Baby clothes', 'Kids clothes', 'School wear', 'Toys & games', 'Baby care'] },
  { id: 'crafts', name: 'Art & crafts', types: ['Paintings & prints', 'Sculpture & carving', 'Pottery & ceramics', 'Weaving', 'Craft supplies'] },
  { id: 'tech', name: 'Phones & gadgets', types: ['Phone accessories', 'Chargers & power banks', 'Earphones & speakers', 'Smart watches'] },
  { id: 'stationery', name: 'Books & stationery', types: ['Books', 'Notebooks & journals', 'Cards & gift wrap', 'Office & school'] },
  { id: 'pets', name: 'Pets', types: ['Collars & leads', 'Beds', 'Toys', 'Grooming'] },
  { id: OTHER, name: 'Something else', types: [] },
];

/** Who it is for (optional), as on Shein. */
export const AUDIENCES = [
  { id: 'women', name: 'Women' },
  { id: 'men', name: 'Men' },
  { id: 'unisex', name: 'Everyone' },
  { id: 'kids', name: 'Kids' },
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

export function typesFor(id) {
  return CATEGORIES.find((c) => c.id === id)?.types ?? [];
}

export function isAudience(id) {
  return AUDIENCES.some((a) => a.id === id);
}

/** "Clothing · Dresses", or just the type the seller typed for Something else. */
export function categoryLabel(product) {
  const department = product.category === OTHER ? '' : categoryName(product.category);
  return [department, product.subcategory].filter(Boolean).join(' · ');
}

/** Tidy filters from the screen: unknown values are dropped. */
export function cleanFilters({ q = '', category = '', type = '', audience = '', min = null, max = null, sort = 'new' } = {}) {
  const lo = Number.isInteger(min) && min >= 0 ? min : null;
  const hi = Number.isInteger(max) && max >= 0 ? max : null;
  const department = isCategory(category) ? category : '';
  return {
    q: String(q).trim().slice(0, 60),
    category: department,
    type: department && typesFor(department).includes(type) ? type : '',
    audience: isAudience(audience) ? audience : '',
    min: lo !== null && hi !== null && lo > hi ? hi : lo,
    max: lo !== null && hi !== null && lo > hi ? lo : hi,
    sort: SORTS.some((s) => s.id === sort) ? sort : 'new',
  };
}

/** Words in the search must all appear in the name, description, category, type or shop. */
export function matchesSearch(product, q) {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [product.title, product.description, categoryName(product.category), product.subcategory, product.shop?.name, product.shop?.city].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}

/** Whether shoppers may see a product: approved, not hidden, from an approved shop. */
export function isLive(product) {
  return Boolean(product) && !product.hidden && (product.status ?? 'approved') === 'approved' && product.shop?.status === 'approved';
}

/**
 * Products to show for these filters: only live products.
 * Unisex products show for Women and for Men too.
 */
export function filterProducts(products, filters) {
  const f = cleanFilters(filters);
  const shown = products.filter((p) => isLive(p)
    && (!f.category || p.category === f.category)
    && (!f.type || p.subcategory === f.type)
    && (!f.audience || p.audience === f.audience || (p.audience === 'unisex' && (f.audience === 'women' || f.audience === 'men')))
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
  if (f.type) tried.push(f.type);
  else if (f.category) tried.push(categoryName(f.category));
  if (f.audience) tried.push(`for ${AUDIENCES.find((a) => a.id === f.audience).name.toLowerCase()}`);
  if (f.min !== null || f.max !== null) tried.push('that price range');
  if (tried.length === 0) return 'No products yet. The first shops are being approved.';
  return `Nothing matches ${tried.join(', ')}. Try fewer words, another category or clear the filters.`;
}
