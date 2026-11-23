// Run safe: share my run, crews to run with, and routes rated by runners.
// Also the forms to start a crew (#/run/crew) and add a route (#/run/route).

import { listCrews, joinCrew, createCrew, listRoutes, rateRoute, addRoute } from '../community/api.js';
import { crewSchedule, feltSafe, checkCrew, checkRoute, WEEKDAYS } from '../community/rules.js';
import { needLogin, reportControl, screenHead } from '../community/ui.js';
import { input, showErrors, sampleNote } from '../market/ui.js';
import { isDemo } from '../auth/api.js';
import { friendlyAuthError } from '../auth/errors.js';
import { tabBar } from '../shell.js';
import { el, whileBusy, messageBox } from '../dom.js';

let areaFilter = '';

export async function renderRun({ session, navigate }) {
  const userId = session?.user?.id ?? null;
  const [crews, routes] = await Promise.all([listCrews(userId), listRoutes(userId)]);

  const share = el('div', { class: 'share-card' }, [
    el('b', { class: 'share-card__title', text: 'Share my run' }),
    el('span', { text: 'Send a buddy a private live map. It stops when you finish.' }),
    el('a', { href: '#/run/live', class: 'button button--primary', text: 'Start sharing my location' }),
  ]);

  const areas = [...new Set([...crews.map((c) => c.area), ...routes.map((r) => r.area)])].sort();
  const area = el('select', { class: 'input input--small', 'aria-label': 'Area' }, [el('option', { value: '', text: 'All areas' }), ...areas.map((a) => el('option', { value: a, text: a }))]);
  area.value = areas.includes(areaFilter) ? areaFilter : '';
  const crewList = el('div', { class: 'stack' });
  const routeList = el('div', { class: 'stack' });

  function crewRow(crew) {
    const button = el('button', { type: 'button', class: crew.joined ? 'vote vote--on' : 'vote vote--pink', 'aria-pressed': String(crew.joined), text: crew.joined ? 'Joined' : 'Join' });
    const error = el('p', { class: 'field__error', role: 'alert' });
    error.hidden = true;
    button.addEventListener('click', () => {
      if (!userId) { needLogin(navigate); return; }
      whileBusy(button, '…', async () => {
        try {
          await joinCrew(crew.id, userId, !crew.joined);
          crew.joined = !crew.joined;
          crew.members += crew.joined ? 1 : -1;
          row.replaceWith(crewRow(crew));
        } catch (e) { error.textContent = friendlyAuthError(e); error.hidden = false; }
      });
    });
    const { button: reportButton, holder } = reportControl({ kind: 'crew', itemId: crew.id, session, navigate });
    const row = el('div', { class: 'crew' }, [
      el('div', { class: 'line__body' }, [
        el('b', { text: crew.name }),
        el('span', { class: 'line__meta', text: `${crew.area} · ${crewSchedule(crew)} · ${crew.members} runner${crew.members === 1 ? '' : 's'}` }),
        ...(crew.pace ? [el('span', { class: 'line__meta', text: crew.pace })] : []),
        el('div', { class: 'line__actions' }, [reportButton]),
        holder,
        error,
      ]),
      button,
    ]);
    return row;
  }

  function routeRow(route) {
    const { percent, count } = feltSafe(route.ratings ?? []);
    const mine = route.ratings?.find((r) => r.user_id === userId);
    const answer = (safe) => {
      const b = el('button', { type: 'button', class: mine && mine.safe === safe ? 'chip-link chip-link--small' : 'chip-link chip-link--small', text: safe ? 'Yes' : 'No' });
      b.setAttribute('aria-pressed', String(Boolean(mine) && mine.safe === safe));
      b.addEventListener('click', () => {
        if (!userId) { needLogin(navigate); return; }
        whileBusy(b, '…', async () => {
          try {
            await rateRoute(route.id, userId, safe);
            route.ratings = [...(route.ratings ?? []).filter((r) => r.user_id !== userId), { user_id: userId, safe }];
            row.replaceWith(routeRow(route));
          } catch (e) { b.after(el('span', { class: 'field__error', text: friendlyAuthError(e) })); }
        });
      });
      return b;
    };
    const tone = percent === null ? 'none' : percent >= 70 ? 'good' : percent >= 50 ? 'mid' : 'low';
    const { button: reportButton, holder } = reportControl({ kind: 'route', itemId: route.id, session, navigate });
    const row = el('div', { class: 'route' }, [
      el('div', { class: 'line__body' }, [
        el('b', { text: route.name }),
        el('span', { class: 'line__meta', text: [route.area, `${route.distance_km} km`, route.tip].filter(Boolean).join(' · ') }),
        el('div', { class: 'route__ask' }, [el('span', { class: 'line__meta', text: 'Did you feel safe here?' }), answer(true), answer(false)]),
        el('div', { class: 'line__actions' }, [reportButton]),
        holder,
      ]),
      el('div', { class: `safe safe--${tone}` }, [el('b', { text: percent === null ? '–' : `${percent}%` }), el('span', { text: percent === null ? `${count} of 3 answers` : `felt safe (${count})` })]),
    ]);
    return row;
  }

  function draw() {
    areaFilter = area.value;
    const shownCrews = crews.filter((c) => !areaFilter || c.area === areaFilter);
    const shownRoutes = routes.filter((r) => !areaFilter || r.area === areaFilter);
    crewList.replaceChildren(...(shownCrews.length ? shownCrews.map(crewRow) : [el('p', { class: 'lead', text: 'No crews here yet. Start one.' })]));
    routeList.replaceChildren(...(shownRoutes.length ? shownRoutes.map(routeRow) : [el('p', { class: 'lead', text: 'No routes here yet. Add one you know.' })]));
  }
  area.addEventListener('change', draw);
  draw();

  return [
    screenHead('Run safe'),
    share,
    el('div', { class: 'filters' }, [area]),
    el('div', { class: 'section-head' }, [el('h2', { class: 'section-title', text: areaFilter ? `Crews in ${areaFilter}` : 'Crews' }), el('a', { href: '#/run/crew', class: 'see-all', text: 'Start a crew' })]),
    crewList,
    el('div', { class: 'section-head' }, [el('h2', { class: 'section-title', text: 'Routes rated by runners' }), el('a', { href: '#/run/route', class: 'see-all', text: 'Add a route' })]),
    routeList,
    ...sampleNote(isDemo()),
    tabBar('home'),
  ];
}

