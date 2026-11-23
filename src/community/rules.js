// Rules for Studio (member designs and votes) and Run safe (crews, safe
// routes, live location and SOS). No screen code here, so it can be tested.

// ---------------------------------------------------------------- Studio

/** At this many votes a design is made, and the designer earns a royalty. */
export const VOTE_GOAL = 500;
export const ROYALTY_RATE = 0.05;

export const DESIGN_KINDS = [
  { id: 'sneakers', name: 'Sneakers' },
  { id: 'tee', name: 'T-shirt' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'cap', name: 'Cap' },
  { id: 'bag', name: 'Bag' },
  { id: 'other', name: 'Something else' },
];

export const DESIGN_STATUS = {
  pending: { tag: 'Waiting for review', about: 'Hamba checks every design before members can vote, usually within a day.' },
  open: { tag: 'Open for votes', about: `Members are voting. At ${VOTE_GOAL} votes it gets made.` },
  rejected: { tag: 'Not approved', about: 'Read the note, fix it and submit again.' },
  made: { tag: 'Made and selling', about: `You earn ${ROYALTY_RATE * 100}% of every sale.` },
};

function text(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function checkDesign({ title, about, kind, hasImage, ownWork }) {
  const errors = {};
  const value = { title: text(title), about: String(about ?? '').trim(), kind };
  if (value.title.length < 3 || value.title.length > 60) errors.title = 'Give your design a name of 3 to 60 characters.';
  if (value.about.length < 10 || value.about.length > 600) errors.about = 'Describe it in 10 to 600 characters: colours, materials, the idea behind it.';
  if (!DESIGN_KINDS.some((k) => k.id === kind)) errors.kind = 'Choose what it is.';
  if (!hasImage) errors.image = 'Add a picture of your design: a drawing, a mock-up or a photo of a sample.';
  if (ownWork !== true) errors.ownWork = 'Confirm the design is your own work.';
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * Whether this member may vote for (or un-vote) this design.
 * @returns {string | null} why not, or null if they may
 */
export function voteBlocked(design, userId) {
  if (!userId) return 'Log in to vote.';
  if (design.designer_id === userId) return 'You cannot vote for your own design.';
  if (design.status !== 'open') return 'Voting is closed for this design.';
  return null;
}

/** Progress towards the goal, 0 to 100, for the bar. */
export function voteProgress(votes) {
  return Math.min(100, Math.round((Math.max(0, votes) / VOTE_GOAL) * 100));
}

/** Most votes first, then newest; designs that reached the goal stay at the top. */
export function sortDesigns(designs, by = 'top') {
  const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  return designs.slice().sort(by === 'new' ? newest : (a, b) => b.votes - a.votes || newest(a, b));
}

/** The designer's share of a sale, in cents. */
export function royaltyFor(priceCents) {
  return Math.round(priceCents * ROYALTY_RATE);
}

// ---------------------------------------------------------------- Crews and routes

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function checkCrew({ name, area, days, time, pace }) {
  const errors = {};
  const value = { name: text(name), area: text(area), days: WEEKDAYS.filter((d) => days?.includes(d)), time: text(time), pace: text(pace) };
  if (value.name.length < 3 || value.name.length > 50) errors.name = 'Give your crew a name of 3 to 50 characters.';
  if (value.area.length < 2 || value.area.length > 40) errors.area = 'Enter the area you run in, like Soweto or Durban North.';
  if (value.days.length === 0) errors.days = 'Choose at least one day.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) errors.time = 'Enter a start time like 05:30.';
  if (value.pace.length > 40) errors.pace = 'Keep the pace short, like "Easy, 6 to 7 min/km".';
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** "Tue and Thu 05:30", "Mon, Wed and Fri 18:00". */
export function crewSchedule(crew) {
  const days = crew.days ?? [];
  const list = days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} and ${days.at(-1)}`;
  return `${list} ${crew.time}`.trim();
}

export function checkRoute({ name, area, distanceKm, tip }) {
  const errors = {};
  const km = Number(String(distanceKm ?? '').replace(',', '.'));
  const value = { name: text(name), area: text(area), distance_km: Math.round(km * 10) / 10, tip: text(tip) };
  if (value.name.length < 3 || value.name.length > 60) errors.name = 'Name the route, like "Vilakazi St to Orlando Stadium".';
  if (value.area.length < 2 || value.area.length > 40) errors.area = 'Enter the area, like Soweto.';
  if (!Number.isFinite(km) || km < 0.5 || km > 100) errors.distanceKm = 'Enter the distance in km, between 0.5 and 100.';
  if (value.tip.length > 60) errors.tip = 'Keep the tip short, like "best before 18:00".';
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * How safe runners felt, from one yes/no answer per member.
 * @returns {{ percent: number | null, count: number }} percent is null until 3 runners have answered
 */
export function feltSafe(ratings) {
  const count = ratings.length;
  if (count < 3) return { percent: null, count };
  return { percent: Math.round((ratings.filter((r) => r.safe).length / count) * 100), count };
}

/** Adding or changing a member's answer: one answer per member, never two. */
export function upsertRating(ratings, userId, safe) {
  return [...ratings.filter((r) => r.user_id !== userId), { user_id: userId, safe: Boolean(safe) }];
}

// ---------------------------------------------------------------- Live location and SOS

/** South African emergency numbers, shown with every SOS. */
export const EMERGENCY = [
  { name: 'Police', number: '10111' },
  { name: 'Any cellphone', number: '112' },
  { name: 'Ambulance', number: '10177' },
];

/** How often the runner's phone sends its location, and the buddy page checks. */
export const SEND_EVERY_MS = 15000;
export const CHECK_EVERY_MS = 10000;
/** A location older than this is shown as possibly out of date. */
export const STALE_AFTER_MS = 2 * 60 * 1000;
/** Shares end by themselves after this long, so a forgotten share does not run forever. */
export const SHARE_MAX_HOURS = 6;

/** A random, hard-to-guess share code (22 characters, URL safe). */
export function newShareToken(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return [...random(22)].map((b) => alphabet[b & 63]).join('');
}

export function isShareToken(value) {
  return /^[A-Za-z0-9_-]{22}$/.test(String(value ?? ''));
}

/** "just now", "2 min ago", "1 h 5 min ago". */
export function ago(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}

export function isStale(iso, now = Date.now()) {
  return now - Date.parse(iso) > STALE_AFTER_MS;
}

/** Whether a share should be treated as ended (ended, or older than the limit). */
export function shareEnded(share, now = Date.now()) {
  return !share || share.ended === true || now - Date.parse(share.started_at) > SHARE_MAX_HOURS * 3600 * 1000;
}

export function formatCoords(lat, lng) {
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

/** A WhatsApp message with the private link. */
export function whatsappLink(url, name) {
  const message = `${name ? `${name} is` : 'I am'} sharing a live run with you on Hamba. Follow here: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Only send when it matters: enough time has passed, or the runner moved, or SOS changed. */
export function shouldSend(last, next, now = Date.now()) {
  if (!last) return true;
  if (next.sos !== last.sos) return true;
  if (now - last.sentAt >= SEND_EVERY_MS) return true;
  return false;
}

// ---------------------------------------------------------------- Reports

export const REPORT_REASONS = ['Copied or fake', 'Rude or hateful', 'Unsafe information', 'Spam', 'Something else'];
/** An item with this many reports is hidden until an admin looks at it. */
export const HIDE_AFTER_REPORTS = 3;
