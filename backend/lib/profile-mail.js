const fs = require('node:fs/promises');
const path = require('node:path');

const FORBIDDEN_TAG_PATTERN = /<\s*(script|iframe|object|embed|form)\b/i;
const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const CONDITIONAL_PATTERN = /{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/if}}/g;
const ALLOWED_TEMPLATE_KEYS = new Set([
  'name',
  'title',
  'company',
  'email',
  'phone',
  'website',
  'profile_image_url',
  'recipient_email',
  'captured_at',
  'location_name',
  'location_text',
  'latitude',
  'longitude',
  'sender_name',
]);
const PROFILE_ENV_MAP = {
  name: 'PROFILE_NAME',
  title: 'PROFILE_TITLE',
  company: 'PROFILE_COMPANY',
  email: 'PROFILE_EMAIL',
  phone: 'PROFILE_PHONE',
  website: 'PROFILE_WEBSITE',
  profile_image_url: 'PROFILE_IMAGE_URL',
};
const DEFAULT_PROFILE_SUBJECT = 'プロフィール交換のお知らせ';
const DEFAULT_PROFILE_TEXT = '名刺交換ありがとうございます。こちらが私のプロフィールです。';
const DEFAULT_PROFILE_HTML = '<p>名刺交換ありがとうございます。こちらが私のプロフィールです。</p>';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assertNoForbiddenTags(htmlSource, sourceLabel) {
  const match = htmlSource.match(FORBIDDEN_TAG_PATTERN);
  if (match) {
    throw new Error(`${sourceLabel} contains forbidden tag: <${match[1].toLowerCase()}>`);
  }
}

function renderPlaceholders(template, variables, sourceLabel, options = {}) {
  const { htmlEscapeValues = false } = options;
  const usedKeys = new Set();
  template.replace(PLACEHOLDER_PATTERN, (_, key) => {
    usedKeys.add(key);
    return _;
  });

  for (const key of usedKeys) {
    if (!ALLOWED_TEMPLATE_KEYS.has(key)) {
      throw new Error(`${sourceLabel} uses unsupported placeholder: {{${key}}}`);
    }
  }

  return template.replace(PLACEHOLDER_PATTERN, (_, key) => {
    const value = variables[key] ?? '';
    return htmlEscapeValues ? escapeHtml(value) : String(value);
  });
}

function hasVisibleValue(value) {
  return String(value ?? '').trim().length > 0;
}

function renderConditionals(template, variables, sourceLabel) {
  return template.replace(CONDITIONAL_PATTERN, (_, key, inner) => {
    if (!ALLOWED_TEMPLATE_KEYS.has(key)) {
      throw new Error(`${sourceLabel} uses unsupported conditional key: {{#if ${key}}}`);
    }
    return hasVisibleValue(variables[key]) ? inner : '';
  });
}

function toDisplayValue(value) {
  return value == null ? '' : String(value);
}

function getProfileValue(key, profileInfo, env) {
  const envKey = PROFILE_ENV_MAP[key];
  if (envKey && env[envKey] != null) {
    return env[envKey];
  }
  if (key === 'profile_image_url') {
    return profileInfo.imageUrl;
  }
  return profileInfo[key];
}

function getEnvProfileValue(key, env) {
  const envKey = PROFILE_ENV_MAP[key];
  if (!envKey) {
    return '';
  }
  return env[envKey] ?? '';
}

async function loadProfileMailConfig(profileMailConfigPath) {
  const raw = await fs.readFile(profileMailConfigPath, 'utf8');
  return JSON.parse(raw);
}

async function loadInlineAttachments(configDir, inlineAttachments) {
  if (!Array.isArray(inlineAttachments) || inlineAttachments.length === 0) {
    return [];
  }

  return Promise.all(inlineAttachments.map(async (item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`inlineAttachments[${index}] is invalid`);
    }
    if (!item.cid || !item.path) {
      throw new Error(`inlineAttachments[${index}] requires cid and path`);
    }
    const resolvedPath = path.resolve(configDir, item.path);
    const content = await fs.readFile(resolvedPath);
    const attachment = {
      filename: item.filename || path.basename(resolvedPath),
      content: content.toString('base64'),
      cid: item.cid,
    };
    if (item.contentType) {
      attachment.contentType = item.contentType;
    }
    return attachment;
  }));
}

