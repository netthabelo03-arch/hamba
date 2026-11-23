// Settings kept on this device: low-data mode.
// Low-data mode loads no web fonts (and, from Sprint 1, no product photos
// until tapped), for people on slow or expensive mobile data.

const LOW_DATA_KEY = 'hamba.lowData';

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isLowData() {
  return store()?.getItem(LOW_DATA_KEY) === '1';
}

export function setLowData(on) {
  const s = store();
  if (!s) return;
  if (on) s.setItem(LOW_DATA_KEY, '1');
  else s.removeItem(LOW_DATA_KEY);
  globalThis.document?.documentElement.classList.toggle('low-data', Boolean(on));
}
