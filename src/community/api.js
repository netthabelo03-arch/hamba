// Studio, Run safe and reports: everything their screens need. Supabase once
// config.js is filled in; sample data kept in this browser (demo mode) until
// then. Functions throw on failure; screens show friendlyAuthError(error).

import { getClient } from '../auth/client.js';
import { isConfigured } from '../config.js';
import { shrinkPhoto, blobToDataUrl } from '../market/photos.js';
import { upsertRating, HIDE_AFTER_REPORTS, newShareToken } from './rules.js';
import { SAMPLE_DESIGNS, SAMPLE_CREWS, SAMPLE_ROUTES } from './seed.js';

const DESIGN_BUCKET = 'design-images';
const DESIGN_COLUMNS = 'id, designer_id, designer_name, title, about, kind, image, status, review_note, reports, hidden, created_at';
const CREW_COLUMNS = 'id, owner_id, name, area, days, time, pace, reports, hidden, created_at';
const ROUTE_COLUMNS = 'id, added_by, name, area, distance_km, tip, reports, hidden, created_at';

/** Counts come from functions, so who voted or joined stays private. */
async function counts(client, fn, key) {
  const { data, error } = await client.rpc(fn);
  if (error) throw error;
  return new Map(data.map((row) => [row[key], Number(row.votes ?? row.members)]));
}

// ---------------------------------------------------------------- Supabase

