import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionBlock, stampedIndex } from '../tools/stamp.mjs';
import { SUPABASE_PUBLISHABLE_KEY } from '../src/config.js';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html is stamped with the current file versions (run: npm run stamp)', () => {
  assert.equal(stampedIndex(index, versionBlock()), index);
});

test('no secret Supabase key is ever put in the app', () => {
  assert.equal(SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_'), false);
  assert.equal(/service_role|sb_secret_/.test(readFileSync(new URL('../src/config.js', import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '')), false);
});

test('the database script keeps admin out of the roles people can pick', () => {
  const sql = readFileSync(new URL('../supabase/001_profiles.sql', import.meta.url), 'utf8');
  assert.match(sql, /role in \('buyer', 'seller'\)/);
  assert.match(sql, /grant update \(full_name, role, phone, email_notifications\)/);
  assert.doesNotMatch(sql, /grant (insert|delete|all)[^;]*profiles to authenticated/i);
});
