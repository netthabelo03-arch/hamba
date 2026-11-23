// Admin: approve new shops, and suspend or restore live ones.

import { allShops, setShopStatus } from '../market/api.js';
import { showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { isDemo } from '../auth/api.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, whileBusy } from '../dom.js';

const SECTIONS = [
  { status: 'pending', title: 'Waiting for approval', actions: [['approved', 'Approve'], ['suspended', 'Decline']] },
  { status: 'approved', title: 'Live', actions: [['suspended', 'Suspend']] },
  { status: 'suspended', title: 'Suspended', actions: [['approved', 'Restore']] },
];

export async function renderAdmin({ session }) {
  const { profile, admin } = await loadViewer(session);
  const bar = topBar({ profile, session });
  if (!admin) {
    return [bar, el('h1', { class: 'title', text: 'Admins only' }), el('p', { class: 'lead', text: isDemo() ? 'In demo mode, sign up with an email starting with admin@ to try this screen.' : 'This screen is for Hamba admins.' }), tabBar('profile')];
  }
  const body = el('div', { class: 'stack stack--wide' });

  async function draw() {
    const shops = await allShops();
    body.replaceChildren(...SECTIONS.map((section) => {
      const list = shops.filter((s) => s.status === section.status);
      return el('section', { class: 'stack' }, [
        el('h2', { class: 'section-title', text: `${section.title} (${list.length})` }),
        ...(list.length ? list.map((shop) => shopCard(shop, section)) : [el('p', { class: 'lead', text: 'None.' })]),
      ]);
    }));
  }

  function shopCard(shop, section) {
    const buttons = section.actions.map(([status, text]) => {
      const button = el('button', { type: 'button', class: status === 'approved' ? 'button button--primary button--small' : 'button button--quiet button--small', text });
      button.addEventListener('click', () => whileBusy(button, '…', async () => {
        try {
          await setShopStatus(shop.id, status);
          await draw();
        } catch (error) {
          button.after(el('p', { class: 'field__error', role: 'alert', text: friendlyAuthError(error) }));
        }
      }));
      return button;
    });
    return el('div', { class: 'admin-shop' }, [
      el('b', { class: 'admin-shop__name', text: shop.name }),
      el('span', { class: 'line__meta', text: `${shop.city} · ${showPhone(shop.phone)} · since ${shop.created_at.slice(0, 10)}` }),
      el('p', { class: 'body-text', text: shop.about }),
      el('div', { class: 'line__actions' }, buttons),
    ]);
  }

  await draw();
  return [bar, el('h1', { class: 'title', text: 'Shops' }), el('p', { class: 'lead', text: 'Call the seller on their number before approving, and check their ID.' }), body, tabBar('profile')];
}