const supabaseCommunity = {
  async listDesigns(viewerId) {
    const client = await getClient();
    const [{ data, error }, mine, votes] = await Promise.all([
      client.from('designs').select(DESIGN_COLUMNS).in('status', ['open', 'made']).eq('hidden', false).limit(200),
      viewerId ? client.from('design_votes').select('design_id').eq('user_id', viewerId) : { data: [] },
      counts(client, 'design_vote_counts', 'design_id'),
    ]);
    if (error) throw error;
    const voted = new Set((mine.data ?? []).map((v) => v.design_id));
    return data.map((d) => ({ ...d, votes: votes.get(d.id) ?? 0, voted: voted.has(d.id) }));
  },
  async myDesigns(userId) {
    const client = await getClient();
    const [{ data, error }, votes] = await Promise.all([client.from('designs').select(DESIGN_COLUMNS).eq('designer_id', userId).order('created_at', { ascending: false }), counts(client, 'design_vote_counts', 'design_id')]);
    if (error) throw error;
    return data.map((d) => ({ ...d, votes: votes.get(d.id) ?? 0 }));
  },
  async uploadDesignImage(userId, blob) {
    const client = await getClient();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const small = await shrinkPhoto(blob);
    const { error } = await client.storage.from(DESIGN_BUCKET).upload(path, small, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    return client.storage.from(DESIGN_BUCKET).getPublicUrl(path).data.publicUrl;
  },
  async submitDesign(userId, designerName, design) {
    const client = await getClient();
    const { error } = await client.from('designs').insert({ designer_id: userId, designer_name: designerName, ...design });
    if (error) throw error;
  },
  async vote(designId, userId, on) {
    const client = await getClient();
    const { error } = on
      ? await client.from('design_votes').insert({ design_id: designId, user_id: userId })
      : await client.from('design_votes').delete().eq('design_id', designId).eq('user_id', userId);
    if (error && error.code !== '23505') throw error;
  },
  async designsToReview() {
    const client = await getClient();
    const [{ data, error }, votes] = await Promise.all([client.from('designs').select(DESIGN_COLUMNS).in('status', ['pending', 'open']).order('created_at', { ascending: true }), counts(client, 'design_vote_counts', 'design_id')]);
    if (error) throw error;
    return data.map((d) => ({ ...d, votes: votes.get(d.id) ?? 0 }));
  },
  async reviewDesign(designId, status, note) {
    const client = await getClient();
    const { error } = await client.rpc('review_design', { design_id: designId, new_status: status, note: note ?? '' });
    if (error) throw error;
  },

  async listCrews(viewerId) {
    const client = await getClient();
    const [{ data, error }, mine, members] = await Promise.all([
      client.from('crews').select(CREW_COLUMNS).eq('hidden', false).order('created_at', { ascending: false }).limit(200),
      viewerId ? client.from('crew_members').select('crew_id').eq('user_id', viewerId) : { data: [] },
      counts(client, 'crew_member_counts', 'crew_id'),
    ]);
    if (error) throw error;
    const joined = new Set((mine.data ?? []).map((m) => m.crew_id));
    return data.map((c) => ({ ...c, members: members.get(c.id) ?? 0, joined: joined.has(c.id) }));
  },
  async createCrew(userId, crew) {
    const client = await getClient();
    const { data, error } = await client.from('crews').insert({ owner_id: userId, ...crew }).select('id').single();
    if (error) throw error;
    await this.joinCrew(data.id, userId, true);
  },
  async joinCrew(crewId, userId, on) {
    const client = await getClient();
    const { error } = on
      ? await client.from('crew_members').insert({ crew_id: crewId, user_id: userId })
      : await client.from('crew_members').delete().eq('crew_id', crewId).eq('user_id', userId);
    if (error && error.code !== '23505') throw error;
  },

  async listRoutes(viewerId) {
    const client = await getClient();
    const [{ data, error }, safety, mine] = await Promise.all([
      client.from('routes').select(ROUTE_COLUMNS).eq('hidden', false).order('created_at', { ascending: false }).limit(200),
      client.rpc('route_safety'),
      viewerId ? client.from('route_ratings').select('route_id, safe').eq('user_id', viewerId) : { data: [] },
    ]);
    if (error) throw error;
    if (safety.error) throw safety.error;
    const totals = new Map(safety.data.map((r) => [r.route_id, r]));
    const answers = new Map((mine.data ?? []).map((r) => [r.route_id, r.safe]));
    // Rebuild anonymous answers from the totals, with the viewer's own answer marked.
    return data.map((route) => {
      const t = totals.get(route.id) ?? { safe_count: 0, total: 0 };
      let yes = Number(t.safe_count);
      let no = Number(t.total) - yes;
      const ratings = [];
      if (answers.has(route.id)) {
        const safe = answers.get(route.id);
        ratings.push({ user_id: viewerId, safe });
        if (safe) yes -= 1; else no -= 1;
      }
      for (let i = 0; i < yes; i += 1) ratings.push({ user_id: null, safe: true });
      for (let i = 0; i < no; i += 1) ratings.push({ user_id: null, safe: false });
      return { ...route, ratings };
    });
  },
  async addRoute(userId, route) {
    const client = await getClient();
    const { error } = await client.from('routes').insert({ added_by: userId, ...route });
    if (error) throw error;
  },
  async rateRoute(routeId, userId, safe) {
    const client = await getClient();
    const { error } = await client.from('route_ratings').upsert({ route_id: routeId, user_id: userId, safe }, { onConflict: 'route_id,user_id' });
    if (error) throw error;
  },

  async startShare(userId, runnerName) {
    const client = await getClient();
    const token = newShareToken();
    const { error } = await client.from('live_shares').insert({ token, user_id: userId, runner_name: runnerName });
    if (error) throw error;
    return token;
  },
  async myShare(userId) {
    const client = await getClient();
    const { data, error } = await client.from('live_shares').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  async sendLocation(token, { lat, lng, accuracy, sos }) {
    const client = await getClient();
    const { error } = await client.from('live_shares').update({ lat, lng, accuracy, sos, updated_at: new Date().toISOString() }).eq('token', token);
    if (error) throw error;
  },
  async setSos(token, sos) {
    const client = await getClient();
    const { error } = await client.from('live_shares').update({ sos, updated_at: new Date().toISOString() }).eq('token', token);
    if (error) throw error;
  },
  async endShare(token) {
    const client = await getClient();
    const { error } = await client.from('live_shares').delete().eq('token', token);
    if (error) throw error;
  },
  /** Anyone with the link can read it, through a function that needs the exact token. */
  async getShare(token) {
    const client = await getClient();
    const { data, error } = await client.rpc('get_live_share', { share_token: token });
    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data;
  },

  async report(kind, itemId, userId, reason) {
    const client = await getClient();
    const { error } = await client.from('reports').insert({ kind, item_id: itemId, user_id: userId, reason });
    if (error && error.code !== '23505') throw error;
  },
  async openReports() {
    const client = await getClient();
    const { data, error } = await client.rpc('open_reports');
    if (error) throw error;
    return data;
  },
  async resolveReport(kind, itemId, hide) {
    const client = await getClient();
    const { error } = await client.rpc('resolve_reports', { item_kind: kind, item: itemId, hide_it: hide });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------- Demo

const KEY = 'hamba.community.v1';

function pickStore() {
  try {
    const s = globalThis.localStorage;
    s.setItem('hamba.test', '1');
    s.removeItem('hamba.test');
    return s;
  } catch {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  }
}

/** @param {Storage} [store] where to keep the demo data (tests pass their own) */
export function createDemoCommunity(store = pickStore()) {
  const now = () => new Date().toISOString();
  function load() {
    try {
      const data = JSON.parse(store.getItem(KEY) ?? 'null');
      if (data?.designs) return data;
    } catch { /* start again */ }
    return {
      designs: structuredClone(SAMPLE_DESIGNS),
      votes: [],
      crews: structuredClone(SAMPLE_CREWS),
      members: [],
      routes: structuredClone(SAMPLE_ROUTES),
      shares: {},
      reports: [],
    };
  }
  function save(data) {
    try {
      store.setItem(KEY, JSON.stringify(data));
    } catch {
      throw { code: 'demo_full' };
    }
  }
  const withVotes = (data, d, viewerId) => ({
    ...d,
    votes: (d.base_votes ?? 0) + data.votes.filter((v) => v.design_id === d.id).length,
    voted: data.votes.some((v) => v.design_id === d.id && v.user_id === viewerId),
  });
  const withMembers = (data, c, viewerId) => ({
    ...c,
    members: (c.base_members ?? 0) + data.members.filter((m) => m.crew_id === c.id).length,
    joined: data.members.some((m) => m.crew_id === c.id && m.user_id === viewerId),
  });
  const reportsFor = (data, kind, id) => data.reports.filter((r) => r.kind === kind && r.item_id === id && !r.resolved);
  const listOf = (data, kind) => ({ design: data.designs, crew: data.crews, route: data.routes })[kind];

  return {
    async listDesigns(viewerId) {
      const data = load();
      return data.designs.filter((d) => ['open', 'made'].includes(d.status) && !d.hidden).map((d) => withVotes(data, d, viewerId));
    },
    async myDesigns(userId) {
      const data = load();
      return data.designs.filter((d) => d.designer_id === userId).map((d) => withVotes(data, d, userId)).reverse();
    },
    async uploadDesignImage(_userId, blob) {
      return blobToDataUrl(await shrinkPhoto(blob, 640, 0.72));
    },
    async submitDesign(userId, designerName, design) {
      const data = load();
      data.designs.push({ id: `d-${crypto.randomUUID()}`, designer_id: userId, designer_name: designerName, ...design, status: 'pending', review_note: '', reports: 0, hidden: false, base_votes: 0, created_at: now() });
      save(data);
    },
    async vote(designId, userId, on) {
      const data = load();
      const design = data.designs.find((d) => d.id === designId);
      if (!design || design.designer_id === userId || design.status !== 'open') throw { code: 42501 };
      data.votes = data.votes.filter((v) => !(v.design_id === designId && v.user_id === userId));
      if (on) data.votes.push({ design_id: designId, user_id: userId });
      save(data);
    },
    async designsToReview() {
      const data = load();
      return data.designs.filter((d) => d.status === 'pending' || d.status === 'open').map((d) => withVotes(data, d, null));
    },
    async reviewDesign(designId, status, note) {
      if (status === 'rejected' && String(note ?? '').trim().length < 5) throw { code: '22023' };
      const data = load();
      const design = data.designs.find((d) => d.id === designId);
      design.status = status;
      design.review_note = status === 'rejected' ? String(note).trim() : '';
      save(data);
    },

    async listCrews(viewerId) {
      const data = load();
      return data.crews.filter((c) => !c.hidden).map((c) => withMembers(data, c, viewerId));
    },
    async createCrew(userId, crew) {
      const data = load();
      const id = `c-${crypto.randomUUID()}`;
      data.crews.unshift({ id, owner_id: userId, ...crew, reports: 0, hidden: false, base_members: 0, created_at: now() });
      data.members.push({ crew_id: id, user_id: userId });
      save(data);
    },
    async joinCrew(crewId, userId, on) {
      const data = load();
      data.members = data.members.filter((m) => !(m.crew_id === crewId && m.user_id === userId));
      if (on) data.members.push({ crew_id: crewId, user_id: userId });
      save(data);
    },

    async listRoutes() {
      return load().routes.filter((r) => !r.hidden);
    },
    async addRoute(userId, route) {
      const data = load();
      data.routes.unshift({ id: `r-${crypto.randomUUID()}`, added_by: userId, ...route, ratings: [], reports: 0, hidden: false, created_at: now() });
      save(data);
    },
    async rateRoute(routeId, userId, safe) {
      const data = load();
      const route = data.routes.find((r) => r.id === routeId);
      route.ratings = upsertRating(route.ratings, userId, safe);
      save(data);
    },

    async startShare(userId, runnerName) {
      const data = load();
      const token = newShareToken();
      for (const [t, s] of Object.entries(data.shares)) if (s.user_id === userId) delete data.shares[t];
      data.shares[token] = { token, user_id: userId, runner_name: runnerName, lat: null, lng: null, accuracy: null, sos: false, started_at: now(), updated_at: now() };
      save(data);
      return token;
    },
    async myShare(userId) {
      return Object.values(load().shares).find((s) => s.user_id === userId) ?? null;
    },
    async sendLocation(token, { lat, lng, accuracy, sos }) {
      const data = load();
      if (!data.shares[token]) throw { code: 42501 };
      Object.assign(data.shares[token], { lat, lng, accuracy, sos, updated_at: now() });
      save(data);
    },
    async setSos(token, sos) {
      const data = load();
      if (!data.shares[token]) throw { code: 42501 };
      Object.assign(data.shares[token], { sos, updated_at: now() });
      save(data);
    },
    async endShare(token) {
      const data = load();
      delete data.shares[token];
      save(data);
    },
    async getShare(token) {
      const share = load().shares[token];
      return share ? { runner_name: share.runner_name, lat: share.lat, lng: share.lng, accuracy: share.accuracy, sos: share.sos, started_at: share.started_at, updated_at: share.updated_at } : null;
    },

    async report(kind, itemId, userId, reason) {
      const data = load();
      if (data.reports.some((r) => r.kind === kind && r.item_id === itemId && r.user_id === userId && !r.resolved)) return;
      data.reports.push({ kind, item_id: itemId, user_id: userId, reason, created_at: now() });
      const item = listOf(data, kind).find((i) => i.id === itemId);
      if (item && reportsFor(data, kind, itemId).length >= HIDE_AFTER_REPORTS) item.hidden = true;
      save(data);
    },
    async openReports() {
      const data = load();
      const groups = new Map();
      for (const r of data.reports.filter((x) => !x.resolved)) {
        const key = `${r.kind}:${r.item_id}`;
        const item = listOf(data, r.kind).find((i) => i.id === r.item_id);
        if (!groups.has(key)) groups.set(key, { kind: r.kind, item_id: r.item_id, title: item?.title ?? item?.name ?? '(gone)', hidden: item?.hidden ?? false, reasons: [], count: 0 });
        const g = groups.get(key);
        g.count += 1;
        g.reasons.push(r.reason);
      }
      return [...groups.values()];
    },
    async resolveReport(kind, itemId, hide) {
      const data = load();
      for (const r of data.reports) if (r.kind === kind && r.item_id === itemId) r.resolved = true;
      const item = listOf(data, kind).find((i) => i.id === itemId);
      if (item) item.hidden = hide;
      save(data);
    },
  };
}

// ---------------------------------------------------------------- Public

let backend = null;
function use() {
  if (backend === null) backend = isConfigured() ? supabaseCommunity : createDemoCommunity();
  return backend;
}

export const listDesigns = (viewerId) => use().listDesigns(viewerId);
export const myDesigns = (userId) => use().myDesigns(userId);
export const uploadDesignImage = (userId, blob) => use().uploadDesignImage(userId, blob);
export const submitDesign = (userId, designerName, design) => use().submitDesign(userId, designerName, design);
export const vote = (designId, userId, on) => use().vote(designId, userId, on);
export const designsToReview = () => use().designsToReview();
export const reviewDesign = (designId, status, note) => use().reviewDesign(designId, status, note);
export const listCrews = (viewerId) => use().listCrews(viewerId);
export const createCrew = (userId, crew) => use().createCrew(userId, crew);
export const joinCrew = (crewId, userId, on) => use().joinCrew(crewId, userId, on);
export const listRoutes = (viewerId) => use().listRoutes(viewerId);
export const addRoute = (userId, route) => use().addRoute(userId, route);
export const rateRoute = (routeId, userId, safe) => use().rateRoute(routeId, userId, safe);
export const startShare = (userId, runnerName) => use().startShare(userId, runnerName);
export const myShare = (userId) => use().myShare(userId);
export const sendLocation = (token, position) => use().sendLocation(token, position);
export const setSos = (token, sos) => use().setSos(token, sos);
export const endShare = (token) => use().endShare(token);
export const getShare = (token) => use().getShare(token);
export const report = (kind, itemId, userId, reason) => use().report(kind, itemId, userId, reason);
export const openReports = () => use().openReports();
export const resolveReport = (kind, itemId, hide) => use().resolveReport(kind, itemId, hide);
