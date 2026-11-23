// Sell: apply to open a shop (with the trust checks), wait for approval, then
// manage products. Also the shop details form (#/sell/shop).

import { myShop, openShop, updateShop, shopProducts, setHidden, submitChecks, getChecks } from '../market/api.js';
import { checkShop, checkApplicationPhotos, PHOTO_TYPES } from '../market/validate.js';
import { formatRand, sellerShare, COMMISSION_RATE } from '../market/money.js';
import { PRODUCT_STATUS, NEW_SELLER, canAddProduct } from '../market/review.js';
import { input, textArea, showErrors, productPhoto } from '../market/ui.js';
import { showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, messageBox, whileBusy } from '../dom.js';

const STATUS_TEXT = {
  pending: { tag: 'Waiting for approval', text: 'We check your ID and photos and call you on your shop number, usually within 2 working days. You can add products now; they go live once your shop and each product are approved.' },
  approved: { tag: 'Live', text: 'Shoppers can see your shop. Each new product is checked before it shows.' },
  suspended: { tag: 'Suspended', text: 'Your shop is hidden from shoppers. Contact Hamba support to find out why and what to fix.' },
};

const PHOTO_FIELDS = [
  { key: 'idPhoto', label: 'Photo of your ID', hint: 'Green ID book, smart ID card or passport. All 4 corners in the photo, nothing covered.' },
  { key: 'selfie', label: 'Selfie holding your ID', hint: 'Hold the ID next to your face, in good light.' },
  { key: 'stockPhoto', label: 'Photo of your products', hint: 'Your real products next to a piece of paper with "Hamba" and today’s date written on it.' },
];

/** A photo picker with a preview, for the application. */
function photoPicker({ key, label, hint }) {
  const id = `c-${key}`;
  const picker = el('input', { type: 'file', id, accept: PHOTO_TYPES.join(','), class: 'visually-hidden' });
  const preview = el('span', { class: 'proof__preview', text: '+' });
  const error = el('p', { class: 'field__error', id: `${id}-error` });
  error.hidden = true;
  let file = null;
  picker.addEventListener('change', () => {
    file = picker.files[0] ?? null;
    error.hidden = true;
    preview.replaceChildren(file ? el('img', { src: URL.createObjectURL(file), alt: '' }) : '+');
  });
  const node = el('div', { class: 'field' }, [
    el('label', { for: id, class: 'proof' }, [preview, el('span', { class: 'check__text' }, [el('span', { class: 'check__label', text: label }), el('span', { class: 'check__hint', text: hint })])]),
    picker,
    error,
  ]);
  return { key, node, get file() { return file; }, setError(message) { error.textContent = message ?? ''; error.hidden = !message; } };
}

function photoSection() {
  const pickers = PHOTO_FIELDS.map(photoPicker);
  const node = el('div', { class: 'stack' }, [
    el('h2', { class: 'section-title', text: 'Prove it’s you' }),
    el('p', { class: 'field__hint', text: 'Only Hamba admins can see these photos. We delete them as soon as your shop is approved or declined.' }),
    ...pickers.map((p) => p.node),
  ]);
  return {
    node,
    check() {
      const files = Object.fromEntries(pickers.map((p) => [p.key, p.file]));
      const { ok, errors } = checkApplicationPhotos(files);
      for (const p of pickers) p.setError(errors[p.key] ?? null);
      return { ok, files };
    },
  };
}

function shopForm({ shop, profile, session, onSaved, withPhotos }) {
  const fields = {
    name: input({ id: 's-name', label: 'Shop name', value: shop?.name ?? '' }),
    about: textArea({ id: 's-about', label: 'What you sell', value: shop?.about ?? '', rows: 3 }),
    city: input({ id: 's-city', label: 'Town or city you send from', autocomplete: 'address-level2', value: shop?.city ?? '' }),
    phone: input({ id: 's-phone', label: 'Shop cell number', type: 'tel', autocomplete: 'tel', value: showPhone(shop?.phone ?? profile?.phone ?? ''), hint: 'Hamba calls this number before approving your shop. Buyers do not see it.' }),
  };
  const photos = withPhotos ? photoSection() : null;
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: shop ? 'Save shop details' : 'Apply to sell' });
  const form = el('form', { class: 'form', novalidate: '' }, [...Object.values(fields).map((f) => f.node), ...(photos ? [photos.node] : []), message.node, save]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const values = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]));
    const { ok, errors, value } = checkShop(values);
    showErrors(fields, errors);
    const proof = photos ? photos.check() : { ok: true };
    if (!ok || !proof.ok) return;
    await whileBusy(save, 'Saving…', async () => {
      try {
        const saved = shop ? await updateShop(shop.id, value) : await openShop(session.user.id, value);
        if (photos) {
          save.textContent = 'Sending your photos…';
          await submitChecks(session.user.id, saved.id, proof.files);
        }
        onSaved(saved, message);
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });
  return form;
}

