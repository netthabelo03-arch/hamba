// Starts the app: finds out whether someone is signed in, shows the right
// screen for the address, and keeps both in step.

import { parseRoute, resolveRoute, hashFor, PROTECTED_SCREENS, GUEST_SCREENS } from './router.js';
import { currentSession, onAuthChange } from './auth/api.js';
import { saveNext, takeNext } from './next.js';
import { forgetViewer } from './viewer.js';
import { isLowData } from './settings.js';
import { el, brand } from './dom.js';
import { renderHome } from './screens/home.js';
import { renderSignUp } from './screens/signup.js';
import { renderSignIn } from './screens/signin.js';
import { renderForgot } from './screens/forgot.js';
import { renderNewPassword } from './screens/newpassword.js';
import { renderProfile } from './screens/profile.js';
import { renderTerms, renderPrivacy } from './screens/legal.js';
import { renderSearch } from './screens/search.js';
import { renderProduct } from './screens/product.js';
import { renderBag } from './screens/bag.js';
import { renderCheckout } from './screens/checkout.js';
import { renderSell, renderSellShop } from './screens/sell.js';
import { renderProductEdit } from './screens/product-edit.js';
import { renderAdmin, renderAdminProducts, renderAdminDesigns, renderAdminReports } from './screens/admin.js';
import { renderStudio, renderStudioNew } from './screens/studio.js';
import { renderRun, renderRunCrew, renderRunRoute } from './screens/run.js';
import { renderLive } from './screens/live.js';
import { renderBuddy } from './screens/buddy.js';

const SCREENS = {
  home: renderHome,
  signup: renderSignUp,
  signin: renderSignIn,
  forgot: renderForgot,
  'new-password': renderNewPassword,
  profile: renderProfile,
  terms: renderTerms,
  privacy: renderPrivacy,
  search: renderSearch,
  product: renderProduct,
  bag: renderBag,
  checkout: renderCheckout,
  sell: renderSell,
  'sell-shop': renderSellShop,
  'sell-new': renderProductEdit,
  'sell-edit': renderProductEdit,
  admin: renderAdmin,
  'admin-products': renderAdminProducts,
  'admin-designs': renderAdminDesigns,
  'admin-reports': renderAdminReports,
  studio: renderStudio,
  'studio-new': renderStudioNew,
  run: renderRun,
  'run-live': renderLive,
  'run-crew': renderRunCrew,
  'run-route': renderRunRoute,
  live: renderBuddy,
};

const root = document.getElementById('app');
let session = null;
let latestRender = 0;

/** Go to a screen. Going to the screen already showing draws it again (e.g. after opening a shop). */
function navigate(hash) {
  if (window.location.hash === hash) show();
  else window.location.hash = hash;
}

function loadingScreen() {
  return [brand(), el('p', { class: 'lead', role: 'status', text: 'Loading…' })];
}

async function show() {
  const asked = parseRoute(window.location.hash);
  const signedIn = session !== null;
  const route = resolveRoute(asked, signedIn);
  if (route.screen !== asked.screen) {
    if (!signedIn && PROTECTED_SCREENS.includes(asked.screen)) {
      saveNext(hashFor(asked));
      navigate(hashFor(route));
    } else {
      navigate(takeNext() ?? hashFor(route));
    }
    return;
  }
  document.body.classList.toggle('guest-screen', GUEST_SCREENS.includes(route.screen) || ['live', 'run-live'].includes(route.screen));

  // A slow screen may finish after the person has moved on: only draw the newest.
  const thisRender = ++latestRender;
  const pending = SCREENS[route.screen]({ session, navigate, route });
  if (pending instanceof Promise && root.childElementCount === 0) root.replaceChildren(...loadingScreen());
  let content;
  try {
    content = await pending;
  } catch {
    const retry = el('button', { type: 'button', class: 'button button--primary', text: 'Try again' });
    retry.addEventListener('click', show);
    content = [
      brand(),
      el('h1', { class: 'title', text: 'This screen could not be shown' }),
      el('p', { class: 'message message--error', role: 'alert', text: navigator.onLine === false ? 'You are offline. Connect to the internet and try again.' : 'Something went wrong while loading it. Check your connection and try again.' }),
      el('div', { class: 'link-row' }, [retry, el('a', { href: '#/', class: 'button button--quiet', text: 'Back to Home' })]),
    ];
  }
  if (thisRender !== latestRender) return;
  root.replaceChildren(...content);
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function start() {
  document.documentElement.classList.toggle('low-data', isLowData());
  root.replaceChildren(...loadingScreen());
  try {
    session = await currentSession();
    if (session !== null) {
      const next = takeNext();
      if (next) navigate(next);
    }
    await onAuthChange((event, newSession) => {
      const before = session?.user?.id ?? null;
      const after = newSession?.user?.id ?? null;
      session = newSession;
      // Routine events (such as refreshing the session) must not wipe a half-filled form.
      if (event !== 'PASSWORD_RECOVERY' && before === after) return;
      forgetViewer();
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') navigate('#/new-password');
        else if (before === null && after !== null) navigate(takeNext() ?? '#/');
        else if (after === null) navigate('#/');
        show();
      }, 0);
    });
  } catch {
    // Accounts not reachable: browsing still works.
    session = null;
  }
  window.addEventListener('hashchange', show);
  watchConnection();
  show();
}

/** A bar across the top while offline, so a screen that will not load is not a mystery. */
function watchConnection() {
  const bar = el('p', { class: 'offline-bar', role: 'status', text: 'You are offline. Some things will not load until you are back online.' });
  bar.hidden = navigator.onLine !== false;
  document.body.prepend(bar);
  window.addEventListener('offline', () => { bar.hidden = false; });
  window.addEventListener('online', () => { bar.hidden = true; });
}

start();
window.__hambaStarted = true;
try {
  sessionStorage.removeItem('hamba.reloaded');
} catch {
  // private mode: nothing to clear
}

// Offline support only where it can work (not inside a preview frame).
if ('serviceWorker' in navigator && window.isSecureContext && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
