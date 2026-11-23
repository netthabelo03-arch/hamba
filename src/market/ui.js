// Building blocks shared by the marketplace screens: photos, product cards,
// form fields that are not plain text boxes, and the quantity stepper.

import { el } from '../dom.js';
import { isLowData } from '../settings.js';
import { photoUrl } from './api.js';
import { formatRand } from './money.js';

/**
 * A product photo. In low-data mode it waits for a tap before downloading.
 * @param {string} path saved photo path (or a drawing for sample products)
 */
export function productPhoto(path, alt, { large = false } = {}) {
  const box = el('div', { class: large ? 'photo photo--large' : 'photo' });
  const url = photoUrl(path);
  const show = () => {
    const img = el('img', { src: url, alt, loading: 'lazy', decoding: 'async' });
    box.replaceChildren(img);
  };
  if (!url) {
    box.append(el('span', { class: 'photo__none', text: 'No photo' }));
  } else if (isLowData() && !url.startsWith('data:image/svg')) {
    const button = el('button', { type: 'button', class: 'photo__tap', text: 'Tap to show photo' });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      show();
    });
    box.append(button);
  } else {
    show();
  }
  return box;
}

/** A product in a grid: photo, name, shop and price, linking to the product. */
export function productCard(product) {
  const soldOut = product.stock === 0;
  return el('a', { href: `#/product/${product.id}`, class: 'card' }, [
    productPhoto(product.photos?.[0], product.title),
    el('span', { class: 'card__title', text: product.title }),
    el('span', { class: 'card__shop', text: `${product.shop?.name ?? ''} · ${product.shop?.city ?? ''}` }),
    el('span', { class: 'card__price' }, [formatRand(product.price_cents), ...(soldOut ? [el('span', { class: 'tag tag--muted', text: 'Sold out' })] : [])]),
  ]);
}

export function productGrid(products) {
  return el('div', { class: 'grid' }, products.map(productCard));
}

/** A small line saying the shops are sample data, shown in demo mode. */
export function sampleNote(demo) {
  return demo ? [el('p', { class: 'sample-note', text: 'Sample shops and products for trying Hamba out.' })] : [];
}

/** Labelled multi-line text box with room for an error. */
export function textArea({ id, label, value = '', rows = 4, hint = '' }) {
  const input = el('textarea', { id, name: id, rows: String(rows), class: 'input input--area' });
  input.value = value;
  return labelled(id, label, input, hint);
}

/** Labelled drop-down. options: [{ id, name }] */
export function select({ id, label, options, value = '', placeholder = 'Choose…' }) {
  const input = el('select', { id, name: id, class: 'input' }, [
    el('option', { value: '', text: placeholder }),
    ...options.map((o) => el('option', { value: o.id, text: o.name })),
  ]);
  input.value = value;
  return labelled(id, label, input);
}

/** Labelled text box with extra attributes such as inputmode. */
export function input({ id, label, value = '', type = 'text', autocomplete = 'off', inputmode = null, hint = '', prefix = '' }) {
  const box = el('input', { id, name: id, type, autocomplete, class: 'input' });
  if (inputmode) box.setAttribute('inputmode', inputmode);
  box.value = value;
  const control = prefix ? el('div', { class: 'affix' }, [el('span', { class: 'affix__text', 'aria-hidden': 'true', text: prefix }), box]) : box;
  const made = labelled(id, label, control, hint);
  return { ...made, input: box };
}

function labelled(id, label, control, hint = '') {
  const input = control.tagName === 'DIV' ? control.querySelector('input') : control;
  const error = el('p', { class: 'field__error', id: `${id}-error` });
  error.hidden = true;
  const parts = [el('label', { for: id, class: 'field__label', text: label })];
  if (hint) parts.push(el('p', { class: 'field__hint', id: `${id}-hint`, text: hint }));
  parts.push(control, error);
  if (hint) input.setAttribute('aria-describedby', `${id}-hint`);
  const node = el('div', { class: 'field' }, parts);
  function setError(message) {
    error.textContent = message ?? '';
    error.hidden = !message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [hint ? `${id}-hint` : '', error.id].filter(Boolean).join(' '));
    } else {
      input.removeAttribute('aria-invalid');
      if (hint) input.setAttribute('aria-describedby', `${id}-hint`);
      else input.removeAttribute('aria-describedby');
    }
  }
  // An error goes away as soon as the person starts fixing it.
  input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { if (!error.hidden) setError(null); });
  return { node, input, setError };
}

/** Put each error next to its field and move focus to the first one. */
export function showErrors(fields, errors) {
  let first = null;
  for (const [key, field] of Object.entries(fields)) {
    field.setError(errors[key] ?? null);
    if (errors[key] && !first) first = field.input;
  }
  first?.focus();
}

/** − 2 + buttons. onChange gets the new number. */
export function stepper({ value, max, label, onChange }) {
  const minus = el('button', { type: 'button', class: 'stepper__button', 'aria-label': `One less ${label}`, text: '−' });
  const count = el('span', { class: 'stepper__count', 'aria-live': 'polite', text: String(value) });
  const plus = el('button', { type: 'button', class: 'stepper__button', 'aria-label': `One more ${label}`, text: '+' });
  plus.disabled = value >= max;
  minus.addEventListener('click', () => onChange(value - 1));
  plus.addEventListener('click', () => onChange(value + 1));
  return el('div', { class: 'stepper' }, [minus, count, plus]);
}
