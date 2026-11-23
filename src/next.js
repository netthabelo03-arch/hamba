// Remembers where a signed-out person was going, so that after logging in
// they land there instead of on Home.

const KEY = 'hamba.next';

function store() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Only addresses inside the app ("#/..."), never another site. */
export function isSafeNext(hash) {
  return typeof hash === 'string' && /^#\/[\w\-/]*$/.test(hash);
}

export function saveNext(hash) {
  if (isSafeNext(hash)) store()?.setItem(KEY, hash);
}

export function peekNext() {
  const hash = store()?.getItem(KEY) ?? null;
  return isSafeNext(hash) ? hash : null;
}

export function takeNext() {
  const hash = peekNext();
  store()?.removeItem(KEY);
  return hash;
}
