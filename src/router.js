// Turns the part of the address after "#" into a screen to show, and decides
// which screens need a signed-in person.
//
// Anyone can browse, search, open products and fill a bag. Checkout, selling,
// admin and the profile need an account: a signed-out person is sent to log
// in and brought back afterwards.
//
// Addresses:
//   #/                     Home
//   #/search               search all products
//   #/search/<category>    one category, e.g. #/search/sneakers
//   #/product/<id>         one product
//   #/bag                  the bag
//   #/checkout             delivery details (payment arrives in Sprint 2)
//   #/sell                 your shop: apply, wait for approval, or your products
//   #/sell/shop            edit your shop's details
//   #/sell/new             add a product
//   #/sell/edit/<id>       edit a product
//   #/admin                check, approve and suspend shops (admins only)
//   #/admin/products       review new and changed products (admins only)
//   #/signup #/signin #/forgot #/new-password #/profile #/terms #/privacy

import { isCategory } from './market/catalog.js';

const HOME = { screen: 'home' };

const SINGLE_SCREENS = ['signup', 'signin', 'forgot', 'new-password', 'profile', 'terms', 'privacy', 'search', 'bag', 'checkout', 'sell', 'admin'];
const ID = /^[\w-]{1,64}$/;

/** Screens that only a signed-in person may open. */
export const PROTECTED_SCREENS = ['profile', 'new-password', 'checkout', 'sell', 'sell-shop', 'sell-new', 'sell-edit', 'admin', 'admin-products'];

/** Screens that make no sense once signed in. */
export const GUEST_SCREENS = ['signup', 'signin', 'forgot'];

/** @returns {{ screen: string, id?: string, category?: string }} */
export function parseRoute(hash) {
  // Anything after '?' is dropped (payment pages add ?reference=… when they send people back).
  const parts = String(hash ?? '').replace(/^#/, '').split('?')[0].split('/').filter(Boolean);
  const [first, second, third] = parts;
  if (parts.length === 1 && SINGLE_SCREENS.includes(first)) return { screen: first };
  if (parts.length === 2 && first === 'search' && isCategory(second)) return { screen: 'search', category: second };
  if (parts.length === 2 && first === 'product' && ID.test(second)) return { screen: 'product', id: second };
  if (parts.length === 2 && first === 'sell' && second === 'shop') return { screen: 'sell-shop' };
  if (parts.length === 2 && first === 'admin' && second === 'products') return { screen: 'admin-products' };
  if (parts.length === 2 && first === 'sell' && second === 'new') return { screen: 'sell-new' };
  if (parts.length === 3 && first === 'sell' && second === 'edit' && ID.test(third)) return { screen: 'sell-edit', id: third };
  // Anything unknown falls back to Home instead of a blank page.
  return HOME;
}

/**
 * A signed-out person asking for a protected screen is sent to log in;
 * a signed-in person asking for a log-in screen goes Home.
 */
export function resolveRoute(route, signedIn) {
  if (!signedIn && PROTECTED_SCREENS.includes(route.screen)) return { screen: 'signin' };
  if (signedIn && GUEST_SCREENS.includes(route.screen)) return HOME;
  return route;
}

/** @returns {string} the address hash for a route */
export function hashFor(route) {
  switch (route.screen) {
    case 'home': return '#/';
    case 'search': return route.category ? `#/search/${route.category}` : '#/search';
    case 'product': return `#/product/${route.id}`;
    case 'sell-shop': return '#/sell/shop';
    case 'admin-products': return '#/admin/products';
    case 'sell-new': return '#/sell/new';
    case 'sell-edit': return `#/sell/edit/${route.id}`;
    default: return `#/${route.screen}`;
  }
}
