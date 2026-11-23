// Checks on what a person types into the account forms.
// Each check returns null when the value is fine, or a message to show.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 80;

/** How a person uses Hamba. Selling needs an approved shop (Sprint 1). */
export const ROLES = [
  { id: 'buyer', name: 'Shop', short: 'Buyer', about: 'Buy from local brands and makers' },
  { id: 'seller', name: 'Shop and sell', short: 'Seller', about: 'Open a shop and list your products' },
];

export function isRole(id) {
  return ROLES.some((role) => role.id === id);
}

export function findRole(id) {
  return ROLES.find((role) => role.id === id);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkName(value) {
  const name = String(value ?? '').trim();
  if (name.length < 2) return 'Enter your full name.';
  if (name.length > MAX_NAME_LENGTH) return `Use ${MAX_NAME_LENGTH} characters or fewer for your name.`;
  return null;
}

/** A name is optional (it can be added later), but if given it must be sensible. */
export function checkOptionalName(value) {
  return String(value ?? '').trim().length === 0 ? null : checkName(value);
}

export function checkEmail(value) {
  const email = String(value ?? '').trim();
  if (email.length === 0) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address, like name@example.com.';
  return null;
}

/**
 * The rules a new password must meet, with whether this value meets each one.
 * The screens show this list as a checklist while the person types.
 */
export function passwordRules(value) {
  const password = String(value ?? '');
  return [
    { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { id: 'upper', label: 'A capital letter', met: /\p{Lu}/u.test(password) },
    { id: 'lower', label: 'A small letter', met: /\p{Ll}/u.test(password) },
    { id: 'number', label: 'A number', met: /[0-9]/.test(password) },
    { id: 'symbol', label: 'A symbol, such as ! ? @ #', met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
}

/** Check a new password (sign-up and password reset). Logging in does not use this. */
export function checkPassword(value) {
  const password = String(value ?? '');
  if (password.length === 0) return 'Enter a password.';
  if (passwordRules(password).some((rule) => !rule.met)) return 'Your password is not strong enough yet. See the list below.';
  return null;
}

export function checkRole(value) {
  return isRole(value) ? null : 'Choose how you will use Hamba.';
}

/** The sign-up form: an email, a password and agreeing to the terms. */
export function checkSignUp({ email, password, agreed }) {
  const errors = {};
  const emailError = checkEmail(email);
  const passwordError = checkPassword(password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (agreed !== true) errors.agreed = 'Agree to the terms and privacy policy to continue.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Tidy an email before sending it: no spaces around it, lower case. */
export function cleanEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * A South African cell number in the form +27XXXXXXXXX, or null if it is not one.
 * Accepts 082 123 4567, 0821234567, +27 82 123 4567 and 27821234567.
 */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/[\s()-]/g, '');
  let national = null;
  if (/^0[6-8]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^\+?27[6-8]\d{8}$/.test(digits)) national = digits.replace(/^\+?27/, '');
  return national ? `+27${national}` : null;
}

/** +27821234567 shown as 082 123 4567. */
export function showPhone(value) {
  const match = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(String(value ?? ''));
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : String(value ?? '');
}