export function renderRunCrew({ session, navigate }) {
  const fields = {
    name: input({ id: 'c-name', label: 'Crew name' }),
    area: input({ id: 'c-area', label: 'Area', hint: 'Where you meet, like Soweto or Durban North.' }),
    time: input({ id: 'c-time', label: 'Start time', type: 'time', value: '05:30' }),
    pace: input({ id: 'c-pace', label: 'Pace (optional)', hint: 'Like "Easy, 6 to 7 min/km" or "All paces".' }),
  };
  const dayBoxes = WEEKDAYS.map((d) => {
    const box = el('input', { type: 'checkbox', id: `c-day-${d}`, value: d, class: 'check__box' });
    return { d, box, node: el('label', { class: 'day', for: box.id }, [box, el('span', { text: d })]) };
  });
  const daysError = el('p', { class: 'field__error', role: 'alert' });
  daysError.hidden = true;
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: 'Start crew' });
  const form = el('form', { class: 'form', novalidate: '' }, [
    fields.name.node, fields.area.node,
    el('fieldset', { class: 'field days' }, [el('legend', { class: 'field__label', text: 'Run days' }), el('div', { class: 'days__row' }, dayBoxes.map((x) => x.node)), daysError]),
    fields.time.node, fields.pace.node, message.node, save,
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { ok, errors, value } = checkCrew({ name: fields.name.input.value, area: fields.area.input.value, time: fields.time.input.value, pace: fields.pace.input.value, days: dayBoxes.filter((x) => x.box.checked).map((x) => x.d) });
    showErrors(fields, errors);
    daysError.textContent = errors.days ?? '';
    daysError.hidden = !errors.days;
    if (!ok) return;
    await whileBusy(save, 'Saving…', async () => {
      try { await createCrew(session.user.id, value); navigate('#/run'); } catch (e) { message.show(friendlyAuthError(e)); }
    });
  });
  return [screenHead('Start a crew', '#/run'), el('p', { class: 'lead', text: 'Meet in a public place and never leave a runner behind.' }), form, tabBar('home')];
}

export function renderRunRoute({ session, navigate }) {
  const fields = {
    name: input({ id: 'r-name', label: 'Route name', hint: 'Start and end, like "Vilakazi St to Orlando Stadium".' }),
    area: input({ id: 'r-area', label: 'Area' }),
    distanceKm: input({ id: 'r-km', label: 'Distance (km)', inputmode: 'decimal' }),
    tip: input({ id: 'r-tip', label: 'Safety tip (optional)', hint: 'Like "best before 18:00" or "lit until 19:00".' }),
  };
  const message = messageBox();
  const save = el('button', { type: 'submit', class: 'button button--primary', text: 'Add route' });
  const form = el('form', { class: 'form', novalidate: '' }, [...Object.values(fields).map((f) => f.node), message.node, save]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { ok, errors, value } = checkRoute(Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value])));
    showErrors(fields, errors);
    if (!ok) return;
    await whileBusy(save, 'Saving…', async () => {
      try { await addRoute(session.user.id, value); navigate('#/run'); } catch (e) { message.show(friendlyAuthError(e)); }
    });
  });
  return [screenHead('Add a route', '#/run'), el('p', { class: 'lead', text: 'Other runners answer "Did you feel safe here?". The % shows once 3 have answered.' }), form, tabBar('home')];
}
