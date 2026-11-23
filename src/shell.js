// The frame around every screen: the bar at the top (logo, and Log in or the
// person's initial) and the tab bar at the bottom, as in the Hamba screens.

import { el, icon, brand } from './dom.js';
import { isDemo } from './auth/api.js';
import { readBag, bagCount } from './market/bag.js';

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
  bag: '<path d="M5 8h14l-1 12H6z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path>',
  orders: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"></path><path d="M3 7l9 4 9-4M12 11v10"></path>',
  sell: '<path d="M4 9l1-5h14l1 5"></path><path d="M4 9h16v11H4z"></path><path d="M10 20v-6h4v6"></path>',
};

/**
 * The tabs at the bottom. Tabs for features still to come are shown greyed
 * out (href null), so the layout people learn now stays the same as they arrive.
 * @returns {{ id: string, text: string, href: string | null, sprint?: number }[]}
 */
export function tabs() {
  return [
    { id: 'home', text: 'Home', href: '#/' },
    { id: 'search', text: 'Search', href: '#/search' },
    { id: 'bag', text: 'Bag', href: '#/bag' },
    { id: 'orders', text: 'Orders', href: null, sprint: 2 },
    { id: 'sell', text: 'Sell', href: '#/sell' },
  ];
}

/** The name to greet someone by: first name, else the email name, else "there". */
export function displayName(profile, session) {
  const first = String(profile?.full_name ?? '').trim().split(/\s+/)[0];
  if (first) return first;
  const emailName = String(session?.user?.email ?? '').split('@')[0];
  return emailName || 'there';
}

/** The letter in the round account button. */
export function initial(profile, session) {
  return displayName(profile, session).charAt(0).toUpperCase() || '?';
}

/** The top bar. Signed out: Log in. Signed in: a round button with the person's initial. */
export function topBar({ profile, session }) {
  const right = session
    ? el('a', { href: '#/profile', class: 'avatar', 'aria-label': `Profile for ${displayName(profile, session)}`, text: initial(profile, session) })
    : el('a', { href: '#/signin', class: 'button button--primary button--small', text: 'Log in' });
  return el('header', { class: 'topbar' }, [brand(), right]);
}

/** A strip saying accounts are demo accounts, while Supabase is not connected. */
export function demoStrip() {
  if (!isDemo()) return [];
  return [el('p', { class: 'demo-strip', role: 'note', text: 'Demo mode: accounts are kept only in this browser until Hamba is connected to its database.' })];
}

/** The tab bar at the bottom, with the current tab marked. */
export function tabBar(current) {
  return el('nav', { class: 'tabbar', 'aria-label': 'Main' }, tabs().map((tab) => {
    const content = [icon(ICONS[tab.id], 24), el('span', { text: tab.text })];
    if (!tab.href) {
      return el('span', { class: 'tabbar__tab tabbar__tab--soon', title: `Coming in Sprint ${tab.sprint}`, 'aria-disabled': 'true' }, content);
    }
    const link = el('a', { href: tab.href, class: 'tabbar__tab' }, content);
    if (tab.id === current) link.setAttribute('aria-current', 'page');
    if (tab.id === 'bag') {
      const badge = el('span', { class: 'tabbar__badge' });
      const update = () => {
        const count = bagCount(readBag());
        badge.textContent = count > 9 ? '9+' : String(count);
        badge.hidden = count === 0;
        link.setAttribute('aria-label', count ? `Bag, ${count} item${count === 1 ? '' : 's'}` : 'Bag');
      };
      update();
      // Keep the count right after adding from any screen (only one tab bar is ever shown).
      window.removeEventListener('hamba:bag', window.__hambaBagBadge);
      window.__hambaBagBadge = update;
      window.addEventListener('hamba:bag', update);
      link.append(badge);
    }
    return link;
  }));
}
