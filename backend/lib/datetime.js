const DEFAULT_TIMEZONE = 'Asia/Tokyo';
const DEFAULT_LOCALE = 'ja-JP';
const DEFAULT_FORMAT = 'YYYY/MM/DD HH:mm:ss';

function getFormatterParts(date, locale, timeZone) {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return map;
}

function getOffsetToken(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    if (!tzPart || !tzPart.value) {
      return '';
    }
    return tzPart.value.replace('GMT', 'UTC');
  } catch (err) {
    return '';
  }
}

function formatDateTime(value, env = process.env) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }

  const locale = env.DATETIME_LOCALE || DEFAULT_LOCALE;
  const timeZone = env.DATETIME_TIMEZONE || DEFAULT_TIMEZONE;
  const format = env.DATETIME_FORMAT || DEFAULT_FORMAT;

  let parts;
  try {
    parts = getFormatterParts(date, locale, timeZone);
  } catch (err) {
    parts = getFormatterParts(date, DEFAULT_LOCALE, DEFAULT_TIMEZONE);
  }

  const offset = getOffsetToken(date, timeZone) || getOffsetToken(date, DEFAULT_TIMEZONE);
  const replacements = {
    YYYY: parts.year,
    MM: parts.month,
    DD: parts.day,
    HH: parts.hour,
    mm: parts.minute,
    ss: parts.second,
    TZ: timeZone,
    OFFSET: offset,
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss|TZ|OFFSET/g, (token) => replacements[token] || token);
}

module.exports = {
  formatDateTime,
  DEFAULT_TIMEZONE,
  DEFAULT_LOCALE,
  DEFAULT_FORMAT,
};
