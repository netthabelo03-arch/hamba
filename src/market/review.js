// Keeping Hamba trustworthy: which product changes need an admin to look
// again, which listings mention big brands, the checks before a shop goes
// live, and the limits on new sellers.

/** Product statuses. Only approved products are shown to shoppers. */
export const PRODUCT_STATUS = {
  pending: { tag: 'Waiting for review', about: 'Hamba checks every new product, usually within a day.' },
  approved: { tag: 'Live', about: 'Shoppers can see and buy it.' },
  rejected: { tag: 'Not approved', about: 'Fix what the reviewer asked for and save it to send it back.' },
};

/** Changing these sends a live product back for review; stock and hiding do not. */
export const REVIEWED_FIELDS = ['title', 'description', 'category', 'subcategory', 'photos', 'price_cents'];

export function needsReview(before, after) {
  if (!before) return true;
  return REVIEWED_FIELDS.some((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null));
}

/** Big brands that are often faked. A listing naming one needs proof the seller may sell it. */
export const WATCHED_BRANDS = [
  'nike', 'adidas', 'puma', 'reebok', 'new balance', 'converse', 'vans', 'jordan', 'yeezy', 'asics', 'under armour',
  'gucci', 'louis vuitton', 'lv', 'prada', 'chanel', 'dior', 'versace', 'balenciaga', 'fendi', 'burberry', 'hermes',
  'supreme', 'off-white', 'north face', 'the north face', 'lacoste', 'polo ralph lauren', 'ralph lauren', 'tommy hilfiger',
  'levi', 'levis', 'diesel', 'guess', 'michael kors', 'rolex', 'casio', 'apple', 'airpods', 'samsung', 'jbl', 'beats',
  'mac cosmetics', 'fenty', 'kylie', 'carrol boyes', 'kappa', 'fila', 'champion',
];

/** The watched brands a listing mentions, in the order found. */
export function brandsMentioned(...texts) {
  const text = ` ${texts.join(' ').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  return WATCHED_BRANDS.filter((brand) => text.includes(` ${brand} `) || text.includes(` ${brand}s `));
}

/** What the admin works through before approving a shop. All must be ticked. */
export const SHOP_CHECKLIST = [
  { id: 'id_matches_selfie', label: 'The face on the ID matches the selfie' },
  { id: 'name_matches', label: 'The name on the ID matches the seller’s name' },
  { id: 'stock_photo', label: 'The stock photo shows real products with "Hamba" and a recent date' },
  { id: 'phone_call', label: 'Phone call done and the answers make sense' },
];

/** The questions for the 2-minute call, shown on the admin page. */
export const CALL_GUIDE = [
  'What do you sell?',
  'Where do you make it or buy it from? (For big brands: can you show an invoice or a reseller letter?)',
  'How will you courier parcels, and how fast can you send after an order?',
];

export function checklistComplete(checks) {
  return SHOP_CHECKLIST.every((item) => checks?.[item.id] === true);
}

/** Limits on new sellers until they have proven themselves. */
export const NEW_SELLER = {
  maxProducts: 20,            // products listed (waiting, live or hidden; not rejected)
  maxSalesCents: 500000,      // R5 000 in sales (applies once payments open)
  ordersToGraduate: 2,        // successful (delivered, no complaint) orders before limits lift and money is released sooner
  trackedCourierOnly: true,   // a tracking number is needed to mark an order shipped (applies once orders open)
  holdPayoutsUntilGraduated: true, // a new seller's money is released only after their first 2 successful orders
};

/** Whether a new seller may add another product. */
export function canAddProduct(products, seller = { established: false }) {
  if (seller.established) return { ok: true, used: null };
  const used = products.filter((p) => p.status !== 'rejected').length;
  return { ok: used < NEW_SELLER.maxProducts, used, max: NEW_SELLER.maxProducts };
}