/** For a shop opened without its photos (or before the checks existed): send them now. */
function sendChecksForm({ shop, session, navigate }) {
  const photos = photoSection();
  const message = messageBox();
  const send = el('button', { type: 'submit', class: 'button button--primary', text: 'Send photos' });
  const form = el('form', { class: 'form', novalidate: '' }, [photos.node, message.node, send]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const proof = photos.check();
    if (!proof.ok) return;
    await whileBusy(send, 'Sending…', async () => {
      try {
        await submitChecks(session.user.id, shop.id, proof.files);
        navigate('#/sell');
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
        el('li', { text: 'Every shop and every product is checked before it goes live, to keep fakes off Hamba. We will call you.' }),
      ]),
      shopForm({ shop: null, profile, session, withPhotos: true, onSaved: () => navigate('#/sell') }),
      tabBar('sell'),
    ];
  }

  const [products, checks] = await Promise.all([shopProducts(shop.id), shop.status === 'pending' ? getChecks(shop.id).catch(() => null) : null]);
  const status = STATUS_TEXT[shop.status] ?? STATUS_TEXT.pending;
  const room = canAddProduct(products);

  if (shop.status === 'pending' && !checks) {
    return [bar, el('h1', { class: 'title', text: shop.name }), el('p', { class: 'status status--pending', text: 'Photos needed' }), el('p', { class: 'lead', text: 'Send these 3 photos so Hamba can check your shop.' }), sendChecksForm({ shop, session, navigate }), tabBar('sell')];
  }

  function sellerRow(product) {
    const toggle = el('button', { type: 'button', class: 'text-button', text: product.hidden ? 'Show' : 'Hide' });
    const review = PRODUCT_STATUS[product.status ?? 'approved'];
    const tone = product.status === 'approved' ? 'approved' : product.status === 'rejected' ? 'suspended' : 'pending';
    const row = el('div', { class: product.hidden ? 'line line--muted' : 'line' }, [
      el('a', { href: `#/product/${product.id}`, class: 'line__photo' }, [productPhoto(product.photos?.[0], product.title)]),
      el('div', { class: 'line__body' }, [
        el('a', { href: `#/sell/edit/${product.id}`, class: 'line__title', text: product.title }),
        el('span', { class: `status status--${tone}`, text: review.tag }),
        ...(product.status === 'rejected' && product.review_note ? [el('span', { class: 'line__meta', text: `To fix: ${product.review_note}` })] : []),
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

  const list = products.length
    ? el('div', { class: 'stack' }, products.map(sellerRow))
    : el('div', { class: 'empty' }, [el('p', { class: 'empty__text', text: 'No products yet. Add your first one with a clear photo, an honest description and how many you have.' })]);

  const limits = el('div', { class: 'limits' }, [
    el('b', { text: 'New seller limits' }),
    el('ul', { class: 'plain-list' }, [
      el('li', { text: `Up to ${NEW_SELLER.maxProducts} products (you have ${room.used}).` }),
      el('li', { text: `Up to ${formatRand(NEW_SELLER.maxSalesCents)} in sales (counted once payments open).` }),
      el('li', { text: 'Send every order with a tracked courier and add the tracking number.' }),
      el('li', { text: `Your money is released after your first ${NEW_SELLER.ordersToGraduate} successful orders (delivered, no complaints).` }),
    ]),
    el('span', { class: 'field__hint', text: `The limits lift after ${NEW_SELLER.ordersToGraduate} successful orders.` }),
  ]);

  return [
    bar,
    el('div', { class: 'stack' }, [
      el('h1', { class: 'title', text: shop.name }),
      el('p', { class: `status status--${shop.status}`, text: status.tag }),
      el('p', { class: 'lead', text: status.text }),
      el('a', { href: '#/sell/shop', class: 'text-link', text: 'Edit shop details' }),
    ]),
    ...(shop.status === 'suspended' ? [] : room.ok
      ? [el('a', { href: '#/sell/new', class: 'button button--primary', text: 'Add a product' })]
      : [el('p', { class: 'message message--warning', text: `You have reached the ${NEW_SELLER.maxProducts}-product limit for new sellers.` })]),
    limits,
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
    shopForm({ shop, profile, session, withPhotos: false, onSaved: (_saved, message) => message.show('Saved.', 'success') }),
    el('a', { href: '#/sell', class: 'text-link', text: 'Back to your shop' }),
    tabBar('sell'),
  ];
}
