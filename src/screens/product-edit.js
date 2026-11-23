// Add or edit a product: photos (up to 4), name, description, category,
// price (with what the seller keeps) and stock.

import { myShop, getProduct, saveProduct, uploadPhoto, photoUrl } from '../market/api.js';
import { checkProduct, checkPhotoFile, MAX_PHOTOS, PHOTO_TYPES } from '../market/validate.js';
import { CATEGORIES } from '../market/catalog.js';
import { formatRand, parseRand, sellerShare, centsToInput } from '../market/money.js';
import { input, textArea, select, showErrors } from '../market/ui.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, messageBox, whileBusy } from '../dom.js';

export async function renderProductEdit({ session, route, navigate }) {
  const [{ profile }, shop] = await Promise.all([loadViewer(session), myShop(session.user.id)]);
  const bar = topBar({ profile, session });
  if (!shop || shop.status === 'suspended') {
    navigate('#/sell');
    return [];
  }
  const editing = route.screen === 'sell-edit';
  const product = editing ? await getProduct(route.id, session.user.id) : null;
  if (editing && (!product || product.shop_id !== shop.id)) {
    return [bar, el('p', { class: 'message message--error', role: 'alert', text: 'This product was not found in your shop.' }), el('a', { href: '#/sell', class: 'text-link', text: 'Back to your shop' }), tabBar('sell')];
  }

  // Photos: saved ones are kept by path; new ones are files until saving.
  /** @type {({ path: string } | { file: File, preview: string })[]} */
  let photos = (product?.photos ?? []).map((path) => ({ path }));
  const photoError = el('p', { class: 'field__error', id: 'photos-error', role: 'alert' });
  photoError.hidden = true;
  const picker = el('input', { type: 'file', id: 'photos', accept: PHOTO_TYPES.join(','), multiple: '', class: 'visually-hidden' });
  const strip = el('div', { class: 'photo-strip' });

  function drawPhotos() {
    const tiles = photos.map((photo, index) => {
      const remove = el('button', { type: 'button', class: 'photo-tile__remove', 'aria-label': `Remove photo ${index + 1}`, text: '×' });
      remove.addEventListener('click', () => { photos.splice(index, 1); drawPhotos(); });
      return el('div', { class: 'photo-tile' }, [
        el('img', { src: 'file' in photo ? photo.preview : photoUrl(photo.path), alt: `Photo ${index + 1}` }),
        ...(index === 0 ? [el('span', { class: 'photo-tile__main', text: 'Main' })] : []),
        remove,
      ]);
    });
    const add = el('label', { for: 'photos', class: 'photo-tile photo-tile--add' }, [el('span', { text: '+' }), el('span', { class: 'photo-tile__hint', text: 'Add photo' })]);
    strip.replaceChildren(...tiles, ...(photos.length < MAX_PHOTOS ? [add] : []));
  }
  picker.addEventListener('change', () => {
    const problems = [];
    for (const file of picker.files) {
      const problem = checkPhotoFile(file);
      if (problem) problems.push(problem);
      else if (photos.length >= MAX_PHOTOS) problems.push(`Only ${MAX_PHOTOS} photos per product.`);
      else photos.push({ file, preview: URL.createObjectURL(file) });
    }
    picker.value = '';
    photoError.textContent = [...new Set(problems)].join(' ');
    photoError.hidden = problems.length === 0;
    drawPhotos();
  });
  drawPhotos();

  const fields = {
    title: input({ id: 'p-title', label: 'Product name', value: product?.title ?? '' }),
    description: textArea({ id: 'p-description', label: 'Description', value: product?.description ?? '', rows: 5, hint: 'Sizes, colours, materials and anything a buyer should know.' }),
    category: select({ id: 'p-category', label: 'Category', options: CATEGORIES, value: product?.category ?? '' }),
    price: input({ id: 'p-price', label: 'Price', inputmode: 'decimal', prefix: 'R', value: product ? centsToInput(product.price_cents) : '' }),
    stock: input({ id: 'p-stock', label: 'How many you have', inputmode: 'numeric', value: product ? String(product.stock) : '' }),
  };
  const youGet = el('p', { class: 'field__hint', 'aria-live': 'polite' });
  const updateYouGet = () => {
    const cents = parseRand(fields.price.input.value);
    youGet.textContent = cents ? `You get ${formatRand(sellerShare(cents))} after Hamba's 14%.` : '';
  };
  fields.price.input.addEventListener('input', updateYouGet);
  updateYouGet();
  fields.price.node.append(youGet);

  const hidden = el('input', { type: 'checkbox', id: 'p-hidden', class: 'check__box' });
  hidden.checked = product?.hidden === true;
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: editing ? 'Save changes' : 'Add product' });

  const form = el('form', { class: 'form', novalidate: '' }, [
    el('div', { class: 'field' }, [el('span', { class: 'field__label', text: `Photos (up to ${MAX_PHOTOS}, first is the main one)` }), strip, picker, photoError]),
    ...Object.values(fields).map((f) => f.node),
    el('label', { class: 'check check--tall', for: 'p-hidden' }, [hidden, el('span', { class: 'check__text' }, [el('span', { class: 'check__label', text: 'Hide from shoppers' }), el('span', { class: 'check__hint', text: 'Keep it in your shop without showing it, for example while you restock.' })])]),
    message.node,
    save,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const values = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]));
    const { ok, errors, value } = checkProduct(values);
    showErrors(fields, errors);
    if (photos.length === 0) {
      photoError.textContent = 'Add at least one photo, so buyers can see what they are getting.';
      photoError.hidden = false;
    }
    if (!ok || photos.length === 0) return;
    await whileBusy(save, 'Saving…', async () => {
      try {
        const paths = [];
        for (const [i, photo] of photos.entries()) {
          save.textContent = 'file' in photo ? `Uploading photo ${i + 1} of ${photos.length}…` : 'Saving…';
          paths.push('file' in photo ? await uploadPhoto(shop.id, photo.file) : photo.path);
        }
        photos = paths.map((path) => ({ path }));
        const saved = await saveProduct(shop.id, product?.id ?? null, { ...value, photos: paths, hidden: hidden.checked });
        navigate(`#/product/${saved.id}`);
      } catch (error) {
        message.show(error?.message === 'Could not read that photo' ? 'One of the photos could not be read. Try another.' : friendlyAuthError(error));
      }
    });
  });

  return [bar, el('h1', { class: 'title', text: editing ? 'Edit product' : 'Add a product' }), form, el('a', { href: '#/sell', class: 'text-link', text: 'Back to your shop' }), tabBar('sell')];
}
