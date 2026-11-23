import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend } from '../src/auth/demo.js';

function memory() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), raw: data };
}

test('demo accounts: sign up, log out, log in, wrong password', async () => {
  const store = memory();
  const demo = createDemoBackend(store);
  const events = [];
  await demo.onAuthChange((event) => events.push(event));
  assert.equal(await demo.currentSession(), null);
  assert.deepEqual(await demo.signUp({ email: 'a@b.co', password: 'Passw0rd!' }), { needsEmailConfirmation: false });
  const session = await demo.currentSession();
  assert.equal(session.user.email, 'a@b.co');
  await assert.rejects(demo.signUp({ email: 'a@b.co', password: 'Other-pass1' }), { code: 'user_already_exists' });
  await demo.signOut();
  assert.equal(await demo.currentSession(), null);
  await assert.rejects(demo.signIn({ email: 'a@b.co', password: 'wrong' }), { code: 'invalid_credentials' });
  await assert.rejects(demo.signIn({ email: 'nobody@b.co', password: 'Passw0rd!' }), { code: 'invalid_credentials' });
  await demo.signIn({ email: 'a@b.co', password: 'Passw0rd!' });
  assert.deepEqual(events, ['SIGNED_IN', 'SIGNED_OUT', 'SIGNED_IN']);
});

test('demo passwords are never stored as typed', async () => {
  const store = memory();
  const demo = createDemoBackend(store);
  await demo.signUp({ email: 'a@b.co', password: 'Passw0rd!' });
  assert.equal([...store.raw.values()].join('').includes('Passw0rd!'), false);
});

test('demo profile starts as a buyer and saves changes', async () => {
  const demo = createDemoBackend(memory());
  await demo.signUp({ email: 'a@b.co', password: 'Passw0rd!' });
  const { user } = await demo.currentSession();
  const profile = await demo.getProfile(user.id);
  assert.equal(profile.role, 'buyer');
  assert.equal(profile.email_notifications, true);
  const saved = await demo.updateProfile(user.id, { full_name: 'Lerato', role: 'seller', phone: '+27821234567', email_notifications: false });
  assert.equal(saved.role, 'seller');
  assert.deepEqual(await demo.getProfile(user.id), saved);
  assert.equal(await demo.isAdmin(), false);
  await demo.signUp({ email: 'admin@hamba.test', password: 'Passw0rd!' });
  assert.equal(await demo.isAdmin(), true);
});

test('demo password reset opens the new-password screen only for a real account', async () => {
  const demo = createDemoBackend(memory());
  const events = [];
  await demo.onAuthChange((event) => events.push(event));
  await demo.signUp({ email: 'a@b.co', password: 'Passw0rd!' });
  await demo.signOut();
  assert.deepEqual(await demo.requestPasswordReset('nobody@b.co'), { demoLinkOpened: false });
  assert.deepEqual(await demo.requestPasswordReset('a@b.co'), { demoLinkOpened: true });
  assert.equal(events.at(-1), 'PASSWORD_RECOVERY');
  await assert.rejects(demo.setNewPassword('Passw0rd!'), { code: 'same_password' });
  await demo.setNewPassword('N3w-password');
  await demo.signOut();
  await demo.signIn({ email: 'a@b.co', password: 'N3w-password' });
});
