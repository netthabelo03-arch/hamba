import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkName, checkOptionalName, checkEmail, checkPassword, passwordRules, checkRole, checkSignUp, cleanEmail, normalizePhone, showPhone, ROLES } from '../src/auth/validate.js';
import { friendlyAuthError, GENERIC_ERROR, OFFLINE_ERROR } from '../src/auth/errors.js';

const GOOD = { email: 'lerato@example.com', password: 'Run-Jozi-1', agreed: true };

test('sign-up needs an email, a strong password and agreeing to the terms', () => {
  assert.deepEqual(checkSignUp(GOOD), { ok: true, errors: {} });
  const result = checkSignUp({ ...GOOD, agreed: false });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors), ['agreed']);
});

test('each wrong sign-up field gets its own error', () => {
  const { ok, errors } = checkSignUp({ email: 'nope', password: 'short', agreed: false });
  assert.equal(ok, false);
  assert.deepEqual(Object.keys(errors).sort(), ['agreed', 'email', 'password']);
});

test('names are optional, but 2 to 80 characters when given', () => {
  assert.equal(checkOptionalName(''), null);
  assert.equal(checkOptionalName('  '), null);
  assert.equal(checkName('Jo'), null);
  for (const bad of ['A', 'x'.repeat(81)]) assert.notEqual(checkOptionalName(bad), null);
});

test('emails must look like an address', () => {
  for (const good of ['a@b.co', '  lerato@example.com  ']) assert.equal(checkEmail(good), null);
  for (const bad of ['', 'lerato', 'lerato@', '@example.com', 'lerato@example', null]) assert.notEqual(checkEmail(bad), null);
  assert.equal(cleanEmail('  Lerato@Example.COM '), 'lerato@example.com');
});

test('a password missing any one rule is refused, and shows which', () => {
  assert.equal(checkPassword('Passw0rd!'), null);
  const cases = { 'Ab3$efg': 'length', 'passw0rd!': 'upper', 'PASSW0RD!': 'lower', 'Password!': 'number', 'Passw0rdd': 'symbol' };
  for (const [password, missing] of Object.entries(cases)) {
    assert.notEqual(checkPassword(password), null);
    assert.deepEqual(passwordRules(password).filter((r) => !r.met).map((r) => r.id), [missing]);
  }
  assert.equal(checkPassword(''), 'Enter a password.');
});

test('only buyer and seller can be chosen, never admin', () => {
  assert.deepEqual(ROLES.map((r) => r.id), ['buyer', 'seller']);
  for (const good of ['buyer', 'seller']) assert.equal(checkRole(good), null);
  for (const bad of ['admin', 'Seller', '', null]) assert.notEqual(checkRole(bad), null);
});

test('South African cell numbers are stored as +27 and shown as 0XX XXX XXXX', () => {
  for (const typed of ['082 123 4567', '0821234567', '+27 82 123 4567', '27821234567', '(082) 123-4567']) {
    assert.equal(normalizePhone(typed), '+27821234567');
  }
  for (const bad of ['011 123 4567', '082 123 456', '+44 7700 900123', '', 'phone']) assert.equal(normalizePhone(bad), null);
  assert.equal(showPhone('+27821234567'), '082 123 4567');
});

test('service errors become plain sentences', () => {
  assert.equal(friendlyAuthError({ code: 'invalid_credentials' }), 'Email or password is incorrect.');
  assert.match(friendlyAuthError({ code: 'user_already_exists' }), /already exists/);
  assert.match(friendlyAuthError({ code: 'not_configured' }), /not switched on/);
  assert.equal(friendlyAuthError({ code: 42501 }), 'You are not allowed to do that.');
  assert.equal(friendlyAuthError(new TypeError('Failed to fetch')), OFFLINE_ERROR);
  assert.equal(friendlyAuthError({ code: 'toString' }), GENERIC_ERROR);
  assert.equal(friendlyAuthError(null), GENERIC_ERROR);
});
