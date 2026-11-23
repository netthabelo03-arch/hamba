// Turns an error from the accounts service into a sentence a person can act on.

const SETUP_MISSING = 'The database setup for this feature has not been run yet.';

const BY_CODE = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Open the link we sent you, then log in.',
  user_already_exists: 'An account with this email already exists. Log in instead.',
  email_exists: 'An account with this email already exists. Log in instead.',
  weak_password: 'That password is too easy to guess. Choose a longer one.',
  same_password: 'Choose a password you have not used before.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  signup_disabled: 'New sign-ups are switched off at the moment.',
  email_address_invalid: 'That email address was not accepted. Check it and try again.',
  session_not_found: 'You have been logged out. Log in again.',
  not_configured: 'Accounts are not switched on yet. Hamba still needs to be connected to its database.',
  42501: 'You are not allowed to do that.',
  23505: 'You already have one of these. Refresh the page to see it.',
  demo_full: 'This browser has no room left for more demo photos. Use fewer or smaller photos.',
  'storage/too-large': 'That photo is too big. Choose one under 8 MB.',
  '42P01': SETUP_MISSING,
  PGRST205: SETUP_MISSING,
  PGRST202: SETUP_MISSING,
};

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const OFFLINE_ERROR = 'No connection. Check your internet and try again.';

/** @returns {string} a message to show for what the accounts service or the browser threw */
export function friendlyAuthError(error) {
  if (error && typeof error === 'object') {
    const code = error.code;
    if ((typeof code === 'string' || typeof code === 'number') && Object.hasOwn(BY_CODE, code)) return BY_CODE[code];
    const message = typeof error.message === 'string' ? error.message : '';
    if (/row-level security/i.test(message)) return BY_CODE[42501];
    if (error.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(message)) return OFFLINE_ERROR;
  }
  return GENERIC_ERROR;
}
