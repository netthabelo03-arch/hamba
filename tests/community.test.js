import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOTE_GOAL, checkDesign, voteBlocked, voteProgress, sortDesigns, royaltyFor,
  checkCrew, crewSchedule, checkRoute, feltSafe, upsertRating,
  newShareToken, isShareToken, ago, isStale, shareEnded, formatCoords, mapsLink, whatsappLink, shouldSend, EMERGENCY, HIDE_AFTER_REPORTS,
} from '../src/community/rules.js';
import { createDemoCommunity } from '../src/community/api.js';

function memory() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('designs need a name, description, kind, picture and the own-work promise', () => {
  const good = { title: 'Kasi Gold runner', about: 'Gold and white runner.', kind: 'sneakers', hasImage: true, ownWork: true };
  assert.equal(checkDesign(good).ok, true);
  assert.deepEqual(Object.keys(checkDesign({}).errors).sort(), ['about', 'image', 'kind', 'ownWork', 'title']);
  assert.ok(checkDesign({ ...good, ownWork: false }).errors.ownWork);
});

test('one vote per member, never for your own design, only while open', () => {
  const design = { designer_id: 'musa', status: 'open' };
  assert.equal(voteBlocked(design, 'lerato'), null);
  assert.match(voteBlocked(design, 'musa'), /own design/);
  assert.match(voteBlocked(design, null), /Log in/);
  assert.match(voteBlocked({ ...design, status: 'made' }, 'lerato'), /closed/);
  assert.equal(VOTE_GOAL, 500);
  assert.equal(voteProgress(250), 50);
  assert.equal(voteProgress(900), 100);
  assert.equal(royaltyFor(89900), 4495);
  assert.deepEqual(sortDesigns([{ id: 'a', votes: 3, created_at: '1' }, { id: 'b', votes: 9, created_at: '0' }]).map((d) => d.id), ['b', 'a']);
  assert.deepEqual(sortDesigns([{ id: 'a', votes: 3, created_at: '1' }, { id: 'b', votes: 9, created_at: '0' }], 'new').map((d) => d.id), ['a', 'b']);
});

test('crews and routes are checked', () => {
  const crew = checkCrew({ name: 'Soweto Sunrise Runners', area: 'Soweto', days: ['Thu', 'Tue'], time: '05:30', pace: '' });
  assert.equal(crew.ok, true);
  assert.equal(crewSchedule(crew.value), 'Tue and Thu 05:30');
  assert.equal(crewSchedule({ days: ['Mon', 'Wed', 'Fri'], time: '18:00' }), 'Mon, Wed and Fri 18:00');
  assert.deepEqual(Object.keys(checkCrew({ name: 'A', area: '', days: [], time: '5.30' }).errors).sort(), ['area', 'days', 'name', 'time']);
  const route = checkRoute({ name: 'Zoo Lake loop', area: 'Johannesburg', distanceKm: '2,5', tip: 'lit until 19:00' });
  assert.equal(route.ok, true);
  assert.equal(route.value.distance_km, 2.5);
  assert.ok(checkRoute({ name: 'Zoo', area: 'Jhb', distanceKm: '0' }).errors.distanceKm);
});

test('"felt safe" shows once 3 runners answered, and each runner counts once', () => {
  assert.deepEqual(feltSafe([{ safe: true }, { safe: false }]), { percent: null, count: 2 });
  let ratings = [{ user_id: 'a', safe: true }, { user_id: 'b', safe: true }, { user_id: 'c', safe: false }];
  assert.deepEqual(feltSafe(ratings), { percent: 67, count: 3 });
  ratings = upsertRating(ratings, 'c', true);
  assert.deepEqual(feltSafe(ratings), { percent: 100, count: 3 }, 'changing an answer does not add a second one');
});

