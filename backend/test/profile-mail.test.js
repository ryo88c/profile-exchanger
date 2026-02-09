const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { buildProfileMessage } = require('../lib/profile-mail');

async function createFixture(config) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-mail-test-'));
  const assetsDir = path.join(dir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
  await fs.writeFile(path.join(assetsDir, 'photo.png'), pngBytes);

  if (config.templatePath && config.templateBody) {
    await fs.writeFile(path.join(dir, config.templatePath), config.templateBody, 'utf8');
  }
  await fs.writeFile(path.join(dir, 'profile-mail.config.json'), JSON.stringify(config, null, 2), 'utf8');
  return path.join(dir, 'profile-mail.config.json');
}

test('raw mode: env values override config and CID attachment is included', async () => {
  const configPath = await createFixture({
    htmlMode: 'raw',
    templatePath: 'profile-email.html',
    templateBody: '<p>{{name}}</p><p>{{location_name}}</p><img src="cid:profile-photo">',
    profile: {
      subject: 'Hello {{name}}',
      text: 'Name={{name}}',
      name: 'Config Name',
      email: 'config@example.com',
    },
    inlineAttachments: [
      { cid: 'profile-photo', path: './assets/photo.png', filename: 'photo.png', contentType: 'image/png' },
    ],
  });

  const msg = await buildProfileMessage({
    from: 'Tester <tester@example.com>',
    recipientEmail: 'to@example.com',
    senderName: 'Tester',
    latitude: 35.0,
    longitude: 139.0,
    locationName: 'Chiyoda City, Japan',
    isoTime: '2026-02-09T00:00:00.000Z',
    profileMailConfigPath: configPath,
    env: { PROFILE_NAME: 'Env Name' },
  });

  assert.equal(msg.subject, 'Hello Env Name');
  assert.equal(msg.text, 'Name=Env Name');
  assert.match(msg.html, /<p>Env Name<\/p>/);
  assert.match(msg.html, /<p>Chiyoda City, Japan<\/p>/);
  assert.equal(msg.attachments.length, 1);
  assert.equal(msg.attachments[0].cid, 'profile-photo');
  assert.equal(msg.attachments[0].contentType, 'image/png');
});

test('missing PROFILE_* env variables resolve to empty string without errors', async () => {
  const configPath = await createFixture({
    htmlMode: 'raw',
    templatePath: 'profile-email.html',
    templateBody: '<p>{{name}}</p><p>{{phone}}</p>',
    profile: {
      subject: 's',
      text: 't',
    },
  });

  const msg = await buildProfileMessage({
    from: 'Tester <tester@example.com>',
    recipientEmail: 'to@example.com',
    senderName: 'Tester',
    latitude: 35.0,
    longitude: 139.0,
    isoTime: '2026-02-09T00:00:00.000Z',
    profileMailConfigPath: configPath,
    env: {},
  });

  assert.match(msg.html, /<p><\/p><p><\/p>/);
});

test('unsupported placeholders return error', async () => {
  const configPath = await createFixture({
    htmlMode: 'raw',
    templatePath: 'profile-email.html',
    templateBody: '<p>{{unknown_key}}</p>',
    profile: { subject: 's', text: 't' },
  });

  await assert.rejects(
    buildProfileMessage({
      from: 'Tester <tester@example.com>',
      recipientEmail: 'to@example.com',
      senderName: 'Tester',
      latitude: 35.0,
      longitude: 139.0,
      isoTime: '2026-02-09T00:00:00.000Z',
      profileMailConfigPath: configPath,
      env: {},
    }),
    /unsupported placeholder/
  );
});

test('forbidden tag in html returns error', async () => {
  const configPath = await createFixture({
    htmlMode: 'raw',
    templatePath: 'profile-email.html',
    templateBody: '<script>alert(1)</script>',
    profile: { subject: 's', text: 't' },
  });

  await assert.rejects(
    buildProfileMessage({
      from: 'Tester <tester@example.com>',
      recipientEmail: 'to@example.com',
      senderName: 'Tester',
      latitude: 35.0,
      longitude: 139.0,
      isoTime: '2026-02-09T00:00:00.000Z',
      profileMailConfigPath: configPath,
      env: {},
    }),
    /forbidden tag/
  );
});

test('fallback mode uses fallback.html when configured', async () => {
  const configPath = await createFixture({
    htmlMode: 'fallback',
    templatePath: 'profile-email.html',
    templateBody: '<p>raw</p>',
    profile: { subject: 'subject {{name}}', text: 'text {{name}}', name: 'Config Name' },
    fallback: {
      subject: 'fallback subject {{name}}',
      text: 'fallback text {{name}}',
      html: '<div>fallback {{name}}</div>',
    },
  });

  const msg = await buildProfileMessage({
    from: 'Tester <tester@example.com>',
    recipientEmail: 'to@example.com',
    senderName: 'Tester',
    latitude: 35.0,
    longitude: 139.0,
    isoTime: '2026-02-09T00:00:00.000Z',
    profileMailConfigPath: configPath,
    env: {},
  });

  assert.equal(msg.subject, 'fallback subject Config Name');
  assert.equal(msg.text, 'fallback text Config Name');
  assert.match(msg.html, /fallback Config Name/);
});
