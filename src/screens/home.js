// Home, as in the Hamba screens. In Sprint 0 there are no shops yet, so it
// shows what is coming and invites people to join (or, for sellers, to get ready).

import { loadViewer } from '../viewer.js';
import { topBar, tabBar, demoStrip, displayName } from '../shell.js';
import { el, icon } from '../dom.js';
import { listProducts } from '../market/api.js';
import { CATEGORIES } from '../market/catalog.js';
import { productGrid, sampleNote } from '../market/ui.js';
import { isDemo } from '../auth/api.js';

const SEARCH_ICON = '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>';

/** The two feature cards under the search box, with when each arrives. */
export function featureCards() {
  return [
    { title: 'Studio', about: 'Vote on member designs', sprint: 3 },
    { title: 'Run safe', about: 'Crews, safe routes, SOS', sprint: 3 },
  ];
}

/** What the empty "New in" section says, by who is looking. */
export function emptyState(session, profile) {
  if (!session) {
    return {
      heading: 'The first shops open soon',
      text: 'Local sneaker, fashion, beauty and craft brands, all in one place. Join now and be first in.',
      action: { href: '#/signup', text: 'Create a free account' },
    };
  }
  if (profile?.role === 'seller') {
    return {
      heading: 'Open your shop',
      text: 'Apply to sell, add your products with photos, and go live once Hamba approves your shop.',
      action: { href: '#/sell', text: 'Go to Sell' },
    };
  }
  return {
    heading: 'No products yet',
    text: 'The first shops open soon. Want to sell too? Open a shop from the Sell tab.',
    action: { href: '#/sell', text: 'Open a shop' },
  };
}

export async function renderHome({ session }) {
  const [{ profile }, latest] = await Promise.all([loadViewer(session), listProducts({ sort: 'new' }, 4).catch(() => [])]);

  const search = el('a', { href: '#/search', class: 'search search--link' }, [
    icon(SEARCH_ICON, 18),
    el('span', { text: 'Search sneakers, beauty, crafts' }),
  ]);
  const chips = el('div', { class: 'chips' }, CATEGORIES.filter((c) => c.id !== 'other').slice(0, 8).map((c) => el('a', { href: `#/search/${c.id}`, class: 'chip-link', text: c.name })));

  const cards = el('div', { class: 'feature-cards' }, featureCards().map((card) => el('div', { class: 'feature-card', 'aria-disabled': 'true' }, [
    el('b', { class: 'feature-card__title', text: card.title }),
    el('span', { class: 'feature-card__about', text: card.about }),
    el('span', { class: 'soon', text: 'Soon' }),
  ])));

  const empty = emptyState(session, profile);
  const greeting = session
    ? el('p', { class: 'lead', text: `Hi ${displayName(profile, session)}.` })
    : el('h1', { class: 'hero', text: 'Local brands. Your streets.' });

  return [
    topBar({ profile, session }),
    ...demoStrip(),
    greeting,
    search,
    chips,
    cards,
    el('div', { class: 'section-head' }, [el('h2', { class: 'section-title', text: 'New in' }), ...(latest.length ? [el('a', { href: '#/search', class: 'see-all', text: 'See all' })] : [])]),
    ...(latest.length ? [productGrid(latest), ...sampleNote(isDemo())] : [el('div', { class: 'empty' }, [
      el('h3', { class: 'empty__title', text: empty.heading }),
      el('p', { class: 'empty__text', text: empty.text }),
      el('a', { href: empty.action.href, class: 'button button--primary', text: empty.action.text }),
    ])]),
    ...(!session ? [el('a', { href: '#/signup', class: 'button button--quiet', text: 'Create a free account' })] : []),
    el('p', { class: 'footer-links' }, [el('a', { href: '#/terms', text: 'Terms' }), ' · ', el('a', { href: '#/privacy', text: 'Privacy' })]),
    tabBar('home'),
  ];
}
