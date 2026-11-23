// Search: words, categories, a price range and sorting, as in the Shop screen.

import { listProducts } from '../market/api.js';
import { CATEGORIES, SORTS, noResultsMessage, cleanFilters } from '../market/catalog.js';
import { parseRand } from '../market/money.js';
import { productGrid, sampleNote } from '../market/ui.js';
import { isDemo } from '../auth/api.js';
import { loadViewer } from '../viewer.js';
import { topBar, tabBar } from '../shell.js';
import { el, icon } from '../dom.js';
import { friendlyAuthError } from '../auth/errors.js';

const SEARCH_ICON = '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>';

// Filters live while the app is open, so going to a product and back keeps them.
const remembered = { q: '', min: '', max: '', sort: 'new' };

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

  const min = el('input', { id: 'min', class: 'input input--small', inputmode: 'decimal', placeholder: 'Min', 'aria-label': 'Lowest price in rand' });
  const max = el('input', { id: 'max', class: 'input input--small', inputmode: 'decimal', placeholder: 'Max', 'aria-label': 'Highest price in rand' });
  const sort = el('select', { id: 'sort', class: 'input input--small', 'aria-label': 'Sort by' }, SORTS.map((s) => el('option', { value: s.id, text: s.name })));
  min.value = remembered.min;
  max.value = remembered.max;
  sort.value = remembered.sort;
  const filters = el('div', { class: 'filters' }, [el('span', { class: 'filters__label', text: 'R' }), min, el('span', { 'aria-hidden': 'true', text: '–' }), max, sort]);

  const status = el('p', { class: 'result-count', role: 'status' });
  const results = el('div', { class: 'results' });

  let latest = 0;
  async function run() {
    remembered.q = box.value;
    remembered.min = min.value;
    remembered.max = max.value;
    remembered.sort = sort.value;
    const f = cleanFilters({ q: box.value, category, min: parseRand(min.value), max: parseRand(max.value), sort: sort.value });
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
        box.value = ''; min.value = ''; max.value = ''; sort.value = 'new';
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
  form.addEventListener('submit', (event) => { event.preventDefault(); box.blur(); run(); });
  run();

  return [topBar({ profile, session }), el('h1', { class: 'title', text: 'Shop' }), form, chips, filters, ...sampleNote(isDemo()), status, results, tabBar('search')];
}
