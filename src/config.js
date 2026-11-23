// Where Hamba's accounts and data live (Supabase, free plan to start).
// The publishable key is meant to be public: it only reaches what the
// database's row-level security rules allow. Never put a secret key here.
//
// Fill these in from Supabase: Project Settings, API Keys (and the Project URL).
// While they are empty, Hamba runs in demo mode: accounts are kept only in
// this browser, so every screen can be tried before the database exists.

export const SUPABASE_URL = 'https://vwwelmakmloiylfevnlv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hXNixZVnTtgzg7vrTon5NQ_s-H6O-Ir';

/** Whether the app has been connected to its Supabase project yet. */
export function isConfigured() {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');
}
