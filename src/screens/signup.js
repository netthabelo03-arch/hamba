// Sign-up screen: an email, a password and agreeing to the terms.
// Everyone starts as a buyer; a name, a cell number and selling come later in the profile.

import { signUp } from '../auth/api.js';
import { checkSignUp, passwordRules } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { demoStrip } from '../shell.js';
import { el, brand, field, messageBox, linkTo, whileBusy, passwordChecklist } from '../dom.js';

export function renderSignUp() {
  const email = field({ id: 'email', label: 'Email address', type: 'email', autocomplete: 'email' });
  const password = field({ id: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' });
  const agree = el('input', { type: 'checkbox', id: 'agree', class: 'check__box' });
  const agreeError = el('p', { class: 'field__error', id: 'agree-error' });
  agreeError.hidden = true;
  const agreeRow = el('div', { class: 'field' }, [
    el('label', { class: 'check', for: 'agree' }, [
      agree,
      el('span', { class: 'check__label' }, ['I agree to the ', linkTo('#/terms', 'Terms'), ' and the ', linkTo('#/privacy', 'Privacy Policy')]),
    ]),
    agreeError,
  ]);
  const message = messageBox();
  const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Create account' });

  const form = el('form', { class: 'form', novalidate: '' }, [
    email.node,
    password.node,
    passwordChecklist(password.input, passwordRules),
    agreeRow,
    message.node,
    el('div', { class: 'push-down stack' }, [
      submit,
      el('p', { class: 'link-row' }, ['Already have an account? ', linkTo('#/signin', 'Log in')]),
    ]),
  ]);

  const intro = el('div', { class: 'stack' }, [
    el('h1', { class: 'title', text: 'Join Hamba' }),
    el('p', { class: 'lead', text: 'Shop local brands, vote on new designs and run safe. Free, and it takes a few seconds.' }),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const values = { email: email.input.value, password: password.input.value, agreed: agree.checked };
    const { ok, errors } = checkSignUp(values);
    email.setError(errors.email ?? null);
    password.setError(errors.password ?? null);
    agreeError.textContent = errors.agreed ?? '';
    agreeError.hidden = !errors.agreed;
    if (!ok) return;

    await whileBusy(submit, 'Creating your account…', async () => {
      try {
        const { needsEmailConfirmation } = await signUp(values);
        if (needsEmailConfirmation) {
          // Only while "Confirm email" is switched on in Supabase.
          intro.replaceWith(el('div', { class: 'stack' }, [
            el('h1', { class: 'title', text: 'Check your email' }),
            el('p', { class: 'lead', text: `We sent a link to ${values.email.trim()}. Open it in this browser and you are in.` }),
          ]));
          form.replaceWith(el('p', { class: 'link-row' }, ['Opened it already? ', linkTo('#/signin', 'Log in')]));
        }
        // Otherwise the person is signed in at once and the app moves on by itself.
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  return [brand(), ...demoStrip(), intro, form];
}
