// Log-in screen.

import { signIn } from '../auth/api.js';
import { checkEmail } from '../auth/validate.js';
import { friendlyAuthError } from '../auth/errors.js';
import { peekNext } from '../next.js';
import { demoStrip } from '../shell.js';
import { el, brand, field, messageBox, linkTo, whileBusy } from '../dom.js';

export function renderSignIn() {
  const email = field({ id: 'email', label: 'Email address', type: 'email', autocomplete: 'email' });
  const password = field({ id: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' });
  const message = messageBox();
  const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Log in' });
  const forgot = linkTo('#/forgot', 'Forgot password?');
  forgot.className = 'text-link';

  const form = el('form', { class: 'form', novalidate: '' }, [
    email.node,
    password.node,
    forgot,
    message.node,
    el('div', { class: 'push-down stack' }, [
      submit,
      el('p', { class: 'link-row' }, ['New to Hamba? ', linkTo('#/signup', 'Create an account')]),
    ]),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const emailError = checkEmail(email.input.value);
    const passwordError = password.input.value.length === 0 ? 'Enter your password.' : null;
    email.setError(emailError);
    password.setError(passwordError);
    if (emailError || passwordError) return;
    await whileBusy(submit, 'Logging in…', async () => {
      try {
        await signIn({ email: email.input.value, password: password.input.value });
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  const sentHere = peekNext() !== null;
  return [
    brand(),
    ...demoStrip(),
    el('div', { class: 'stack' }, [
      el('h1', { class: 'title', text: sentHere ? 'Log in to carry on' : 'Welcome back' }),
      el('p', { class: 'lead', text: sentHere ? 'You only need to log in once on this phone.' : 'Log in to your Hamba account.' }),
    ]),
    form,
  ];
}
