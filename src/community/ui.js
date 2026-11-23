// Shared pieces for the Studio and Run safe screens.

import { el, whileBusy } from '../dom.js';
import { report } from './api.js';
import { REPORT_REASONS } from './rules.js';
import { friendlyAuthError } from '../auth/errors.js';
import { saveNext } from '../next.js';

/** Send a signed-out person to log in, then back here. */
export function needLogin(navigate) {
  saveNext(window.location.hash || '#/');
  navigate('#/signin');
}

/** A small "Report" link that opens a reason picker under it. */
export function reportControl({ kind, itemId, session, navigate }) {
  const open = el('button', { type: 'button', class: 'text-button text-button--quiet', text: 'Report' });
  const holder = el('div', { class: 'report' });
  open.addEventListener('click', () => {
    if (!session) { needLogin(navigate); return; }
    if (holder.childElementCount) { holder.replaceChildren(); return; }
    const reason = el('select', { class: 'input input--small', 'aria-label': 'Why are you reporting this?' }, [el('option', { value: '', text: 'Why?' }), ...REPORT_REASONS.map((r) => el('option', { value: r, text: r }))]);
    const send = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Send report' });
    const note = el('span', { class: 'field__hint', role: 'status' });
    send.addEventListener('click', () => whileBusy(send, '…', async () => {
      if (!reason.value) { note.textContent = 'Choose a reason.'; return; }
      try {
        await report(kind, itemId, session.user.id, reason.value);
        holder.replaceChildren(el('span', { class: 'field__hint', text: 'Thanks. Hamba will look at it.' }));
      } catch (error) {
        note.textContent = friendlyAuthError(error);
      }
    }));
    holder.replaceChildren(reason, send, note);
  });
  return { button: open, holder };
}

/** A back arrow and title, as in the Studio and Run safe screens. */
export function screenHead(title, back = '#/', action = null) {
  const arrow = el('a', { href: back, class: 'back', 'aria-label': 'Back' });
  arrow.innerHTML = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>';
  return el('div', { class: 'screen-head' }, [arrow, el('h1', { class: 'title', text: title }), ...(action ? [action] : [])]);
}
