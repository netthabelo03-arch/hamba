// Forgot-password screen: email a link for choosing a new password.

import { requestPasswordReset, isDemo } from '../auth/api.js';
import { checkEmail } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { demoStrip } from '../shell.js';
import { el, brand, field, messageBox, linkTo, whileBusy } from '../dom.js';

export function renderForgot() {
  const email = field({ id: 'email', label: 'Email address', type: 'email', autocomplete: 'email' });
  const message = messageBox();
  const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Send reset link' });

  const form = el('form', { class: 'form', novalidate: '' }, [
    email.node,
    message.node,
    el('div', { class: 'push-down stack' }, [submit, el('p', { class: 'link-row' }, [linkTo('#/signin', 'Back to log in')])]),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const emailError = checkEmail(email.input.value);
    email.setError(emailError);
    if (emailError) return;
    await whileBusy(submit, 'Sending…', async () => {
      try {
        const { demoLinkOpened } = await requestPasswordReset(email.input.value);
        if (demoLinkOpened) return; // demo mode: the app opens the new-password screen itself
        // The same message whether or not the account exists, so the screen
        // cannot be used to find out who has an account.
        message.show(isDemo()
          ? 'If an account exists for that email in this browser, the new-password screen opens. (Demo mode sends no emails.)'
          : 'If an account exists for that email, a reset link is on its way.', 'success');
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  return [
    brand(),
    ...demoStrip(),
    el('div', { class: 'stack' }, [
      el('h1', { class: 'title', text: 'Reset your password' }),
      el('p', { class: 'lead', text: 'Enter your email and we will send you a link to choose a new password.' }),
    ]),
    form,
  ];
}
