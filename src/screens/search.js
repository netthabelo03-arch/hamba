// Search: words, categories, a price range and sorting, as in the Shop screen.

import { listProducts } from '../market/api.js';
import { CATEGORIES, SORTS, AUDIENCES, OTHER, typesFor, noResultsMessage, cleanFilters } from '../market/catalog.js';
import { parseRand } from '../market/money.js';
import { productGrid, sampleNote } from '../market/ui.js';
import { isDemo } from '../auth/api.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, icon } from '../dom.js';
import { friendlyAuthError } from '../auth/errors.js';

const SEARCH_ICON = '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>';

// Filters live while the app is open, so going to a product and back keeps them.
const remembered = { q: '', min: '', max: '', sort: 'new', audience: '', type: '', typeFor: '' };

export async function renderSearch({ session, route }) {
  const { profile } = await loadViewer(session);
  const category = route.category ?? '';

  const box = el('input', { type: 'search', id: 'q', class: 'search__input', placeholder: 'Search sneakers, beauty, crafts', 'aria-label': 'Search products', autocomplete: 'off', enterkeyhint: 'search' });
  box.value = remembered.q;
  const form = el('form', { class: 'search', role: 'search' }, [icon(SEARCH_ICON, 18), box]);

  const chips = el('div', { class: 'chips', role: 'list' }, [{ id: '', name: 'All' }, ...CATEGORIES].map((c) => {
    const chip = el('a', { href: c.id ? `#/search/${c.id}` : '#/search', class: 'chip-link', role: 'listitem', text: c.name });
    if (c.id === category) chip.setAttribute('aria-current', 'true');
    return chip;
  }));

  // Types of the chosen department, like Shein's second row.
  if (remembered.typeFor !== category) { remembered.type = ''; remembered.typeFor = category; }
  const types = category && category !== OTHER ? typesFor(category) : [];
  const typeChips = el('div', { class: 'chips chips--small' }, ['', ...types].map((t) => {
    const chip = el('button', { type: 'button', class: 'chip-link chip-link--small', text: t || 'All types' });
    chip.setAttribute('aria-pressed', String(remembered.type === t));
    chip.addEventListener('click', () => {
      remembered.type = t;
      for (const c of typeChips.children) c.setAttribute('aria-pressed', String(c === chip));
      run();
    });
    return chip;
  }));
  typeChips.hidden = types.length === 0;
  const audience = el('select', { id: 'audience', class: 'input input--small', 'aria-label': 'Who it is for' }, [el('option', { value: '', text: 'Everyone' }), ...AUDIENCES.filter((a) => a.id !== 'unisex').map((a) => el('option', { value: a.id, text: a.name }))]);
  audience.value = remembered.audience;

  const min = el('input', { id: 'min', class: 'input input--small', inputmode: 'decimal', placeholder: 'Min', 'aria-label': 'Lowest price in rand' });
  const max = el('input', { id: 'max', class: 'input input--small', inputmode: 'decimal', placeholder: 'Max', 'aria-label': 'Highest price in rand' });
  const sort = el('select', { id: 'sort', class: 'input input--small', 'aria-label': 'Sort by' }, SORTS.map((s) => el('option', { value: s.id, text: s.name })));
  min.value = remembered.min;
  max.value = remembered.max;
  sort.value = remembered.sort;
  const filters = el('div', { class: 'filters' }, [audience, sort, el('span', { class: 'filters__label', text: 'R' }), min, el('span', { 'aria-hidden': 'true', text: '–' }), max]);

  const status = el('p', { class: 'result-count', role: 'status' });
  const results = el('div', { class: 'results' });

  let latest = 0;
  async function run() {
    remembered.q = box.value;
    remembered.min = min.value;
    remembered.max = max.value;
    remembered.sort = sort.value;
    remembered.audience = audience.value;
    const f = cleanFilters({ q: box.value, category, type: remembered.type, audience: audience.value, min: parseRand(min.value), max: parseRand(max.value), sort: sort.value });
    const mine = ++latest;
    status.textContent = 'Searching…';
    try {
      const products = await listProducts(f);
      if (mine !== latest) return;
      status.textContent = products.length ? `${products.length} product${products.length === 1 ? '' : 's'}` : '';
      results.replaceChildren(products.length ? productGrid(products) : el('div', { class: 'empty' }, [
        el('p', { class: 'empty__text', text: noResultsMessage(f) }),
        el('button', { type: 'button', class: 'button button--quiet', text: 'Clear filters' }),
      ]));
      results.querySelector('.empty button')?.addEventListener('click', () => {
        box.value = ''; min.value = ''; max.value = ''; sort.value = 'new'; audience.value = ''; remembered.type = '';
        if (category) window.location.hash = '#/search';
        else run();
      });
    } catch (error) {
      if (mine !== latest) return;
      status.textContent = '';
      results.replaceChildren(el('p', { class: 'message message--error', role: 'alert', text: friendlyAuthError(error) }));
    }
  }

  let timer = null;
  const soon = () => { clearTimeout(timer); timer = setTimeout(run, 300); };
  box.addEventListener('input', soon);
  min.addEventListener('input', soon);
  max.addEventListener('input', soon);
  sort.addEventListener('change', run);
  audience.addEventListener('change', run);
  form.addEventListener('submit', (event) => { event.preventDefault(); box.blur(); run(); });
  run();

  return [topBar({ profile, session }), el('h1', { class: 'title', text: 'Shop' }), form, chips, typeChips, filters, ...sampleNote(isDemo()), status, results, tabBar('search')];
}
