// One product: photos, price, shop, stock, and Add to bag.

import { getProduct } from '../market/api.js';
import { addToBag, readBag, writeBag, MAX_PER_ITEM } from '../market/bag.js';
import { formatRand, DELIVERY_FEE_CENTS } from '../market/money.js';
import { categoryName } from '../market/catalog.js';
import { productPhoto, stepper } from '../market/ui.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, messageBox } from '../dom.js';

export async function renderProduct({ session, route }) {
  const [{ profile }, product] = await Promise.all([loadViewer(session), getProduct(route.id, session?.user?.id ?? null)]);
  const bar = topBar({ profile, session });
  if (!product) {
    return [bar, el('div', { class: 'empty' }, [
      el('h1', { class: 'empty__title', text: 'This product is not available' }),
      el('p', { class: 'empty__text', text: 'It may have sold out for good or been taken down by the shop.' }),
      el('a', { href: '#/search', class: 'button button--primary', text: 'Keep shopping' }),
    ]), tabBar('search')];
  }

  const own = product.shop?.owner_id && product.shop.owner_id === session?.user?.id;
  const photos = (product.photos?.length ? product.photos : ['']).map((path, i) => el('div', { class: 'gallery__item' }, [productPhoto(path, `${product.title}, photo ${i + 1}`, { large: true })]));
  const gallery = el('div', { class: 'gallery', tabindex: '0', 'aria-label': 'Photos' }, photos);

  const message = messageBox();
  const inBag = () => readBag().find((i) => i.productId === product.id)?.qty ?? 0;
  const limit = Math.min(product.stock, MAX_PER_ITEM);
  let qty = 1;
  const holder = el('div');
  const add = el('button', { type: 'button', class: 'button button--primary' });
  const view = el('a', { href: '#/bag', class: 'button button--quiet', text: 'View bag' });
  view.hidden = inBag() === 0;

  function draw() {
    const room = Math.max(0, limit - inBag());
    qty = Math.max(1, Math.min(qty, room || 1));
    add.textContent = product.stock === 0 ? 'Sold out' : room === 0 ? 'All in your bag' : `Add ${qty} to bag · ${formatRand(product.price_cents * qty)}`;
    add.disabled = product.stock === 0 || room === 0 || own;
    holder.replaceChildren(...(product.stock > 0 && room > 0 ? [stepper({ value: qty, max: room, label: product.title, onChange: (n) => { qty = Math.max(1, n); draw(); } })] : []));
  }
  add.addEventListener('click', () => {
    const result = addToBag(readBag(), product, qty);
    if (result.added === 0) {
      message.show(`You already have the most you can add (${result.limit}).`);
    } else {
      writeBag(result.items);
      message.show(`Added ${result.added} to your bag.`, 'success');
      view.hidden = false;
    }
    qty = 1;
    draw();
  });
  draw();

  const stockText = product.stock === 0 ? 'Sold out' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock';

  return [
    bar,
    gallery,
    el('div', { class: 'stack' }, [
      ...(product.hidden ? [el('p', { class: 'notice', text: 'Hidden: only you can see this product.' })] : []),
      ...(product.shop?.status !== 'approved' ? [el('p', { class: 'notice', text: 'Your shop is not approved yet, so shoppers cannot see this.' })] : []),
      el('p', { class: 'eyebrow', text: categoryName(product.category) }),
      el('h1', { class: 'title', text: product.title }),
      el('p', { class: 'price', text: formatRand(product.price_cents) }),
      el('p', { class: product.stock === 0 ? 'stock stock--out' : product.stock <= 3 ? 'stock stock--low' : 'stock', text: stockText }),
    ]),
    el('div', { class: 'stack' }, [holder, add, message.node, view]),
    ...(own ? [el('a', { href: `#/sell/edit/${product.id}`, class: 'button button--quiet', text: 'Edit this product' })] : []),
    el('p', { class: 'body-text', text: product.description }),
    el('div', { class: 'shop-box' }, [
      el('span', { class: 'shop-box__name', text: product.shop?.name ?? '' }),
      el('span', { class: 'shop-box__city', text: `Sends from ${product.shop?.city ?? ''}` }),
      el('span', { class: 'shop-box__city', text: `Delivery ${formatRand(DELIVERY_FEE_CENTS)} per shop, whatever you buy from them.` }),
    ]),
    tabBar('search'),
  ];
}
