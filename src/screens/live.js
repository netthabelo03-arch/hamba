// Sharing my run: a private link for a buddy, my live location while this
// screen is open, SOS, and ending (which deletes my location).

import { startShare, myShare, sendLocation, setSos, endShare } from '../community/api.js';
import { EMERGENCY, SEND_EVERY_MS, whatsappLink, shouldSend, ago, shareEnded } from '../community/rules.js';
import { screenHead } from '../community/ui.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { displayName } from '../shell.js';
import { el, whileBusy, messageBox } from '../dom.js';

/** The buddy link for a share code. */
export function buddyUrl(token) {
  return `${window.location.origin}${window.location.pathname}#/live/${token}`;
}

let stopWatching = () => {};

export async function renderLive({ session, navigate }) {
  stopWatching();
  const { profile } = await loadViewer(session);
  const raw = displayName(profile, session);
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  let share = await myShare(session.user.id);
  if (shareEnded(share)) share = null;

  const message = messageBox();
  if (!share) {
    const start = el('button', { type: 'button', class: 'button button--primary', text: 'Start sharing' });
    start.addEventListener('click', () => whileBusy(start, 'Starting…', async () => {
      try { await startShare(session.user.id, name); navigate('#/run/live'); } catch (e) { message.show(friendlyAuthError(e)); }
    }));
    return [
      screenHead('Share my run', '#/run'),
      el('ul', { class: 'plain-list' }, [
        el('li', { text: 'You get a private link to send to a buddy on WhatsApp.' }),
        el('li', { text: 'Your buddy sees where you are, updated every 15 seconds while this screen is open.' }),
        el('li', { text: 'SOS shows your buddy an alert with the emergency numbers.' }),
        el('li', { text: 'When you end sharing, your location is deleted. Shares end by themselves after 4 hours.' }),
      ]),
      message.node,
      start,
    ];
  }

  const url = buddyUrl(share.token);
  const link = el('input', { class: 'input', value: url, readonly: '', 'aria-label': 'Share link' });
  const copy = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Copy' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied'; } catch { link.select(); copy.textContent = 'Select and copy'; }
  });

  const dot = el('span', { class: 'live-dot', 'aria-hidden': 'true' });
  const statusTitle = el('b', { text: 'Waiting for your location…' });
  const statusText = el('span', { class: 'line__meta', text: 'Allow location when your phone asks.' });
  const status = el('div', { class: 'live-status' }, [dot, el('div', { class: 'line__body' }, [statusTitle, statusText])]);

  let sos = share.sos === true;
  const sosBox = el('div');
  function drawSos() {
    if (sos) {
      const off = el('button', { type: 'button', class: 'button button--quiet', text: 'I’m safe, turn SOS off' });
      off.addEventListener('click', () => toggleSos(false, off));
      sosBox.replaceChildren(el('div', { class: 'sos-on', role: 'alert' }, [
        el('b', { text: 'SOS is on' }),
        el('span', { text: 'Your buddy sees an alert and your last location.' }),
        el('span', {}, ['Call: ', ...EMERGENCY.flatMap((e, i) => [i ? ' · ' : '', `${e.name} `, el('a', { href: `tel:${e.number}`, text: e.number })])]),
        off,
      ]));
    } else {
      const on = el('button', { type: 'button', class: 'sos', text: 'SOS' });
      on.addEventListener('click', () => toggleSos(true, on));
      sosBox.replaceChildren(on, el('p', { class: 'field__hint sos-note', text: 'Alerts your buddy. It doesn’t call emergency services.' }));
    }
  }
  async function toggleSos(next, button) {
    await whileBusy(button, '…', async () => {
      try { await setSos(share.token, next); sos = next; last = last ? { ...last, sos: next } : last; drawSos(); } catch (e) { message.show(friendlyAuthError(e)); }
    });
  }
  drawSos();

  const end = el('button', { type: 'button', class: 'button button--quiet', text: 'End sharing and delete my location' });
  end.addEventListener('click', () => whileBusy(end, 'Ending…', async () => {
    try { stopWatching(); await endShare(share.token); navigate('#/run'); } catch (e) { message.show(friendlyAuthError(e)); }
  }));

  // Watch the location while this screen is open, and keep the screen awake.
  let last = null;
  let watchId = null;
  let wakeLock = null;
  let timer = null;
  function showSent(position) {
    statusTitle.textContent = 'Sharing live';
    statusText.textContent = `Last sent ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} · accurate to about ${Math.round(position.accuracy)} m`;
    dot.classList.add('live-dot--on');
  }
  async function send(position, force = false) {
    const next = { lat: position.latitude, lng: position.longitude, accuracy: position.accuracy, sos };
    if (!force && !shouldSend(last, next)) return;
    try {
      await sendLocation(share.token, next);
      last = { ...next, sentAt: Date.now() };
      showSent(position);
    } catch (e) {
      statusTitle.textContent = 'Could not send your location';
      statusText.textContent = `${friendlyAuthError(e)} Hamba keeps trying.`;
    }
  }
  if (!('geolocation' in navigator)) {
    statusTitle.textContent = 'This browser cannot share location';
    statusText.textContent = 'Open Hamba in Chrome or Safari on your phone.';
  } else {
    let latest = null;
    watchId = navigator.geolocation.watchPosition(
      (p) => { latest = p.coords; send(p.coords); },
      (error) => {
        statusTitle.textContent = error.code === 1 ? 'Location is blocked' : 'Finding your location…';
        statusText.textContent = error.code === 1 ? 'Allow location for Hamba in your browser settings, then reopen this screen. (Previews inside Claude cannot share location; use the live app.)' : 'Move to an open area if this takes long.';
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    // Send at least every 15 seconds even when standing still, so the buddy knows the phone is on.
    timer = setInterval(() => { if (latest) send(latest, Date.now() - (last?.sentAt ?? 0) >= SEND_EVERY_MS); }, SEND_EVERY_MS);
  }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed: fine */ }
  stopWatching = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
    watchId = null;
  };
  const leave = () => { if (!window.location.hash.startsWith('#/run/live')) { stopWatching(); window.removeEventListener('hashchange', leave); } };
  window.addEventListener('hashchange', leave);

  return [
    screenHead('Sharing my run', '#/run'),
    el('div', { class: 'share-card' }, [
      el('span', { text: 'Send this private link to your buddy:' }),
      el('div', { class: 'copy-row' }, [link, copy]),
      el('a', { href: whatsappLink(url, name), class: 'button button--primary', target: '_blank', rel: 'noopener', text: 'Send on WhatsApp' }),
    ]),
    status,
    el('p', { class: 'field__hint', text: `Keep this screen open while you run; phones stop sharing location from closed screens. Started ${ago(share.started_at)}.` }),
    sosBox,
    message.node,
    end,
  ];
}
