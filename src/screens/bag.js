// The bag, grouped by shop, with delivery charged once per shop.

import { getProductsById } from '../market/api.js';
import { readBag, writeBag, priceBag, setQty, removeFromBag, MAX_PER_ITEM } from '../market/bag.js';
import { formatRand } from '../market/money.js';
import { productPhoto, stepper } from '../market/ui.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el } from '../dom.js';
import { friendlyAuthError } from '../auth/errors.js';

export async function renderBag({ session }) {
  const { profile } = await loadViewer(session);
  const body = el('div', { class: 'stack stack--wide' });

  async function draw() {
    let items = readBag();
    if (items.length === 0) {
      body.replaceChildren(el('div', { class: 'empty' }, [
        el('h2', { class: 'empty__title', text: 'Your bag is empty' }),
        el('p', { class: 'empty__text', text: 'Find something from a local brand and it will wait here.' }),
        el('a', { href: '#/search', class: 'button button--primary', text: 'Start shopping' }),
      ]));
      return;
    }
    let products;
    try {
      products = await getProductsById(items.map((i) => i.productId));
    } catch (error) {
      body.replaceChildren(el('p', { class: 'message message--error', role: 'alert', text: friendlyAuthError(error) }));
      return;
    }
    const bag = priceBag(items, products);
    // Quietly take out things that are gone for good, and cap quantities to stock.
    const fixed = items.filter((i) => !bag.problems.some((p) => p.productId === i.productId && p.reason === 'gone'))
      .map((i) => { const p = products.get(i.productId); return p && i.qty > Math.min(p.stock, MAX_PER_ITEM) && p.stock > 0 ? { ...i, qty: Math.min(p.stock, MAX_PER_ITEM) } : i; });
    if (JSON.stringify(fixed) !== JSON.stringify(items)) { writeBag(fixed); items = fixed; }

    const notes = bag.problems.map((p) => el('p', { class: 'message message--warning', role: 'status' }, [
      `${p.product?.title ?? 'An item'}: ${p.text}.`,
      ...(p.reason === 'sold-out' ? [' ', removeLink(p.productId)] : []),
    ]));

    const groups = bag.groups.map((group) => el('section', { class: 'bag-shop', 'aria-label': group.shop.name }, [
      el('h2', { class: 'bag-shop__name' }, [group.shop.name, el('span', { class: 'bag-shop__city', text: ` · ${group.shop.city}` })]),
      ...group.lines.map((line) => el('div', { class: 'line' }, [
        el('a', { href: `#/product/${line.product.id}`, class: 'line__photo' }, [productPhoto(line.product.photos?.[0], line.product.title)]),
        el('div', { class: 'line__body' }, [
          el('a', { href: `#/product/${line.product.id}`, class: 'line__title', text: line.product.title }),
          el('span', { class: 'line__price', text: formatRand(line.lineTotal) }),
          el('div', { class: 'line__actions' }, [
            stepper({
              value: line.qty,
              max: Math.min(line.product.stock, MAX_PER_ITEM),
              label: line.product.title,
              onChange: (n) => { writeBag(setQty(readBag(), line.product, n)); draw(); },
            }),
            removeLink(line.product.id),
          ]),
        ]),
      ])),
      el('div', { class: 'sum-row sum-row--small' }, [el('span', { text: 'Delivery from this shop' }), el('span', { text: formatRand(group.delivery) })]),
    ]));

    const summary = bag.groups.length ? [
      el('div', { class: 'summary' }, [
        el('div', { class: 'sum-row' }, [el('span', { text: `Items (${bag.count})` }), el('span', { text: formatRand(bag.subtotal) })]),
        el('div', { class: 'sum-row' }, [el('span', { text: `Delivery (${bag.groups.length} shop${bag.groups.length === 1 ? '' : 's'})` }), el('span', { text: formatRand(bag.delivery) })]),
        el('div', { class: 'sum-row sum-row--total' }, [el('span', { text: 'Total' }), el('span', { text: formatRand(bag.total) })]),
      ]),
      el('a', { href: '#/checkout', class: 'button button--primary', text: 'Checkout' }),
    ] : [];

    body.replaceChildren(...notes, ...groups, ...summary);
  }

  function removeLink(productId) {
    const button = el('button', { type: 'button', class: 'text-button', text: 'Remove' });
    button.addEventListener('click', () => { writeBag(removeFromBag(readBag(), productId)); draw(); });
    return button;
  }

  await draw();
  return [topBar({ profile, session }), el('h1', { class: 'title', text: 'Bag' }), body, tabBar('bag')];
}
