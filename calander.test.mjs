import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dateKey, parseDate, shiftDate, monthDays, validateData, calendarRange, clampDate, navigateDate } from './calendar.mjs';

test('real calendar dates, leap years, and low years', () => {
  for (const value of ['2024-02-29', '2026-10-18', '0001-01-01', '0099-12-31']) assert.equal(dateKey(parseDate(value)), value);
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-1', '0000-01-01', '', null]) assert.equal(parseDate(value), null);
});

test('month navigation clamps the date instead of skipping February', () => {
  assert.equal(dateKey(shiftDate(parseDate('2026-01-31'), 1, 'month')), '2026-02-28');
  assert.equal(dateKey(shiftDate(parseDate('2024-01-31'), 1, 'month')), '2024-02-29');
  assert.equal(dateKey(shiftDate(parseDate('2026-12-31'), 1, 'day')), '2027-01-01');
  assert.equal(dateKey(shiftDate(parseDate('2026-01-01'), -1, 'day')), '2025-12-31');
});

test('month layout handles four, five, and six week months, starting on Monday', () => {
  for (const [date, size] of [['2021-02-15', 28], ['2026-10-18', 35], ['2026-03-15', 42]]) {
    const days = monthDays(parseDate(date));
    assert.equal(days.length, size);
    assert.equal(days[0].getDay(), 1);
    assert.equal(days.at(-1).getDay(), 0);
    assert.equal(new Set(days.map(dateKey)).size, size);
  }
});

test('date-only navigation stays stable through daylight saving boundaries', () => {
  for (const value of ['2026-03-08', '2026-11-01']) {
    assert.equal(dateKey(shiftDate(shiftDate(parseDate(value), 1), -1)), value);
  }
});

const memory = { date: '2026-10-18', image: 'images/photo.jpg', place: 'Home' };
test('optional notes, empty collections, and remote images are supported', () => {
  assert.deepEqual(validateData({ memories: [] }).memories, []);
  const item = validateData({ memories: [memory] }).memories[0];
  assert.equal(item.notes, '');
  assert.equal(item.title, 'Home');
  assert.equal(validateData({ memories: [{ ...memory, image: 'https://example.com/photo.webp' }] }).memories.length, 1);
});

test('duplicate dates, invalid data, and unsafe image paths have explicit errors', () => {
  assert.throws(() => validateData({ memories: [memory, memory] }), /already has a photo/);
  assert.throws(() => validateData({ memories: [{ ...memory, date: '2026-02-30' }] }), /valid date/);
  assert.throws(() => validateData({ memories: [{ ...memory, notes: {} }] }), /notes/);
  assert.throws(() => validateData({ memories: [{ ...memory, image: 'javascript:alert(1)' }] }), /relative file path/);
  assert.throws(() => validateData({ memories: [{ ...memory, image: '/images/photo.jpg' }] }), /relative file path/);
  assert.throws(() => validateData({ memories: [{ ...memory, place: '' }] }), /place/);
  assert.throws(() => validateData({}), /memories/);
});

test('shipped JSON is valid and every sample photo exists locally', () => {
  const data = validateData(JSON.parse(readFileSync(new URL('./calander-data.json', import.meta.url), 'utf8')));
  assert.equal(data.memories.length, 31);
  for (const item of data.memories) assert.ok(existsSync(new URL(item.image, import.meta.url)), item.image);
});

test('every date from March 27 through October 28 is available, including blank days', () => {
  const data = validateData(JSON.parse(readFileSync(new URL('./calander-data.json', import.meta.url), 'utf8')));
  const range = calendarRange(data, parseDate('2026-10-28'));
  const visible = new Set();
  for (let month = parseDate('2026-03-01'); month <= range.end; month = shiftDate(month, 1, 'month')) {
    for (const date of monthDays(month)) {
      if (date >= range.start && date <= range.end) visible.add(dateKey(date));
    }
  }
  assert.equal(visible.size, 216);
  for (let date = range.start; date <= range.end; date = shiftDate(date, 1)) assert.ok(visible.has(dateKey(date)));
  assert.ok(data.memories.every(memory => visible.has(memory.date)));
  assert.equal(new Set(data.memories.map(memory => memory.date.slice(0, 7))).size, 8);
  assert.ok(visible.size > data.memories.length);
});

test('navigation stops at the first and last dates and reaches partial boundary months', () => {
  const range = calendarRange({ rangeStart: '2026-03-27', rangeEnd: 'today' }, parseDate('2026-10-28'));
  assert.equal(dateKey(navigateDate(range.start, -1, 'day', range)), '2026-03-27');
  assert.equal(dateKey(navigateDate(range.end, 1, 'day', range)), '2026-10-28');
  assert.equal(dateKey(navigateDate(parseDate('2026-04-01'), -1, 'month', range)), '2026-03-27');
  assert.equal(dateKey(navigateDate(parseDate('2026-09-30'), 1, 'month', range)), '2026-10-28');
  assert.equal(dateKey(navigateDate(parseDate('2026-03-30'), -1, 'month', range)), '2026-03-30');
  assert.equal(dateKey(navigateDate(parseDate('2026-10-01'), 1, 'month', range)), '2026-10-01');
  assert.equal(dateKey(clampDate(parseDate('2026-01-01'), range)), '2026-03-27');
  assert.equal(dateKey(clampDate(parseDate('2027-01-01'), range)), '2026-10-28');
  assert.equal(dateKey(calendarRange({ rangeStart: '2026-03-27', rangeEnd: 'today' }, parseDate('2026-10-29')).end), '2026-10-29');
  assert.throws(() => calendarRange({ rangeStart: '2026-10-28', rangeEnd: '2026-03-27' }), /calendar range/);
});
