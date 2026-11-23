// Add or edit a product: photos (cropped square, up to 4), name, description,
// department and type (or the seller's own words), who it is for, price
// (with what the seller keeps) and stock. New products, and changes to what
// shoppers read or see, wait for an admin's review.

import { myShop, getProduct, saveProduct, uploadPhoto, photoUrl, shopProducts } from '../market/api.js';
import { checkProduct, checkPhotoFile, MAX_PHOTOS, PHOTO_TYPES } from '../market/validate.js';
import { CATEGORIES, AUDIENCES, OTHER, typesFor } from '../market/catalog.js';
import { PRODUCT_STATUS, brandsMentioned, canAddProduct, NEW_SELLER } from '../market/review.js';
import { formatRand, parseRand, sellerShare, centsToInput } from '../market/money.js';
import { cropPhoto } from '../market/cropper.js';
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
  if (!editing) {
    const room = canAddProduct(await shopProducts(shop.id));
    if (!room.ok) {
      return [bar, el('h1', { class: 'title', text: 'Product limit reached' }), el('p', { class: 'lead', text: `New sellers can list up to ${NEW_SELLER.maxProducts} products until they have ${NEW_SELLER.ordersToGraduate} delivered orders. Hide or edit an existing product instead.` }), el('a', { href: '#/sell', class: 'button button--primary', text: 'Back to your shop' }), tabBar('sell')];
    }
  }

  // ---- Photos: saved ones are kept by path; new ones are cropped blobs until saving.
  /** @type {({ path: string } | { blob: Blob, preview: string })[]} */
  let photos = (product?.photos ?? []).map((path) => ({ path }));
  const photoError = el('p', { class: 'field__error', id: 'photos-error', role: 'alert' });
  photoError.hidden = true;
  const picker = el('input', { type: 'file', id: 'photos', accept: PHOTO_TYPES.join(','), multiple: '', class: 'visually-hidden' });
  const strip = el('div', { class: 'photo-strip' });

  function drawPhotos() {
    const tiles = photos.map((photo, index) => {
      const remove = el('button', { type: 'button', class: 'photo-tile__remove', 'aria-label': `Remove photo ${index + 1}`, text: '×' });
      remove.addEventListener('click', () => { photos.splice(index, 1); drawPhotos(); });
      const tile = [el('img', { src: 'blob' in photo ? photo.preview : photoUrl(photo.path), alt: `Photo ${index + 1}` })];
      if (index === 0) tile.push(el('span', { class: 'photo-tile__main', text: 'Main' }));
      else {
        const main = el('button', { type: 'button', class: 'photo-tile__make-main', text: 'Make main' });
        main.addEventListener('click', () => { photos.unshift(...photos.splice(index, 1)); drawPhotos(); });
        tile.push(main);
      }
      tile.push(remove);
      return el('div', { class: 'photo-tile' }, tile);
    });
    const add = el('label', { for: 'photos', class: 'photo-tile photo-tile--add' }, [el('span', { text: '+' }), el('span', { class: 'photo-tile__hint', text: 'Add photo' })]);
    strip.replaceChildren(...tiles, ...(photos.length < MAX_PHOTOS ? [add] : []));
  }
  picker.addEventListener('change', async () => {
    const problems = [];
    const files = [...picker.files];
    picker.value = '';
    for (const file of files) {
      const problem = checkPhotoFile(file);
      if (problem) { problems.push(problem); continue; }
      if (photos.length >= MAX_PHOTOS) { problems.push(`Only ${MAX_PHOTOS} photos per product.`); break; }
      try {
        const blob = await cropPhoto(file);
        if (blob) photos.push({ blob, preview: URL.createObjectURL(blob) });
      } catch {
        problems.push(`"${file.name}" could not be opened. Try another photo.`);
      }
      drawPhotos();
    }
    photoError.textContent = [...new Set(problems)].join(' ');
    photoError.hidden = problems.length === 0;
    drawPhotos();
  });
  drawPhotos();

  // ---- Department, type, or the seller's own words.
  const startType = product ? (product.category === OTHER || typesFor(product.category).includes(product.subcategory) ? product.subcategory : OTHER) : '';
  const fields = {
    title: input({ id: 'p-title', label: 'Product name', value: product?.title ?? '' }),
    description: textArea({ id: 'p-description', label: 'Description', value: product?.description ?? '', rows: 5, hint: 'Sizes, colours, materials and anything a buyer should know.' }),
    category: select({ id: 'p-category', label: 'Category', options: CATEGORIES, value: product?.category ?? '' }),
    type: select({ id: 'p-type', label: 'Type', options: [], value: '' }),
    ownType: input({ id: 'p-own-type', label: 'What kind of product is it?', value: product && startType === OTHER ? product.subcategory : (product?.category === OTHER ? product.subcategory : ''), hint: 'In your own words, e.g. "Beaded keyrings" or "Braiding hair".' }),
    audience: select({ id: 'p-audience', label: 'Who is it for? (optional)', options: AUDIENCES, value: product?.audience ?? '', placeholder: 'Anyone' }),
    price: input({ id: 'p-price', label: 'Price', inputmode: 'decimal', prefix: 'R', value: product ? centsToInput(product.price_cents) : '' }),
    stock: input({ id: 'p-stock', label: 'How many you have', inputmode: 'numeric', value: product ? String(product.stock) : '' }),
  };
  function fillTypes(keep) {
    const department = fields.category.input.value;
    const types = typesFor(department);
    const options = [el('option', { value: '', text: 'Choose…' }), ...types.map((t) => el('option', { value: t, text: t })), el('option', { value: OTHER, text: 'Something else (type your own)' })];
    fields.type.input.replaceChildren(...options);
    fields.type.input.value = keep && [...types, OTHER].includes(keep) ? keep : '';
    fields.type.node.hidden = !department || department === OTHER;
    syncOwn();
  }
  function syncOwn() {
    const department = fields.category.input.value;
    fields.ownType.node.hidden = !(department === OTHER || (department && fields.type.input.value === OTHER));
  }
  fields.category.input.addEventListener('change', () => fillTypes(''));
  fields.type.input.addEventListener('change', syncOwn);
  fillTypes(startType);

  const youGet = el('p', { class: 'field__hint', 'aria-live': 'polite' });
  const updateYouGet = () => {
    const cents = parseRand(fields.price.input.value);
    youGet.textContent = cents ? `You get ${formatRand(sellerShare(cents))} after Hamba's 14%.` : '';
  };
  fields.price.input.addEventListener('input', updateYouGet);
  updateYouGet();
  fields.price.node.append(youGet);

  // ---- A gentle warning when the listing names a big brand.
  const brandWarning = el('p', { class: 'message message--warning', role: 'status' });
  const checkBrands = () => {
    const brands = brandsMentioned(fields.title.input.value, fields.description.input.value);
    brandWarning.hidden = brands.length === 0;
    brandWarning.textContent = brands.length ? `Your listing mentions ${brands.map((b) => b.toUpperCase()).join(', ')}. Hamba only allows big-brand products with proof you may sell them (an invoice or a reseller letter). The reviewer will ask for it. If it is your own design, remove the brand name.` : '';
  };
  fields.title.input.addEventListener('input', checkBrands);
  fields.description.input.addEventListener('input', checkBrands);
  checkBrands();

  const hidden = el('input', { type: 'checkbox', id: 'p-hidden', class: 'check__box' });
  hidden.checked = product?.hidden === true;
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: editing ? 'Save changes' : 'Send for review' });

  const statusBox = [];
  if (product) {
    const status = PRODUCT_STATUS[product.status ?? 'approved'];
    statusBox.push(el('div', { class: `review-box review-box--${product.status}` }, [
      el('b', { text: status.tag }),
      el('span', { text: product.status === 'rejected' && product.review_note ? `Reviewer: "${product.review_note}". ${status.about}` : status.about }),
    ]));
  }

  const form = el('form', { class: 'form', novalidate: '' }, [
    ...statusBox,
    el('div', { class: 'field' }, [el('span', { class: 'field__label', text: `Photos (up to ${MAX_PHOTOS}; you can crop each one)` }), strip, picker, photoError]),
    fields.title.node,
    fields.description.node,
    brandWarning,
    fields.category.node,
    fields.type.node,
    fields.ownType.node,
    fields.audience.node,
    fields.price.node,
    fields.stock.node,
    el('label', { class: 'check check--tall', for: 'p-hidden' }, [hidden, el('span', { class: 'check__text' }, [el('span', { class: 'check__label', text: 'Hide from shoppers' }), el('span', { class: 'check__hint', text: 'Keep it in your shop without showing it, for example while you restock.' })])]),
    el('p', { class: 'field__hint', text: editing ? 'Changing the name, description, category or photos sends the product back for a quick review. Price, stock and hiding change straight away.' : 'Hamba checks every new product before shoppers see it, usually within a day.' }),
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
          save.textContent = 'blob' in photo ? `Uploading photo ${i + 1} of ${photos.length}…` : 'Saving…';
          paths.push('blob' in photo ? await uploadPhoto(shop.id, photo.blob) : photo.path);
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
