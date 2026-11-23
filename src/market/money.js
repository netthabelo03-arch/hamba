// Money is kept in cents (whole numbers) everywhere, so sums never drift.

/** Delivery is charged once per shop in the bag. */
export const DELIVERY_FEE_CENTS = 8000;

/** Hamba's commission on each sale (used from Sprint 2, shown to sellers now). */
export const COMMISSION_RATE = 0.14;

/** 89900 shown as "R899.00"; 123456 as "R1 234.56" (South African style). */
export function formatRand(cents) {
  const value = Math.round(Number(cents) || 0);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const rands = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}R${rands}.${rest}`;
}

/**
 * What a seller typed as a price, in cents, or null if it is not a price.
 * Accepts 899, 899.5, 899.50, 899,50, R 899 and 1 299.
 */
export function parseRand(text) {
  const clean = String(text ?? '').trim().replace(/^R\s*/i, '').replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [rands, part = ''] = clean.split('.');
  return Number(rands) * 100 + Number(part.padEnd(2, '0'));
}

/** Cents shown in a price box for editing: 89900 as "899.00". */
export function centsToInput(cents) {
  return (Number(cents) / 100).toFixed(2);
}

/** What the seller keeps from a sale price after commission, in cents. */
export function sellerShare(priceCents) {
  return priceCents - Math.round(priceCents * COMMISSION_RATE);
}
