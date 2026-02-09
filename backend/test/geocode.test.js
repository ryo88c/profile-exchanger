const test = require('node:test');
const assert = require('node:assert/strict');

const { reverseGeocode, formatLocationName } = require('../lib/geocode');

test('formatLocationName prioritizes locality + country', () => {
  const name = formatLocationName({
    address: {
      city: 'Chiyoda City',
      country: 'Japan',
    },
  });
  assert.equal(name, 'Chiyoda City, Japan');
});

test('reverseGeocode returns empty string for invalid lat/lon', async () => {
  const value = await reverseGeocode('bad', 139.0);
  assert.equal(value, '');
});

test('reverseGeocode returns formatted value from API response', async () => {
  const value = await reverseGeocode(35.681236, 139.767125, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        address: {
          city: 'Chiyoda City',
          country: 'Japan',
        },
      }),
    }),
  });
  assert.equal(value, 'Chiyoda City, Japan');
});

test('reverseGeocode returns empty string on API error', async () => {
  const value = await reverseGeocode(35.6895, 139.6917, {
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    }),
  });
  assert.equal(value, '');
});
