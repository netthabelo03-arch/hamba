// Everything the screens need from the accounts service, in one place.
// Uses Supabase once config.js is filled in, and demo accounts (kept in this
// browser) until then. Each function throws on failure; screens show
// friendlyAuthError(error).

import { getClient } from './client.js';
import { createDemoBackend } from './demo.js';
import { cleanEmail } from './validate.js';
import { isConfigured } from '../config.js';

const PROFILE_COLUMNS = 'id, full_name, role, phone, email_notifications';

/** The address people are sent back to from an email link. */
function appUrl() {
  return window.location.origin + window.location.pathname;
}

const supabaseBackend = {
  demo: false,
  async currentSession() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  async onAuthChange(listener) {
    const client = await getClient();
    client.auth.onAuthStateChange((event, session) => listener(event, session));
  },
  async signUp({ email, password }) {
    const client = await getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { role: 'buyer' }, emailRedirectTo: appUrl() },
    });
    if (error) throw error;
    // An email that is already registered comes back with no identities, so
    // that accounts are not revealed to strangers. Treat it as "already exists".
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw { code: 'user_already_exists' };
    }
    return { needsEmailConfirmation: data.session === null };
  },
  async signIn({ email, password }) {
    const client = await getClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signOut() {
    const client = await getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
  async requestPasswordReset(email) {
    const client = await getClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (error) throw error;
    return { demoLinkOpened: false };
  },
  async setNewPassword(password) {
    const client = await getClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
  },
  async getProfile(userId) {
    const client = await getClient();
    const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async updateProfile(userId, changes) {
    const client = await getClient();
    const { data, error } = await client.from('profiles').update(changes).eq('id', userId).select(PROFILE_COLUMNS).single();
    if (error) throw error;
    return data;
  },
  async isAdmin() {
    const client = await getClient();
    const { data, error } = await client.rpc('is_admin');
    if (error) throw error;
    return data === true;
  },
};

let backend = null;
function use() {
  if (backend === null) backend = isConfigured() ? supabaseBackend : createDemoBackend();
  return backend;
}

/** Whether accounts are demo accounts kept in this browser. */
export function isDemo() {
  return use().demo === true;
}

/** @returns {Promise<object | null>} the signed-in session, or null */
export function currentSession() {
  return use().currentSession();
}

/** Call `listener(event, session)` on sign-in, sign-out and "PASSWORD_RECOVERY". */
export function onAuthChange(listener) {
  return use().onAuthChange(listener);
}

/** @returns {Promise<{ needsEmailConfirmation: boolean }>} */
export function signUp({ email, password }) {
  return use().signUp({ email: cleanEmail(email), password });
}

export function signIn({ email, password }) {
  return use().signIn({ email: cleanEmail(email), password });
}

export function signOut() {
  return use().signOut();
}

/** Email a link for choosing a new password (in demo mode, open it straight away). */
export function requestPasswordReset(email) {
  return use().requestPasswordReset(cleanEmail(email));
}

export function setNewPassword(password) {
  return use().setNewPassword(password);
}

/** @returns {Promise<{ id: string, full_name: string, role: string, phone: string | null, email_notifications: boolean } | null>} */
export function getProfile(userId) {
  return use().getProfile(userId);
}

export function updateProfile(userId, { fullName, role, phone = null, emailNotifications = true }) {
  return use().updateProfile(userId, {
    full_name: String(fullName ?? '').trim(),
    role,
    phone,
    email_notifications: Boolean(emailNotifications),
  });
}

/** Whether the signed-in person is an admin (admins approve shops from Sprint 1). */
export function isAdmin() {
  return use().isAdmin();
}