test('share links are long random codes; old or ended shares are treated as over', () => {
  const token = newShareToken();
  assert.equal(isShareToken(token), true);
  assert.notEqual(newShareToken(), token);
  assert.equal(isShareToken('short'), false);
  assert.equal(isShareToken('../../etc/passwd/xxxxxx'), false);
  const now = Date.parse('2026-11-23T10:00:00Z');
  assert.equal(ago('2026-11-23T09:59:40Z', now), 'just now');
  assert.equal(ago('2026-11-23T09:57:00Z', now), '3 min ago');
  assert.equal(isStale('2026-11-23T09:57:00Z', now), true);
  assert.equal(isStale('2026-11-23T09:59:00Z', now), false);
  assert.equal(shareEnded(null, now), true);
  assert.equal(shareEnded({ started_at: '2026-11-23T06:30:00Z' }, now), false);
  assert.equal(shareEnded({ started_at: '2026-11-23T05:59:00Z' }, now), true, 'ends by itself after 4 hours');
  assert.equal(formatCoords(-26.238912, 27.908621), '-26.23891, 27.90862');
  assert.match(mapsLink(-26.2389, 27.9086), /query=-26\.238900,27\.908600$/);
  assert.match(decodeURIComponent(whatsappLink('https://x/#/live/abc', 'Naledi')), /Naledi is sharing.*https:\/\/x\/#\/live\/abc/);
  assert.deepEqual(EMERGENCY.map((e) => e.number), ['10111', '112', '10177']);
});

test('location is sent every 15 seconds, and at once when SOS changes', () => {
  const last = { sos: false, sentAt: 1000 };
  assert.equal(shouldSend(null, { sos: false }, 1000), true);
  assert.equal(shouldSend(last, { sos: false }, 5000), false);
  assert.equal(shouldSend(last, { sos: true }, 5000), true);
  assert.equal(shouldSend(last, { sos: false }, 16000), true);
});

test('demo Studio: vote and un-vote, no self-votes, new designs wait for review', async () => {
  const c = createDemoCommunity(memory());
  const [gold] = (await c.listDesigns('lerato')).filter((d) => d.id === 'd-gold');
  assert.equal(gold.votes, 497);
  await c.vote('d-gold', 'lerato', true);
  await c.vote('d-gold', 'lerato', true);
  assert.equal((await c.listDesigns('lerato')).find((d) => d.id === 'd-gold').votes, 498, 'one vote per member');
  await c.vote('d-gold', 'lerato', false);
  assert.equal((await c.listDesigns('lerato')).find((d) => d.id === 'd-gold').votes, 497);
  await assert.rejects(c.vote('d-gold', 'sample-1', true), { code: 42501 });
  await c.submitDesign('thendo', 'Thendo N.', { title: 'Venda wave tee', about: 'Tee with Venda wave print.', kind: 'tee', image: 'data:x' });
  assert.equal((await c.listDesigns('x')).some((d) => d.title === 'Venda wave tee'), false);
  const [mine] = await c.myDesigns('thendo');
  assert.equal(mine.status, 'pending');
  await c.reviewDesign(mine.id, 'open', '');
  assert.equal((await c.listDesigns('x')).some((d) => d.title === 'Venda wave tee'), true);
});

test('demo Run safe: join and leave crews, rate routes once, share and end', async () => {
  const c = createDemoCommunity(memory());
  const before = (await c.listCrews('u1')).find((x) => x.id === 'c-sunrise');
  assert.deepEqual([before.members, before.joined], [84, false]);
  await c.joinCrew('c-sunrise', 'u1', true);
  const after = (await c.listCrews('u1')).find((x) => x.id === 'c-sunrise');
  assert.deepEqual([after.members, after.joined], [85, true]);
  await c.joinCrew('c-sunrise', 'u1', false);
  assert.equal((await c.listCrews('u1')).find((x) => x.id === 'c-sunrise').members, 84);
  const route = (await c.listRoutes()).find((r) => r.id === 'r-zoolake');
  assert.equal(feltSafe(route.ratings).percent, 90);
  await c.rateRoute('r-zoolake', 'u1', false);
  await c.rateRoute('r-zoolake', 'u1', true);
  assert.equal((await c.listRoutes()).find((r) => r.id === 'r-zoolake').ratings.length, 21);
  const token = await c.startShare('u1', 'Naledi');
  assert.equal((await c.getShare(token)).lat, null);
  await c.sendLocation(token, { lat: -26.2389, lng: 27.9086, accuracy: 8, sos: false });
  await c.setSos(token, true);
  const seen = await c.getShare(token);
  assert.deepEqual([seen.runner_name, seen.lat, seen.sos], ['Naledi', -26.2389, true]);
  assert.equal('user_id' in seen, false, 'the buddy page never sees the account id');
  await c.endShare(token);
  assert.equal(await c.getShare(token), null, 'ending deletes the location');
});

test('demo reports: 3 reports hide an item until an admin decides', async () => {
  const c = createDemoCommunity(memory());
  for (const user of ['a', 'b']) await c.report('route', 'r-rietvlei', user, 'Unsafe information');
  await c.report('route', 'r-rietvlei', 'a', 'Spam');
  assert.equal((await c.listRoutes()).some((r) => r.id === 'r-rietvlei'), true, 'the same member cannot report twice');
  await c.report('route', 'r-rietvlei', 'c', 'Spam');
  assert.equal(HIDE_AFTER_REPORTS, 3);
  assert.equal((await c.listRoutes()).some((r) => r.id === 'r-rietvlei'), false);
  const [open] = await c.openReports();
  assert.deepEqual([open.kind, open.count, open.hidden], ['route', 3, true]);
  await c.resolveReport('route', 'r-rietvlei', false);
  assert.equal((await c.listRoutes()).some((r) => r.id === 'r-rietvlei'), true);
  assert.deepEqual(await c.openReports(), []);
});
