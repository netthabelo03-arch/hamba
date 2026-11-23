// Demo accounts, kept only in this browser. Used while Hamba is not yet
// connected to Supabase, so every account screen can be tried and tested.
// Nothing leaves the device. Passwords are stored as SHA-256 fingerprints,
// never as typed, but this is still a demo: real accounts live in Supabase.

const KEY = 'hamba.demo.v1';

function memoryStore() {
  let value = null;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem: () => { value = null; } };
}

function pickStore() {
  try {
    const store = globalThis.localStorage;
    store.setItem('hamba.test', '1');
    store.removeItem('hamba.test');
    return store;
  } catch {
    return memoryStore();
  }
}

/** @param {Storage} [store] where to keep the demo data (tests pass their own) */
export function createDemoBackend(store = pickStore()) {
  const listeners = new Set();

  function load() {
    try {
      const data = JSON.parse(store.getItem(KEY) ?? 'null');
      if (data && typeof data === 'object' && data.users) return data;
    } catch { /* start fresh */ }
    return { users: {}, session: null };
  }
  function save(data) {
    store.setItem(KEY, JSON.stringify(data));
  }
  function emit(event, session) {
    for (const listener of listeners) listener(event, session);
  }
  async function fingerprint(email, password) {
    const bytes = new TextEncoder().encode(`hamba-demo:${email}:${password}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function sessionFor(user) {
    return { user: { id: user.id, email: user.email }, demo: true };
  }
  function findById(data, id) {
    return Object.values(data.users).find((user) => user.id === id) ?? null;
  }

  return {
    demo: true,
    async currentSession() {
      const data = load();
      const user = data.session ? findById(data, data.session) : null;
      return user ? sessionFor(user) : null;
    },
    async onAuthChange(listener) {
      listeners.add(listener);
    },
    async signUp({ email, password }) {
      const data = load();
      if (data.users[email]) throw { code: 'user_already_exists' };
      const user = {
        id: globalThis.crypto.randomUUID(),
        email,
        hash: await fingerprint(email, password),
        profile: { full_name: '', role: 'buyer', phone: null, email_notifications: true },
      };
      data.users[email] = user;
      data.session = user.id;
      save(data);
      emit('SIGNED_IN', sessionFor(user));
      return { needsEmailConfirmation: false };
    },
    async signIn({ email, password }) {
      const data = load();
      const user = data.users[email];
      if (!user || user.hash !== await fingerprint(email, password)) throw { code: 'invalid_credentials' };
      data.session = user.id;
      save(data);
      emit('SIGNED_IN', sessionFor(user));
    },
    async signOut() {
      const data = load();
      data.session = null;
      save(data);
      emit('SIGNED_OUT', null);
    },
    /** No email in demo mode: if the account exists, go straight to choosing a new password. */
    async requestPasswordReset(email) {
      const data = load();
      const user = data.users[email];
      if (!user) return { demoLinkOpened: false };
      data.session = user.id;
      save(data);
      emit('PASSWORD_RECOVERY', sessionFor(user));
      return { demoLinkOpened: true };
    },
    async setNewPassword(password) {
      const data = load();
      const user = data.session ? findById(data, data.session) : null;
      if (!user) throw { code: 'session_not_found' };
      const hash = await fingerprint(user.email, password);
      if (hash === user.hash) throw { code: 'same_password' };
      user.hash = hash;
      save(data);
    },
    async getProfile(userId) {
      const user = findById(load(), userId);
      return user ? { id: user.id, ...user.profile } : null;
    },
    async updateProfile(userId, changes) {
      const data = load();
      const user = findById(data, userId);
      if (!user) throw { code: 42501 };
      user.profile = { ...user.profile, ...changes };
      save(data);
      return { id: user.id, ...user.profile };
    },
    /** In demo mode, accounts whose email starts with "admin@" are admins, to try shop approval. */
    async isAdmin() {
      const data = load();
      const user = data.session ? findById(data, data.session) : null;
      return Boolean(user && user.email.startsWith('admin@'));
    },
  };
}