async function buildProfileMessage({
  from,
  recipientEmail,
  senderName,
  latitude,
  longitude,
  locationName = '',
  isoTime,
  profileMailConfigPath,
  env = process.env,
}) {
  const config = await loadProfileMailConfig(profileMailConfigPath);
  const configDir = path.dirname(profileMailConfigPath);
  const locationNameText = toDisplayValue(locationName);
  const locationText = locationNameText;
  const profileInfo = config.profile || {};
  const variables = {
    name: toDisplayValue(getProfileValue('name', profileInfo, env)),
    title: toDisplayValue(getProfileValue('title', profileInfo, env)),
    company: toDisplayValue(getProfileValue('company', profileInfo, env)),
    email: toDisplayValue(getProfileValue('email', profileInfo, env)),
    phone: toDisplayValue(getProfileValue('phone', profileInfo, env)),
    website: toDisplayValue(getProfileValue('website', profileInfo, env)),
    profile_image_url: toDisplayValue(getProfileValue('profile_image_url', profileInfo, env)),
    recipient_email: toDisplayValue(recipientEmail),
    captured_at: isoTime,
    location_name: locationNameText,
    location_text: locationText,
    latitude: toDisplayValue(latitude),
    longitude: toDisplayValue(longitude),
    sender_name: toDisplayValue(senderName),
  };
  const htmlVariables = {
    ...variables,
    name: toDisplayValue(getEnvProfileValue('name', env)),
    title: toDisplayValue(getEnvProfileValue('title', env)),
    company: toDisplayValue(getEnvProfileValue('company', env)),
    email: toDisplayValue(getEnvProfileValue('email', env)),
    phone: toDisplayValue(getEnvProfileValue('phone', env)),
    website: toDisplayValue(getEnvProfileValue('website', env)),
    profile_image_url: toDisplayValue(getEnvProfileValue('profile_image_url', env)),
  };

  const fallback = config.fallback || {};
  const htmlMode = config.htmlMode === 'fallback' ? 'fallback' : 'raw';
  const hasTemplatePath = typeof config.templatePath === 'string' && config.templatePath.length > 0;
  const useFallback = htmlMode === 'fallback' || !hasTemplatePath;

  const subjectTemplate = useFallback
    ? (fallback.subject || profileInfo.subject || DEFAULT_PROFILE_SUBJECT)
    : (profileInfo.subject || DEFAULT_PROFILE_SUBJECT);
  const textTemplate = useFallback
    ? (fallback.text || DEFAULT_PROFILE_TEXT)
    : (profileInfo.text || DEFAULT_PROFILE_TEXT);

  let htmlTemplate;
  if (useFallback) {
    htmlTemplate = fallback.html || DEFAULT_PROFILE_HTML;
  } else {
    const templatePath = path.resolve(configDir, config.templatePath);
    htmlTemplate = await fs.readFile(templatePath, 'utf8');
  }

  assertNoForbiddenTags(htmlTemplate, useFallback ? 'fallback.html' : 'templatePath html');
  const conditionalHtmlTemplate = renderConditionals(htmlTemplate, htmlVariables, 'profile html');
  const html = renderPlaceholders(conditionalHtmlTemplate, htmlVariables, 'profile html', { htmlEscapeValues: true });
  const subject = renderPlaceholders(subjectTemplate, variables, 'profile subject');
  const text = renderPlaceholders(textTemplate, variables, 'profile text');
  const attachments = await loadInlineAttachments(configDir, config.inlineAttachments);

  return {
    from,
    to: recipientEmail,
    subject,
    text,
    html,
    attachments,
  };
}

module.exports = {
  buildProfileMessage,
  renderPlaceholders,
  assertNoForbiddenTags,
  ALLOWED_TEMPLATE_KEYS,
};
