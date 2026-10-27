// Date-only values are kept in local time, never parsed as UTC timestamps.
export function dateKey(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return null;
  const date = new Date(2000, month - 1, day, 12);
  date.setFullYear(year);
  return dateKey(date) === value ? date : null;
}

export function shiftDate(date, amount, unit = 'day') {
  const result = new Date(date);
  if (unit === 'month') {
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + amount);
    const last = new Date(result);
    last.setMonth(last.getMonth() + 1, 0);
    result.setDate(Math.min(day, last.getDate()));
  } else result.setDate(result.getDate() + amount);
  return result;
}

export function monthDays(date) {
  const first = new Date(date);
  first.setDate(1);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => shiftDate(first, i - offset));
}

export function calendarRange(data, today = new Date()) {
  const start = parseDate(data.rangeStart || '0001-01-01');
  const end = data.rangeEnd === 'today' ? parseDate(dateKey(today)) : parseDate(data.rangeEnd || '9999-12-31');
  if (!start || !end || start > end) throw new Error('The calendar range must have valid dates, with the start on or before the end.');
  return { start, end };
}

export function clampDate(date, range) {
  return new Date(Math.max(range.start.getTime(), Math.min(range.end.getTime(), date.getTime())));
}

export function navigateDate(date, amount, view, range) {
  const target = clampDate(shiftDate(date, amount, view), range);
  // The month arrows change months, never just the selection within a boundary month.
  if (view === 'month' && dateKey(target).slice(0, 7) === dateKey(date).slice(0, 7)) return new Date(date);
  return target;
}

export function safeImagePath(path) {
  if (typeof path !== 'string' || !path.trim()) return false;
  // Allow repository-relative images and HTTPS image hosts, never script URLs.
  return /^https:\/\//i.test(path) || (!/[:\\]/.test(path) && !path.startsWith('/') && !path.startsWith('#') && !path.startsWith('?'));
}

export function validateData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.memories)) throw new Error('The JSON must contain a "memories" array.');
  if (data.coupleNames !== undefined && typeof data.coupleNames !== 'string') throw new Error('"coupleNames" must be text.');
  if (data.subtitle !== undefined && typeof data.subtitle !== 'string') throw new Error('"subtitle" must be text.');
  if (data.startDate !== undefined && !parseDate(data.startDate)) throw new Error('"startDate" must be a valid YYYY-MM-DD date.');
  calendarRange(data);
  const seen = new Set();
  const memories = data.memories.map((memory, i) => {
    const label = `Memory ${i + 1}`;
    if (!memory || !parseDate(memory.date)) throw new Error(`${label}: use a valid date in YYYY-MM-DD format.`);
    if (seen.has(memory.date)) throw new Error(`${label}: ${memory.date} already has a photo. Keep one entry per date.`);
    seen.add(memory.date);
    if (!safeImagePath(memory.image)) throw new Error(`${label}: "image" must be a relative file path or an HTTPS URL.`);
    if (typeof memory.place !== 'string' || !memory.place.trim()) throw new Error(`${label}: add a "place" name.`);
    for (const field of ['title', 'notes', 'alt']) {
      if (memory[field] !== undefined && typeof memory[field] !== 'string') throw new Error(`${label}: "${field}" must be text.`);
    }
    return { ...memory, title: memory.title || memory.place, notes: memory.notes || '', alt: memory.alt || `A memory at ${memory.place}` };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { ...data, memories };
}
