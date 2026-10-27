import { dateKey, parseDate, monthDays, validateData, calendarRange, clampDate, navigateDate } from './calendar.mjs';

const $ = id => document.getElementById(id);
const today = new Date();
today.setHours(12, 0, 0, 0);
let selected = new Date(today);
let view = 'month';
let data;
let memories = new Map();
let ready = false;
let range;
const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' });
const fullDateFormat = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setRoute() {
  const hash = `#${view}/${dateKey(selected)}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function readRoute() {
  const match = location.hash.match(/^#(month|day)\/(\d{4}-\d{2}-\d{2})$/);
  const date = match && parseDate(match[2]);
  if (!date) return false;
  view = match[1];
  selected = clampDate(date, range);
  return true;
}

function chooseDate(date, nextView = view) {
  if (!parseDate(dateKey(date))) return;
  selected = clampDate(date, range);
  view = nextView;
  render();
}

function photo(memory, className = '') {
  const button = element('button', `photo-button ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', `Enlarge photo: ${memory.title}`);
  const img = element('img');
  img.src = memory.image;
  img.alt = memory.alt;
  img.decoding = 'async';
  img.addEventListener('error', () => {
    button.replaceChildren(element('span', 'image-unavailable', 'This photo couldn’t be loaded.'));
    button.disabled = true;
  }, { once: true });
  button.append(img);
  button.addEventListener('click', () => {
    $('full-photo').src = memory.image;
    $('full-photo').alt = memory.alt;
    $('full-caption').textContent = `${memory.title} · ${dateFormat.format(parseDate(memory.date))} · ${memory.place}`;
    $('photo-dialog').showModal();
  });
  return button;
}

function details(memory) {
  const fragment = document.createDocumentFragment();
  fragment.append(element('p', 'memory-date', fullDateFormat.format(selected)));
  fragment.append(element('h3', 'memory-title', memory.title));
  const place = element('p', 'memory-place');
  // This fixed icon contains no user-provided markup.
  place.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  place.append(document.createTextNode(memory.place));
  fragment.append(place);
  if (memory.notes) fragment.append(element('p', 'memory-notes', memory.notes));
  return fragment;
}

function renderMonth() {
  const grid = $('calendar-grid');
  grid.replaceChildren();
  for (const date of monthDays(selected)) {
    if (date.getMonth() !== selected.getMonth()) {
      const spacer = element('div', 'calendar-spacer');
      spacer.setAttribute('aria-hidden', 'true');
      grid.append(spacer);
      continue;
    }
    const key = dateKey(date);
    const memory = memories.get(key);
    const cell = element('button', `date-cell${memory ? ' has-photo' : ''}${key === dateKey(selected) ? ' selected' : ''}${key === dateKey(today) ? ' is-today' : ''}`);
    cell.type = 'button';
    cell.dataset.date = key;
    cell.setAttribute('aria-label', `${fullDateFormat.format(date)}${memory ? `: ${memory.title}, ${memory.place}. Open day.` : ': No memory yet. Open day.'}`);
    cell.setAttribute('aria-pressed', String(key === dateKey(selected)));
    if (key === dateKey(today)) cell.setAttribute('aria-current', 'date');
    if (!parseDate(key) || date < range.start || date > range.end) {
      cell.disabled = true;
      cell.classList.add('outside-range');
      cell.setAttribute('aria-label', `${fullDateFormat.format(date)}: Outside our calendar dates.`);
    }
    if (memory) {
      const img = element('img');
      img.src = memory.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => cell.classList.add('image-failed'), { once: true });
      cell.append(img, element('span', 'cell-place', memory.place), element('span', 'cell-heart', '♡'));
    }
    cell.append(element('span', 'day-number', String(date.getDate())));
    cell.addEventListener('click', () => chooseDate(date, 'day'));
    // Keep the day-view selection in sync when tabbing through the month.
    cell.addEventListener('focus', () => {
      if (!cell.disabled && key !== dateKey(selected)) {
        selected = date;
        grid.querySelectorAll('.date-cell').forEach(node => {
          const active = node.dataset.date === key;
          node.classList.toggle('selected', active);
          node.setAttribute('aria-pressed', String(active));
        });
        $('jump-date').value = key;
        setRoute();
      }
    });
    grid.append(cell);
  }
}

