const test = require('node:test');
const assert = require('node:assert/strict');

const { formatDateTime } = require('../lib/datetime');

test('formatDateTime uses Japan defaults', () => {
  const formatted = formatDateTime('2026-02-09T00:00:00.000Z', {});
  assert.equal(formatted, '2026/02/09 09:00:00');
});

test('formatDateTime supports env timezone and custom format', () => {
  const formatted = formatDateTime('2026-02-09T00:00:00.000Z', {
    DATETIME_TIMEZONE: 'UTC',
    DATETIME_LOCALE: 'en-US',
    DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss TZ OFFSET',
  });
  assert.match(formatted, /^2026-02-09 00:00:00 UTC UTC/);
});
