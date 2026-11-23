// Admin: check and approve shops (ID, selfie, stock photo, a phone call with
// notes), and review products before shoppers see them.

import { allShops, setShopStatus, getChecks, saveCheckProgress, decideShop, productsToReview, reviewProduct } from '../market/api.js';
import { SHOP_CHECKLIST, CALL_GUIDE, checklistComplete, brandsMentioned } from '../market/review.js';
import { categoryLabel, AUDIENCES } from '../market/catalog.js';
import { formatRand } from '../market/money.js';
import { productPhoto } from '../market/ui.js';
import { showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { isDemo } from '../auth/api.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, whileBusy, messageBox } from '../dom.js';

function tabs(current, counts) {
  return el('nav', { class: 'chips', 'aria-label': 'Admin' }, [
    ['admin', '#/admin', `Shops${counts.shops ? ` (${counts.shops})` : ''}`],
    ['admin-products', '#/admin/products', `Products to review${counts.products ? ` (${counts.products})` : ''}`],
  ].map(([id, href, text]) => {
    const link = el('a', { href, class: 'chip-link', text });
    if (id === current) link.setAttribute('aria-current', 'true');
    return link;
  }));
}

function locked(bar) {
  return [bar, el('h1', { class: 'title', text: 'Admins only' }), el('p', { class: 'lead', text: isDemo() ? 'In demo mode, sign up with an email starting with admin@ to try this screen.' : 'This screen is for Hamba admins.' }), tabBar('profile')];
}

function errorAfter(button, error) {
  button.parentElement.querySelector('.field__error')?.remove();
  button.parentElement.append(el('p', { class: 'field__error', role: 'alert', text: friendlyAuthError(error) }));
}

// ---------------------------------------------------------------- Shops

async function pendingShopCard(shop, session, redraw) {
  const checks = await getChecks(shop.id).catch(() => null);
  const ticks = { ...(checks?.checklist ?? {}) };

  const proof = checks
    ? el('div', { class: 'proof-grid' }, [['id_photo', 'ID'], ['selfie', 'Selfie with ID'], ['stock_photo', 'Products + note']].map(([key, label]) => el('figure', { class: 'proof-grid__item' }, [
      checks.urls?.[key] ? el('a', { href: checks.urls[key], target: '_blank', rel: 'noopener' }, [el('img', { src: checks.urls[key], alt: label })]) : el('span', { class: 'photo__none', text: 'Missing' }),
      el('figcaption', { text: label }),
    ])))
    : el('p', { class: 'message message--warning', text: 'The seller has not sent their photos yet. They are asked to when they open Sell.' });

  const approve = el('button', { type: 'button', class: 'button button--primary button--small', text: 'Approve shop' });
  const decline = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Decline' });
  const updateApprove = () => { approve.disabled = !checks || !checklistComplete(ticks); };

  const list = el('div', { class: 'stack' }, SHOP_CHECKLIST.map((item) => {
    const box = el('input', { type: 'checkbox', id: `${shop.id}-${item.id}`, class: 'check__box' });
    box.checked = ticks[item.id] === true;
    box.disabled = !checks;
    box.addEventListener('change', () => { ticks[item.id] = box.checked; updateApprove(); saveSoon(); });
    return el('label', { class: 'check', for: box.id }, [box, el('span', { class: 'check__label', text: item.label })]);
  }));

  // The call guide stays on screen while calling, with a box for notes.
  const notes = el('textarea', { id: `${shop.id}-notes`, class: 'input input--area', rows: '4', placeholder: 'What they sell, where it comes from, which courier, anything odd…' });
  notes.value = checks?.call_notes ?? '';
  notes.disabled = !checks;
  const saved = el('span', { class: 'field__hint', 'aria-live': 'polite' });
  let timer = null;
  function saveSoon() {
    if (!checks) return;
    clearTimeout(timer);
    saved.textContent = 'Saving…';
    timer = setTimeout(async () => {
      try {
        await saveCheckProgress(shop.id, { checklist: ticks, callNotes: notes.value });
        saved.textContent = 'Notes saved';
      } catch (error) {
        saved.textContent = friendlyAuthError(error);
      }
    }, 600);
  }
  notes.addEventListener('input', saveSoon);

  const call = el('div', { class: 'call-guide' }, [
    el('div', { class: 'call-guide__head' }, [
      el('b', { text: 'Phone call (about 2 minutes)' }),
      el('a', { href: `tel:${shop.phone}`, class: 'button button--quiet button--small', text: `Call ${showPhone(shop.phone)}` }),
    ]),
    el('ol', { class: 'call-guide__list' }, CALL_GUIDE.map((q) => el('li', { text: q }))),
    el('label', { for: notes.id, class: 'field__label', text: 'Call notes' }),
    notes,
    saved,
  ]);

  approve.addEventListener('click', () => whileBusy(approve, 'Approving…', async () => {
    try {
      clearTimeout(timer);
      await saveCheckProgress(shop.id, { checklist: ticks, callNotes: notes.value });
      await decideShop(shop.id, 'approved', session.user.id);
      await redraw();
    } catch (error) { errorAfter(approve, error); }
  }));
  decline.addEventListener('click', () => whileBusy(decline, 'Declining…', async () => {
    try {
      if (checks) {
        clearTimeout(timer);
        await saveCheckProgress(shop.id, { checklist: ticks, callNotes: notes.value });
        await decideShop(shop.id, 'suspended', session.user.id);
      } else {
        await setShopStatus(shop.id, 'suspended');
      }
      await redraw();
    } catch (error) { errorAfter(decline, error); }
  }));
  updateApprove();

  return el('div', { class: 'admin-shop' }, [
    el('b', { class: 'admin-shop__name', text: shop.name }),
    el('span', { class: 'line__meta', text: `${shop.city} · ${showPhone(shop.phone)} · applied ${shop.created_at.slice(0, 10)}` }),
    el('p', { class: 'body-text', text: shop.about }),
    proof,
    call,
    el('div', { class: 'stack' }, [el('b', { text: 'Before approving' }), list]),
    el('div', { class: 'line__actions' }, [approve, decline]),
    el('p', { class: 'field__hint', text: 'Approving or declining deletes the ID photo, selfie and stock photo. Your checklist and call notes are kept.' }),
  ]);
}

async function decidedShopCard(shop, actions, redraw) {
  const checks = await getChecks(shop.id).catch(() => null);
  const buttons = actions.map(([status, text]) => {
    const button = el('button', { type: 'button', class: status === 'approved' ? 'button button--primary button--small' : 'button button--quiet button--small', text });
    button.addEventListener('click', () => whileBusy(button, '…', async () => {
      try {
        await setShopStatus(shop.id, status);
        await redraw();
      } catch (error) { errorAfter(button, error); }
    }));
    return button;
  });
  return el('div', { class: 'admin-shop' }, [
    el('b', { class: 'admin-shop__name', text: shop.name }),
    el('span', { class: 'line__meta', text: `${shop.city} · ${showPhone(shop.phone)}${checks?.decided_at ? ` · checked ${checks.decided_at.slice(0, 10)}, ID photos deleted` : ''}` }),
    ...(checks?.call_notes ? [el('p', { class: 'body-text', text: `Call notes: ${checks.call_notes}` })] : []),
    el('div', { class: 'line__actions' }, buttons),
  ]);
}

export async function renderAdmin({ session }) {
  const { profile, admin } = await loadViewer(session);
  const bar = topBar({ profile, session });
  if (!admin) return locked(bar);
  const body = el('div', { class: 'stack stack--wide' });
  const head = el('div');

  async function draw() {
    const [shops, products] = await Promise.all([allShops(), productsToReview()]);
    const pending = shops.filter((s) => s.status === 'pending');
    head.replaceChildren(tabs('admin', { shops: pending.length, products: products.length }));
    const sections = [
      { title: 'Waiting for approval', list: pending, card: (s) => pendingShopCard(s, session, draw) },
      { title: 'Live', list: shops.filter((s) => s.status === 'approved'), card: (s) => decidedShopCard(s, [['suspended', 'Suspend']], draw) },
      { title: 'Suspended or declined', list: shops.filter((s) => s.status === 'suspended'), card: (s) => decidedShopCard(s, [['approved', 'Restore']], draw) },
    ];
    body.replaceChildren(...await Promise.all(sections.map(async (section) => el('section', { class: 'stack' }, [
      el('h2', { class: 'section-title', text: `${section.title} (${section.list.length})` }),
      ...(section.list.length ? await Promise.all(section.list.map(section.card)) : [el('p', { class: 'lead', text: 'None.' })]),
    ]))));
  }

  await draw();
  return [bar, el('h1', { class: 'title', text: 'Admin' }), head, body, tabBar('profile')];
}

// ---------------------------------------------------------------- Products

function productReviewCard(product, redraw) {
  const brands = brandsMentioned(product.title, product.description);
  const note = el('textarea', { id: `${product.id}-note`, class: 'input input--area', rows: '2', placeholder: 'If rejecting: what must the seller fix?' });
  const message = messageBox();
  const approve = el('button', { type: 'button', class: 'button button--primary button--small', text: 'Approve' });
  const reject = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Reject' });
  approve.addEventListener('click', () => whileBusy(approve, '…', async () => {
    try { await reviewProduct(product.id, 'approved', ''); await redraw(); } catch (error) { message.show(friendlyAuthError(error)); }
  }));
  reject.addEventListener('click', () => whileBusy(reject, '…', async () => {
    if (note.value.trim().length < 5) { message.show('Say what the seller must fix, so they can correct it.'); note.focus(); return; }
    try { await reviewProduct(product.id, 'rejected', note.value.trim()); await redraw(); } catch (error) { message.show(friendlyAuthError(error)); }
  }));
  const audience = AUDIENCES.find((a) => a.id === product.audience)?.name;
  return el('div', { class: 'admin-shop' }, [
    el('div', { class: 'review-photos' }, (product.photos?.length ? product.photos : ['']).map((path, i) => productPhoto(path, `${product.title}, photo ${i + 1}`))),
    el('b', { class: 'admin-shop__name', text: product.title }),
    el('span', { class: 'line__meta', text: `${categoryLabel(product)}${audience ? ` · ${audience}` : ''} · ${formatRand(product.price_cents)} · ${product.stock} in stock` }),
    el('span', { class: 'line__meta', text: `${product.shop?.name ?? ''} (${product.shop?.status === 'approved' ? 'live shop' : 'shop not approved yet'})` }),
    ...(brands.length ? [el('p', { class: 'message message--warning', text: `Mentions ${brands.map((b) => b.toUpperCase()).join(', ')}. Ask the seller for an invoice or reseller letter before approving.` })] : []),
    el('p', { class: 'body-text', text: product.description }),
    el('label', { for: note.id, class: 'field__label', text: 'Note to seller' }),
    note,
    message.node,
    el('div', { class: 'line__actions' }, [approve, reject]),
  ]);
}

export async function renderAdminProducts({ session }) {
  const { profile, admin } = await loadViewer(session);
  const bar = topBar({ profile, session });
  if (!admin) return locked(bar);
  const body = el('div', { class: 'stack stack--wide' });
  const head = el('div');

  async function draw() {
    const [shops, products] = await Promise.all([allShops(), productsToReview()]);
    head.replaceChildren(tabs('admin-products', { shops: shops.filter((s) => s.status === 'pending').length, products: products.length }));
    body.replaceChildren(...(products.length
      ? [el('p', { class: 'lead', text: 'Check the photos are real and match the description, the price makes sense, and no big brand is being faked.' }), ...products.map((p) => productReviewCard(p, draw))]
      : [el('div', { class: 'empty' }, [el('p', { class: 'empty__text', text: 'Nothing to review. New products and changed listings show up here.' })])]));
  }

  await draw();
  return [bar, el('h1', { class: 'title', text: 'Admin' }), head, body, tabBar('profile')];
}
