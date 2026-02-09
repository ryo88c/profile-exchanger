const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

const cache = new Map();

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeLatLon(latitude, longitude) {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  if (lat == null || lon == null) {
    return null;
  }
  return { lat, lon };
}

function toCacheKey(lat, lon) {
  // Reduce cache cardinality while keeping enough precision for city-level labels.
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function pruneCache(maxEntries) {
  while (cache.size > maxEntries) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function formatLocationName(json) {
  if (!json || typeof json !== 'object') {
    return '';
  }

  const address = json.address || {};
  const locality = address.city
    || address.town
    || address.village
    || address.municipality
    || address.county
    || address.state
    || '';
  const country = address.country || '';
  const displayName = typeof json.display_name === 'string' ? json.display_name : '';

  if (locality && country) {
    return `${locality}, ${country}`;
  }
  return locality || country || displayName || '';
}

async function reverseGeocode(latitude, longitude, options = {}) {
  const normalized = normalizeLatLon(latitude, longitude);
  if (!normalized) {
    return '';
  }

  const ttlMs = Number(options.ttlMs ?? process.env.REVERSE_GEOCODE_CACHE_TTL_MS ?? 86400000);
  const timeoutMs = Number(options.timeoutMs ?? process.env.REVERSE_GEOCODE_TIMEOUT_MS ?? 5000);
  const maxCacheEntries = Number(options.maxCacheEntries ?? process.env.REVERSE_GEOCODE_CACHE_MAX_ENTRIES ?? 500);
  const endpoint = options.endpoint || process.env.REVERSE_GEOCODE_ENDPOINT || DEFAULT_ENDPOINT;
  const userAgent = options.userAgent || process.env.REVERSE_GEOCODE_USER_AGENT || 'profile-exchange-app/1.0';
  const fetchImpl = options.fetchImpl || fetch;
  const language = options.language || process.env.REVERSE_GEOCODE_LANGUAGE || 'ja,en';

  const cacheKey = toCacheKey(normalized.lat, normalized.lon);
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(endpoint);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(normalized.lat));
    url.searchParams.set('lon', String(normalized.lon));
    url.searchParams.set('zoom', '16');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', language);

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`reverse geocode failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const value = formatLocationName(payload);
    cache.set(cacheKey, { value, expiresAt: now + ttlMs });
    pruneCache(maxCacheEntries);
    return value;
  } catch (err) {
    // Do not fail the main flow; return empty location label on lookup errors.
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  reverseGeocode,
  formatLocationName,
};
