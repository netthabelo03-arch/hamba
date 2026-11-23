// Profile: name, cell number, shop or sell, emails, low-data mode and log out.

import { updateProfile, signOut } from '../auth/api.js';
import { loadViewer, forgetViewer } from '../viewer.js';
import { ROLES, checkOptionalName, normalizePhone, showPhone } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { isLowData, setLowData } from '../settings.js';
import { topBar, tabBar, demoStrip } from '../shell.js';
import { el, field, messageBox, whileBusy } from '../dom.js';

function checkbox(id, label, hint, checked) {
  const box = el('input', { type: 'checkbox', id, class: 'check__box' });
  box.checked = checked;
  const row = el('label', { class: 'check check--tall', for: id }, [
    box,
    el('span', { class: 'check__text' }, [el('span', { class: 'check__label', text: label }), el('span', { class: 'check__hint', text: hint })]),
  ]);
  return { box, row };
}

export async function renderProfile({ session }) {
  const message = messageBox();
  const { profile, admin } = await loadViewer(session);
  const heading = el('div', { class: 'stack' }, [
    el('h1', { class: 'title', text: 'Profile' }),
    el('p', { class: 'lead', text: session.user.email ?? '' }),
  ]);

  const logOut = el('button', { type: 'button', class: 'button button--quiet', text: 'Log out' });
  const logOutError = messageBox();
  logOut.addEventListener('click', () => whileBusy(logOut, 'Logging out…', async () => {
    logOutError.clear();
    try {
      await signOut();
    } catch (error) {
      logOutError.show(friendlyAuthError(error));
    }
  }));

  if (profile === null) {
    message.show('Your profile was not found. The database setup script may not have been run yet.');
    return [topBar({ profile: null, session }), heading, message.node, logOut, logOutError.node, tabBar('profile')];
  }

  let bar = topBar({ profile, session });
  let role = profile.role;
  const options = ROLES.map((item) => {
    const button = el('button', { type: 'button', class: 'role-option' }, [
      el('span', { class: 'role-option__name', text: item.name }),
      el('span', { class: 'role-option__about', text: item.about }),
    ]);
    button.addEventListener('click', () => { role = item.id; updateRole(); });
    return { item, button };
  });
  function updateRole() {
    for (const { item, button } of options) button.setAttribute('aria-pressed', String(item.id === role));
  }
  updateRole();

  const name = field({ id: 'full-name', label: 'Your name (optional)', autocomplete: 'name', value: profile.full_name });
  const phone = field({ id: 'phone', label: 'Cell number (optional, for delivery updates)', type: 'tel', autocomplete: 'tel', value: profile.phone ? showPhone(profile.phone) : '' });
  const emails = checkbox('email-notifications', 'Email me about my orders', 'Order paid, shipped and delivered, and payouts for sellers.', profile.email_notifications !== false);
  const lowData = checkbox('low-data', 'Low-data mode (this phone)', 'Loads no web fonts and, from Sprint 1, shows product photos only when you tap them.', isLowData());
  // Low-data mode is a setting of this phone, so it applies at once without saving.
  lowData.box.addEventListener('change', () => setLowData(lowData.box.checked));

  const save = el('button', { type: 'submit', class: 'button button--primary', text: 'Save changes' });
  const form = el('form', { class: 'form', novalidate: '' }, [
    name.node,
    phone.node,
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label', id: 'role-label', text: 'I am here to' }),
      el('div', { class: 'role-options', role: 'group', 'aria-labelledby': 'role-label' }, options.map(({ button }) => button)),
    ]),
    emails.row,
    message.node,
    el('div', { class: 'push-down' }, [save]),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const nameError = checkOptionalName(name.input.value);
    name.setError(nameError);
    const phoneText = phone.input.value.trim();
    const cleanPhone = phoneText ? normalizePhone(phoneText) : null;
    const phoneError = phoneText && !cleanPhone ? 'Enter a South African cell number, like 082 123 4567.' : null;
    phone.setError(phoneError);
    if (nameError || phoneError) return;
    await whileBusy(save, 'Saving…', async () => {
      try {
        const saved = await updateProfile(session.user.id, { fullName: name.input.value, role, phone: cleanPhone, emailNotifications: emails.box.checked });
        name.input.value = saved.full_name;
        phone.input.value = saved.phone ? showPhone(saved.phone) : '';
        emails.box.checked = saved.email_notifications !== false;
        role = saved.role;
        updateRole();
        forgetViewer();
        const fresh = topBar({ profile: saved, session });
        bar.replaceWith(fresh);
        bar = fresh;
        message.show('Saved.', 'success');
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  return [
    bar,
    ...demoStrip(),
    heading,
    ...(admin ? [el('a', { href: '#/admin', class: 'button button--quiet', text: 'Admin: approve shops' })] : []),
    form,
    el('div', { class: 'stack settings' }, [el('h2', { class: 'section-title', text: 'This phone' }), lowData.row]),
    el('div', { class: 'stack' }, [logOut, logOutError.node]),
    tabBar('profile'),
  ];
}
