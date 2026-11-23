// Sample Studio designs, crews and routes for demo mode, as in the Hamba
// screens. Marked as sample data on screen.

function svg(body, ground = '#2a2a2a') {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${ground}"/>${body}</svg>`)}`;
}
const SHOE = svg('<polygon points="38,133 46,96 73,91 93,73 116,80 144,109 169,122 167,142 38,142" fill="#e8b84a" stroke="#0d0d0d" stroke-width="3"/><rect x="36" y="142" width="135" height="13" fill="#f2f2f2" stroke="#0d0d0d" stroke-width="3"/><rect x="36" y="148" width="135" height="3" fill="#0d0d0d"/>');
const TEE = svg('<polygon points="73,44 89,40 100,49 111,40 127,44 156,64 142,82 131,76 131,153 69,153 69,76 58,82 44,64" fill="#8a8f96" stroke="#0d0d0d" stroke-width="3"/><rect x="80" y="80" width="40" height="34" fill="#2e7d4f"/><rect x="86" y="92" width="28" height="22" fill="#1f1f1f"/>');
const CAP = svg('<path d="M48 128 Q52 70 100 68 Q148 70 150 128 Z" fill="#c96a3a" stroke="#0d0d0d" stroke-width="3"/><path d="M120 126 Q168 124 178 138 L118 140 Z" fill="#7a2f2f" stroke="#0d0d0d" stroke-width="3"/>');
const HOODIE = svg('<path d="M70 50 Q100 30 130 50 L160 80 L146 96 L136 88 L136 160 L64 160 L64 88 L54 96 L40 80 Z" fill="#1f1f1f" stroke="#0d0d0d" stroke-width="3"/><text x="100" y="125" font-family="Arial Black,sans-serif" font-size="22" fill="#ff2e88" text-anchor="middle">KASI</text>');

export const SAMPLE_DESIGNS = [
  { id: 'd-gold', designer_id: 'sample-1', designer_name: 'Musa D.', title: 'Kasi Gold runner', about: 'A gold and white runner inspired by Soweto sunsets.', kind: 'sneakers', image: SHOE, status: 'open', review_note: '', reports: 0, hidden: false, base_votes: 497, created_at: '2026-11-10T09:00:00Z' },
  { id: 'd-tee', designer_id: 'sample-2', designer_name: 'Lerato P.', title: 'Concrete jungle tee', about: 'Grey tee with a block print of Joburg rooftops.', kind: 'tee', image: TEE, status: 'open', review_note: '', reports: 0, hidden: false, base_votes: 412, created_at: '2026-11-14T09:00:00Z' },
  { id: 'd-cap', designer_id: 'sample-3', designer_name: 'Jason v. W.', title: 'Karoo dusk cap', about: 'Earth-tone cap in the colours of a Karoo evening.', kind: 'cap', image: CAP, status: 'open', review_note: '', reports: 0, hidden: false, base_votes: 288, created_at: '2026-11-18T09:00:00Z' },
  { id: 'd-hoodie', designer_id: 'sample-4', designer_name: 'Thandi M.', title: 'Kasi logo hoodie', about: 'Black hoodie with a pink KASI wordmark.', kind: 'hoodie', image: HOODIE, status: 'made', review_note: '', reports: 0, hidden: false, base_votes: 512, created_at: '2026-10-20T09:00:00Z' },
];

export const SAMPLE_CREWS = [
  { id: 'c-sunrise', owner_id: 'sample-1', name: 'Soweto Sunrise Runners', area: 'Soweto', days: ['Tue', 'Thu'], time: '05:30', pace: 'All paces, nobody runs alone', reports: 0, hidden: false, base_members: 84, created_at: '2026-10-01T09:00:00Z' },
  { id: 'c-zoo', owner_id: 'sample-2', name: 'Zoo Lake Pacers', area: 'Johannesburg', days: ['Sat'], time: '06:30', pace: 'Easy, 6 to 7 min/km', reports: 0, hidden: false, base_members: 41, created_at: '2026-10-05T09:00:00Z' },
  { id: 'c-umhlanga', owner_id: 'sample-3', name: 'Umhlanga Promenade Crew', area: 'Durban', days: ['Mon', 'Wed', 'Fri'], time: '17:30', pace: 'Mixed', reports: 0, hidden: false, base_members: 57, created_at: '2026-10-09T09:00:00Z' },
];

const ratings = (yes, no) => [
  ...Array.from({ length: yes }, (_, i) => ({ user_id: `sample-y${i}`, safe: true })),
  ...Array.from({ length: no }, (_, i) => ({ user_id: `sample-n${i}`, safe: false })),
];

export const SAMPLE_ROUTES = [
  { id: 'r-vilakazi', added_by: 'sample-1', name: 'Vilakazi St to Orlando Stadium', area: 'Soweto', distance_km: 4.2, tip: 'best before 18:00', ratings: ratings(15, 5), reports: 0, hidden: false, created_at: '2026-10-02T09:00:00Z' },
  { id: 'r-zoolake', added_by: 'sample-2', name: 'Zoo Lake loop', area: 'Johannesburg', distance_km: 2.5, tip: 'lit until 19:00', ratings: ratings(18, 2), reports: 0, hidden: false, created_at: '2026-10-06T09:00:00Z' },
  { id: 'r-rietvlei', added_by: 'sample-3', name: 'Rietvlei dam road', area: 'Pretoria', distance_km: 8, tip: 'run in a group', ratings: ratings(3, 4), reports: 0, hidden: false, created_at: '2026-10-08T09:00:00Z' },
];
