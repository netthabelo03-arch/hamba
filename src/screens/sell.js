// Sell: open a shop (it waits for an admin), then manage your products.
// Also the shop details form (#/sell/shop).

import { myShop, openShop, updateShop, shopProducts, setHidden } from '../market/api.js';
import { checkShop } from '../market/validate.js';
import { formatRand, sellerShare, COMMISSION_RATE } from '../market/money.js';
import { input, textArea, showErrors, productPhoto } from '../market/ui.js';
import { showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, messageBox, whileBusy } from '../dom.js';

const STATUS_TEXT = {
  pending: { tag: 'Waiting for approval', text: 'We check every new shop before shoppers can see it, usually within 2 working days. You can add products now; they go live when your shop is approved.' },
  approved: { tag: 'Live', text: 'Shoppers can see your shop and buy your products.' },
  suspended: { tag: 'Suspended', text: 'Your shop is hidden from shoppers. Contact Hamba support to find out why and what to fix.' },
};

function shopForm({ shop, profile, session, onSaved }) {
  const fields = {
    name: input({ id: 's-name', label: 'Shop name', value: shop?.name ?? '' }),
    about: textArea({ id: 's-about', label: 'What you sell', value: shop?.about ?? '', rows: 3 }),
    city: input({ id: 's-city', label: 'Town or city you send from', autocomplete: 'address-level2', value: shop?.city ?? '' }),
    phone: input({ id: 's-phone', label: 'Shop cell number', type: 'tel', autocomplete: 'tel', value: showPhone(shop?.phone ?? profile?.phone ?? ''), hint: 'Hamba calls this number to check your shop. Buyers do not see it.' }),
  };
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: shop ? 'Save shop details' : 'Apply to sell' });
  const form = el('form', { class: 'form', novalidate: '' }, [...Object.values(fields).map((f) => f.node), message.node, save]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const values = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]));
    const { ok, errors, value } = checkShop(values);
    showErrors(fields, errors);
    if (!ok) return;
    await whileBusy(save, 'Saving…', async () => {
      try {
        const saved = shop ? await updateShop(shop.id, value) : await openShop(session.user.id, value);
        onSaved(saved, message);
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });
  return form;
}

export async function renderSell({ session, navigate }) {
  const [{ profile }, shop] = await Promise.all([loadViewer(session), myShop(session.user.id)]);
  const bar = topBar({ profile, session });

  if (!shop) {
    return [
      bar,
      el('h1', { class: 'title', text: 'Sell on Hamba' }),
      el('ul', { class: 'plain-list' }, [
        el('li', { text: 'Free to open a shop. Hamba keeps 14% of each sale; you keep the rest.' }),
        el('li', { text: 'Buyers pay R80 delivery per shop, which goes to you to send the parcel.' }),
        el('li', { text: 'Every shop is checked before it goes live, to keep fakes off Hamba.' }),
      ]),
      shopForm({ shop: null, profile, session, onSaved: () => navigate('#/sell') }),
      tabBar('sell'),
    ];
  }

  const status = STATUS_TEXT[shop.status] ?? STATUS_TEXT.pending;
  const products = await shopProducts(shop.id);
  const list = products.length
    ? el('div', { class: 'stack' }, products.map((p) => sellerRow(p)))
    : el('div', { class: 'empty' }, [el('p', { class: 'empty__text', text: 'No products yet. Add your first one with a clear photo, an honest description and how many you have.' })]);

  function sellerRow(product) {
    const toggle = el('button', { type: 'button', class: 'text-button', text: product.hidden ? 'Show' : 'Hide' });
    const row = el('div', { class: product.hidden ? 'line line--muted' : 'line' }, [
      el('a', { href: `#/product/${product.id}`, class: 'line__photo' }, [productPhoto(product.photos?.[0], product.title)]),
      el('div', { class: 'line__body' }, [
        el('a', { href: `#/sell/edit/${product.id}`, class: 'line__title', text: product.title }),
        el('span', { class: 'line__meta', text: `${formatRand(product.price_cents)} · you get ${formatRand(sellerShare(product.price_cents))}` }),
        el('span', { class: product.stock === 0 ? 'line__meta stock--out' : 'line__meta', text: `${product.stock === 0 ? 'Sold out' : `${product.stock} in stock`}${product.hidden ? ' · Hidden' : ''}` }),
        el('div', { class: 'line__actions' }, [el('a', { href: `#/sell/edit/${product.id}`, class: 'text-link', text: 'Edit' }), toggle]),
      ]),
    ]);
    toggle.addEventListener('click', () => whileBusy(toggle, '…', async () => {
      try {
        await setHidden(product.id, !product.hidden);
        product.hidden = !product.hidden;
        row.replaceWith(sellerRow(product));
      } catch (error) {
        toggle.after(el('span', { class: 'field__error', text: friendlyAuthError(error) }));
      }
    }));
    return row;
  }

  return [
    bar,
    el('div', { class: 'stack' }, [
      el('h1', { class: 'title', text: shop.name }),
      el('p', { class: `status status--${shop.status}`, text: status.tag }),
      el('p', { class: 'lead', text: status.text }),
      el('a', { href: '#/sell/shop', class: 'text-link', text: 'Edit shop details' }),
    ]),
    ...(shop.status === 'suspended' ? [] : [el('a', { href: '#/sell/new', class: 'button button--primary', text: 'Add a product' })]),
    el('h2', { class: 'section-title', text: `Your products (${products.length})` }),
    list,
    el('p', { class: 'field__hint', text: `Hamba keeps ${Math.round(COMMISSION_RATE * 100)}% of the price. "You get" is what is paid to you after a sale is delivered.` }),
    tabBar('sell'),
  ];
}

export async function renderSellShop({ session, navigate }) {
  const [{ profile }, shop] = await Promise.all([loadViewer(session), myShop(session.user.id)]);
  if (!shop) {
    navigate('#/sell');
    return [];
  }
  return [
    topBar({ profile, session }),
    el('h1', { class: 'title', text: 'Shop details' }),
    shopForm({ shop, profile, session, onSaved: (_saved, message) => message.show('Saved.', 'success') }),
    el('a', { href: '#/sell', class: 'text-link', text: 'Back to your shop' }),
    tabBar('sell'),
  ];
}

