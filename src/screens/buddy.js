// What a buddy sees when they open the private link: the runner's latest
// location (updated every 10 seconds), and an alert if SOS is on.
// No account needed; only someone with the link can see it.

import { getShare } from '../community/api.js';
import { EMERGENCY, CHECK_EVERY_MS, ago, isStale, shareEnded, formatCoords, mapsLink, isShareToken } from '../community/rules.js';
import { isDemo } from '../auth/api.js';
import { el, brand } from '../dom.js';

let stopPolling = () => {};

/** A small map from OpenStreetMap with a marker, about 600 m across. */
function mapFor(lat, lng) {
  const d = 0.004;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return el('iframe', { class: 'buddy-map', src, title: 'Map of the runner’s location', loading: 'lazy', referrerpolicy: 'no-referrer' });
}

export async function renderBuddy({ route }) {
  stopPolling();
  const token = route.id;
  const body = el('div', { class: 'stack' });
  const live = el('span', { class: 'buddy-live' }, [el('span', { class: 'live-dot live-dot--on', 'aria-hidden': 'true' }), ' Live · updates every 10 s']);

  let lastKey = '';
  async function draw() {
    let share = null;
    try {
      share = isShareToken(token) ? await getShare(token) : null;
    } catch {
      if (!body.childElementCount) body.replaceChildren(el('p', { class: 'message message--error', role: 'alert', text: 'Could not load the location. Check your connection; this page keeps trying.' }));
      return;
    }
    if (shareEnded(share)) {
      stopPolling();
      live.hidden = true;
      body.replaceChildren(el('h1', { class: 'title', text: 'This run has ended' }), el('p', { class: 'lead', text: 'The runner stopped sharing and their location was deleted. If you are worried, call them.' }), ...(isDemo() ? [el('p', { class: 'field__hint', text: 'Demo mode: links only work in the browser that started the share.' })] : []));
      return;
    }
    const key = `${share.lat},${share.lng},${share.sos}`;
    const first = share.runner_name.split(' ')[0];
    const parts = [el('h1', { class: 'title', text: `${first}’s run` })];
    if (share.sos) {
      parts.push(el('div', { class: 'sos-on', role: 'alert' }, [
        el('b', { text: `SOS: ${first} needs help` }),
        el('span', { text: 'Call them first. If they don’t answer, call the police or 112 and give the location below.' }),
        el('span', {}, EMERGENCY.flatMap((e, i) => [i ? ' · ' : '', `${e.name} `, el('a', { href: `tel:${e.number}`, text: e.number })])),
      ]));
    }
    if (share.lat === null || share.lat === undefined) {
      parts.push(el('p', { class: 'lead', text: `Waiting for ${first}’s phone to send a location…` }));
    } else {
      const stale = isStale(share.updated_at);
      parts.push(el('div', { class: stale ? 'buddy-where buddy-where--stale' : 'buddy-where' }, [
        el('b', { text: `Updated ${ago(share.updated_at)}` }),
        ...(stale ? [el('span', { text: 'No update for a while: their screen may be off or they may have no signal.' })] : []),
        el('span', { class: 'line__meta', text: `${formatCoords(share.lat, share.lng)}${share.accuracy ? ` · within about ${Math.round(share.accuracy)} m` : ''}` }),
        el('a', { href: mapsLink(share.lat, share.lng), class: 'button button--primary', target: '_blank', rel: 'noopener', text: 'Open in Google Maps' }),
      ]));
      // Only reload the map when the location moved, so it does not flicker.
      parts.push(key === lastKey && body.querySelector('.buddy-map') ? body.querySelector('.buddy-map') : mapFor(share.lat, share.lng));
    }
    lastKey = key;
    body.replaceChildren(...parts);
  }

  await draw();
  const timer = setInterval(draw, CHECK_EVERY_MS);
  stopPolling = () => clearInterval(timer);
  const leave = () => { if (!window.location.hash.startsWith('#/live/')) { stopPolling(); window.removeEventListener('hashchange', leave); } };
  window.addEventListener('hashchange', leave);

  return [el('div', { class: 'topbar' }, [brand(), live]), body, el('p', { class: 'field__hint', text: 'Only people with this link can see this page. It stops when the runner ends sharing.' })];
}
