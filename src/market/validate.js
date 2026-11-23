// Checks on shops, products, photos and delivery details.
// Each returns { ok, errors, value } where value is the tidied version to save.

import { isCategory } from './catalog.js';
import { parseRand } from './money.js';
import { normalizePhone } from '../auth/validate.js';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS = 4;
export const MAX_STOCK = 9999;
export const MAX_PRICE_CENTS = 10000000; // R100 000

export const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

function text(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function result(errors, value) {
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function checkShop({ name, about, city, phone }) {
  const errors = {};
  const value = { name: text(name), about: String(about ?? '').trim(), city: text(city), phone: normalizePhone(phone) };
  if (value.name.length < 2 || value.name.length > 40) errors.name = 'Give your shop a name of 2 to 40 characters.';
  if (value.about.length < 20 || value.about.length > 500) errors.about = 'Say what you sell in 20 to 500 characters.';
  if (value.city.length < 2 || value.city.length > 40) errors.city = 'Enter the town or city you send from.';
  if (!value.phone) errors.phone = 'Enter a South African cell number, like 082 123 4567.';
  return result(errors, value);
}

export function checkProduct({ title, description, category, price, stock }) {
  const errors = {};
  const priceCents = parseRand(price);
  const stockText = String(stock ?? '').trim();
  const stockCount = /^\d+$/.test(stockText) ? Number(stockText) : null;
  const value = { title: text(title), description: String(description ?? '').trim(), category, price_cents: priceCents, stock: stockCount };
  if (value.title.length < 3 || value.title.length > 80) errors.title = 'Use a name of 3 to 80 characters.';
  if (value.description.length < 10 || value.description.length > 1000) errors.description = 'Describe it in 10 to 1000 characters: sizes, colours, materials.';
  if (!isCategory(category)) errors.category = 'Choose a category.';
  if (priceCents === null) errors.price = 'Enter a price in rand, like 899 or 899.50.';
  else if (priceCents < 500) errors.price = 'The lowest price is R5.00.';
  else if (priceCents > MAX_PRICE_CENTS) errors.price = 'The highest price is R100 000.';
  if (stockCount === null) errors.stock = 'Enter how many you have, as a whole number (0 if sold out).';
  else if (stockCount > MAX_STOCK) errors.stock = `Enter ${MAX_STOCK} or fewer.`;
  return result(errors, value);
}

/** null if the file can be used as a product photo, else what is wrong. */
export function checkPhotoFile(file) {
  if (!file) return 'Choose a photo.';
  if (!PHOTO_TYPES.includes(file.type)) return `"${file.name}" is not a photo. Use JPG, PNG or WebP.`;
  if (file.size > MAX_PHOTO_BYTES) return `"${file.name}" is bigger than 8 MB. Choose a smaller photo.`;
  return null;
}

export function checkDelivery({ name, phone, street, suburb, city, postalCode, province }) {
  const errors = {};
  const value = { name: text(name), phone: normalizePhone(phone), street: text(street), suburb: text(suburb), city: text(city), postal_code: text(postalCode), province };
  if (value.name.length < 2) errors.name = 'Enter the name of the person receiving the parcel.';
  if (!value.phone) errors.phone = 'Enter a South African cell number for the courier, like 082 123 4567.';
  if (value.street.length < 4) errors.street = 'Enter the street address, with the house or unit number.';
  if (value.suburb.length < 2) errors.suburb = 'Enter the suburb or township.';
  if (value.city.length < 2) errors.city = 'Enter the town or city.';
  if (!/^\d{4}$/.test(value.postal_code)) errors.postalCode = 'Enter the 4-digit postal code.';
  if (!PROVINCES.includes(province)) errors.province = 'Choose the province.';
  return result(errors, value);
}
