import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, resolveRoute, hashFor, PROTECTED_SCREENS, GUEST_SCREENS } from '../src/router.js';
import { isSafeNext } from '../src/next.js';
import { tabs, displayName, initial } from '../src/shell.js';
import { featureCards, emptyState } from '../src/screens/home.js';

test('each named address opens its screen; anything else goes Home', () => {
  for (const name of ['signup', 'signin', 'forgot', 'new-password', 'profile', 'terms', 'privacy']) {
    assert.deepEqual(parseRoute(`#/${name}`), { screen: name });
    assert.equal(hashFor({ screen: name }), `#/${name}`);
  }
  for (const other of ['', '#', '#/', '#/nope', '#/profile/extra', null]) assert.deepEqual(parseRoute(other), { screen: 'home' });
  assert.deepEqual(parseRoute('#/profile?reference=abc'), { screen: 'profile' });
});

test('marketplace addresses carry their category or product id', () => {
  const cases = {
    '#/search': { screen: 'search' },
    '#/search/shoes': { screen: 'search', category: 'shoes' },
    '#/product/p-runner': { screen: 'product', id: 'p-runner' },
    '#/bag': { screen: 'bag' },
    '#/checkout': { screen: 'checkout' },
    '#/sell': { screen: 'sell' },
    '#/sell/shop': { screen: 'sell-shop' },
    '#/sell/new': { screen: 'sell-new' },
    '#/sell/edit/abc-123': { screen: 'sell-edit', id: 'abc-123' },
    '#/admin': { screen: 'admin' },
    '#/admin/products': { screen: 'admin-products' },
  };
  for (const [hash, route] of Object.entries(cases)) {
    assert.deepEqual(parseRoute(hash), route, hash);
    assert.equal(hashFor(route), hash);
  }
  for (const bad of ['#/search/cars', '#/product/', '#/product/a b', '#/sell/edit', '#/product/<x>']) assert.deepEqual(parseRoute(bad), { screen: 'home' }, bad);
});

test('checkout, selling and admin need an account; browsing and the bag do not', () => {
  for (const screen of ['checkout', 'sell', 'sell-new', 'sell-edit', 'sell-shop', 'admin', 'admin-products']) assert.deepEqual(resolveRoute({ screen }, false), { screen: 'signin' });
  for (const screen of ['search', 'product', 'bag']) assert.equal(resolveRoute({ screen }, false).screen, screen);
  assert.equal(hashFor({ screen: 'home' }), '#/');
});

test('signed out, the profile sends you to log in; signed in, log-in screens send you Home', () => {
  for (const screen of PROTECTED_SCREENS) assert.deepEqual(resolveRoute({ screen }, false), { screen: 'signin' });
  for (const screen of GUEST_SCREENS) assert.deepEqual(resolveRoute({ screen }, true), { screen: 'home' });
  assert.deepEqual(resolveRoute({ screen: 'home' }, false), { screen: 'home' });
  assert.deepEqual(resolveRoute({ screen: 'terms' }, true), { screen: 'terms' });
});

test('only addresses inside the app are remembered for after log-in', () => {
  assert.equal(isSafeNext('#/profile'), true);
  for (const bad of ['https://evil.example', '//evil.example', '#/x?y=1', 'javascript:alert(1)', null]) assert.equal(isSafeNext(bad), false);
});

test('the tab bar matches the Hamba screens; Orders waits for Sprint 2', () => {
  assert.deepEqual(tabs().map((t) => t.text), ['Home', 'Search', 'Bag', 'Orders', 'Sell']);
  assert.deepEqual(tabs().filter((t) => !t.href).map((t) => t.id), ['orders']);
  for (const tab of tabs().filter((t) => !t.href)) assert.ok(tab.sprint >= 1);
});

test('people are greeted by first name, then email name', () => {
  const session = { user: { email: 'thendo@example.com' } };
  assert.equal(displayName({ full_name: 'Thendo Nemakonde' }, session), 'Thendo');
  assert.equal(displayName({ full_name: '  ' }, session), 'thendo');
  assert.equal(initial({ full_name: '' }, session), 'T');
  assert.equal(displayName(null, null), 'there');
});

test('Home shows Studio and Run safe as coming soon, and the right empty state', () => {
  assert.deepEqual(featureCards().map((c) => c.title), ['Studio', 'Run safe']);
  assert.equal(emptyState(null, null).action.href, '#/signup');
  const session = { user: { id: 'u', email: 'a@b.co' } };
  assert.equal(emptyState(session, { role: 'seller' }).action.href, '#/sell');
  assert.match(emptyState(session, { role: 'buyer' }).text, /Sell tab/);
});