function renderDay() {
  const day = $('day-view');
  day.replaceChildren();
  const memory = memories.get(dateKey(selected));
  const back = element('button', 'back-month', '← Back to our month');
  back.addEventListener('click', () => chooseDate(selected, 'month'));
  if (!memory) {
    const empty = element('div', 'empty-day');
    empty.append(element('span', 'empty-heart', '♡'), element('p', 'memory-date', fullDateFormat.format(selected)), element('h3', 'memory-title', 'A story still to come.'), element('p', 'memory-notes', 'No photo for this day yet. There’s always room for another little memory.'), back);
    day.append(empty);
    return;
  }
  const layout = element('div', 'day-layout');
  const imageWrap = element('div', 'day-image-wrap');
  imageWrap.append(photo(memory));
  const copy = element('div', 'day-details');
  copy.append(details(memory), back);
  layout.append(imageWrap, copy);
  day.append(layout);
}

function render() {
  if (!ready) return;
  $('month-view').hidden = view !== 'month';
  $('day-view').hidden = view !== 'day';
  $('month-button').setAttribute('aria-pressed', String(view === 'month'));
  $('day-button').setAttribute('aria-pressed', String(view === 'day'));
  $('period-title').textContent = view === 'month' ? monthFormat.format(selected) : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(selected);
  $('previous').setAttribute('aria-label', `Previous ${view}`);
  $('next').setAttribute('aria-label', `Next ${view}`);
  $('previous').disabled = dateKey(navigateDate(selected, -1, view, range)) === dateKey(selected);
  $('next').disabled = dateKey(navigateDate(selected, 1, view, range)) === dateKey(selected);
  $('jump-date').value = dateKey(selected);
  const prefix = dateKey(selected).slice(0, 7);
  const count = data.memories.filter(memory => memory.date.startsWith(prefix)).length;
  const summary = $('month-summary');
  summary.replaceChildren(element('strong', '', `${count} ${count === 1 ? 'memory' : 'memories'}`), document.createTextNode(` tucked into ${new Intl.DateTimeFormat('en', { month: 'long' }).format(selected)}`));
  if (view === 'month') renderMonth(); else renderDay();
  setRoute();
}

async function load() {
  $('status').hidden = false;
  $('status').className = 'status';
  $('status').textContent = 'Opening our little collection…';
  document.querySelectorAll('.calendar-toolbar button, .calendar-toolbar input').forEach(node => node.disabled = true);
  try {
    const response = await fetch('./calander-data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load calander-data.json (HTTP ${response.status}).`);
    data = validateData(await response.json());
    range = calendarRange(data, today);
    memories = new Map(data.memories.map(memory => [memory.date, memory]));
    $('couple-names').textContent = data.coupleNames || 'You & me';
    if (data.subtitle) $('subtitle').textContent = data.subtitle;
    $('footer-count').textContent = `${data.memories.length} little ${data.memories.length === 1 ? 'memory' : 'memories'}. One shared story.`;
    if (!readRoute()) selected = parseDate(data.startDate) || new Date(today);
    selected = clampDate(selected, range);
    $('jump-date').min = dateKey(range.start);
    $('jump-date').max = dateKey(range.end);
    ready = true;
    $('status').hidden = true;
    document.querySelectorAll('.calendar-toolbar button, .calendar-toolbar input').forEach(node => node.disabled = false);
    render();
  } catch (error) {
    ready = false;
    $('status').className = 'status error';
    $('status').textContent = `We couldn’t open the calendar. ${error.message} Check calander-data.json and run the site through a local web server or GitHub Pages.`;
    const retry = element('button', '', 'Try again');
    retry.addEventListener('click', load);
    $('status').append(retry);
  }
}

$('previous').addEventListener('click', () => chooseDate(navigateDate(selected, -1, view, range)));
$('next').addEventListener('click', () => chooseDate(navigateDate(selected, 1, view, range)));
$('month-button').addEventListener('click', () => chooseDate(selected, 'month'));
$('day-button').addEventListener('click', () => chooseDate(selected, 'day'));
$('jump-date').addEventListener('change', event => {
  const date = parseDate(event.target.value);
  if (date) chooseDate(date);
});
$('close-photo').addEventListener('click', () => $('photo-dialog').close());
$('photo-dialog').addEventListener('click', event => {
  if (event.target === $('photo-dialog')) {
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  }
});
window.addEventListener('hashchange', () => { if (ready && readRoute()) render(); });
window.addEventListener('keydown', event => {
  if (!ready || $('photo-dialog').open || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    chooseDate(navigateDate(selected, event.key === 'ArrowLeft' ? -1 : 1, view, range));
  }
});
load();
