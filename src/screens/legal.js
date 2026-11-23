// Terms and Privacy: drafts until a lawyer has written them (Sprint 4).
// They say so plainly rather than pretend to be final.

import { el, brand, linkTo } from '../dom.js';

function page(title, points) {
  return [
    brand(),
    el('h1', { class: 'title', text: title }),
    el('p', { class: 'notice', text: 'Draft. This page will be replaced by the final version, reviewed by a lawyer, before Hamba opens to the public.' }),
    el('ul', { class: 'plain-list' }, points.map((text) => el('li', { text }))),
    linkTo('#/', 'Back to Home'),
  ];
}

export function renderTerms() {
  return page('Terms', [
    'Hamba is a marketplace: independent South African sellers sell their own products to buyers.',
    'Sellers must have their shop approved before it is shown, and may only list products they have the right to sell.',
    'Hamba keeps a commission of 14% of each sale. Buyers pay delivery per shop.',
    'Payments are made through PayFast or Paystack. Sellers are paid out once the buyer confirms delivery, or 14 days after shipping.',
    'Studio designers earn a royalty on sales of their winning designs.',
    'No fake, stolen or counterfeit goods. No abuse in reviews, designs, crews or messages.',
    'We may hide products and close accounts that break these rules.',
    'Returns, refunds and disputes: [to be written]',
  ]);
}

export function renderPrivacy() {
  return page('Privacy', [
    'We keep your email, and your name, cell number and delivery address if you add them.',
    'Sellers see the name, cell number and delivery address on orders they need to send, and nothing else about you.',
    'Card and bank payments are handled on PayFast’s or Paystack’s own pages; we never see your card details.',
    'Sellers’ bank account numbers are stored encrypted; we show only the last 4 digits.',
    'Live location (Run safe) is shared only while you choose to share it, only with the people you pick, and deleted when you stop.',
    'Low-data mode is stored only on your phone.',
    'We email you about your orders. You can turn these emails off in your Profile.',
    'Hamba follows the Protection of Personal Information Act (POPIA). You can ask to see or delete your information at any time.',
    'Responsible party and Information Officer: [to be named]',
  ]);
}
