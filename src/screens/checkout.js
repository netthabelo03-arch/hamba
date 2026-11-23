// Checkout, step 1: delivery details (remembered for next time) and the order
// summary. Paying with PayFast or Paystack arrives in Sprint 2.

import { getProductsById, getDelivery, saveDelivery } from '../market/api.js';
import { readBag, priceBag } from '../market/bag.js';
import { checkDelivery, PROVINCES } from '../market/validate.js';
import { formatRand } from '../market/money.js';
import { input, select, showErrors } from '../market/ui.js';
import { showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { topBar } from '../shell.js';
import { el, messageBox, whileBusy } from '../dom.js';

export async function renderCheckout({ session }) {
  const userId = session.user.id;
  const items = readBag();
  const [{ profile }, products, saved] = await Promise.all([
    loadViewer(session),
    getProductsById(items.map((i) => i.productId)),
    getDelivery(userId).catch(() => null),
  ]);
  const bar = topBar({ profile, session });
  const bag = priceBag(items, products);
  if (bag.groups.length === 0) {
    return [bar, el('div', { class: 'empty' }, [
      el('h1', { class: 'empty__title', text: 'Nothing to check out' }),
      el('p', { class: 'empty__text', text: 'Your bag is empty, or what was in it is no longer available.' }),
      el('a', { href: '#/search', class: 'button button--primary', text: 'Start shopping' }),
    ])];
  }

  const start = saved ?? { name: profile?.full_name ?? '', phone: profile?.phone ?? '' };
  const fields = {
    name: input({ id: 'd-name', label: 'Name of the person receiving it', autocomplete: 'name', value: start.name ?? '' }),
    phone: input({ id: 'd-phone', label: 'Cell number for the courier', type: 'tel', autocomplete: 'tel', value: start.phone ? showPhone(start.phone) : '' }),
    street: input({ id: 'd-street', label: 'Street address', autocomplete: 'address-line1', value: start.street ?? '', hint: 'House or unit number and street, e.g. 12 Vilakazi St' }),
    suburb: input({ id: 'd-suburb', label: 'Suburb or township', autocomplete: 'address-level3', value: start.suburb ?? '' }),
    city: input({ id: 'd-city', label: 'Town or city', autocomplete: 'address-level2', value: start.city ?? '' }),
    postalCode: input({ id: 'd-postal', label: 'Postal code', autocomplete: 'postal-code', inputmode: 'numeric', value: start.postal_code ?? '' }),
    province: select({ id: 'd-province', label: 'Province', options: PROVINCES.map((p) => ({ id: p, name: p })), value: start.province ?? '' }),
  };
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: 'Save delivery details' });
  const form = el('form', { class: 'form', novalidate: '' }, [
    ...(saved ? [el('p', { class: 'message message--success', text: 'Your last delivery details are filled in. Change anything that is different.' })] : []),
    ...Object.values(fields).map((f) => f.node),
    message.node,
    save,
  ]);

  const pay = el('button', { type: 'button', class: 'button button--primary', text: 'Pay with PayFast or Paystack' });
  pay.disabled = true;
  const payNote = el('p', { class: 'field__hint', text: 'Save your delivery details first.' });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const values = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]));
    const { ok, errors, value } = checkDelivery(values);
    showErrors(fields, errors);
    if (!ok) return;
    await whileBusy(save, 'Saving…', async () => {
      try {
        await saveDelivery(userId, value);
        message.show(`Delivering to ${value.name}, ${value.street}, ${value.suburb}, ${value.city}. Saved for next time.`, 'success');
        payNote.textContent = 'Paying online opens in the next sprint (Sprint 2). Your bag and details are kept until then.';
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  const summary = el('div', { class: 'summary' }, [
    ...bag.groups.map((g) => el('div', { class: 'sum-row' }, [
      el('span', { text: `${g.shop.name}: ${g.lines.reduce((n, l) => n + l.qty, 0)} item${g.lines.reduce((n, l) => n + l.qty, 0) === 1 ? '' : 's'} + delivery` }),
      el('span', { text: formatRand(g.subtotal + g.delivery) }),
    ])),
    el('div', { class: 'sum-row sum-row--total' }, [el('span', { text: 'Total' }), el('span', { text: formatRand(bag.total) })]),
  ]);

  return [
    bar,
    el('h1', { class: 'title', text: 'Checkout' }),
    el('h2', { class: 'section-title', text: 'Delivery details' }),
    form,
    el('h2', { class: 'section-title', text: 'Your order' }),
    summary,
    el('a', { href: '#/bag', class: 'text-link', text: 'Change your bag' }),
    pay,
    payNote,
  ];
}
