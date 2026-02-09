const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { extractEmail, decodeDataUrlImage, runOcr } = require('../lib/ocr');

test('extractEmail returns first email from OCR text', () => {
  const email = extractEmail('contact: first@example.com / second@example.com');
  assert.equal(email, 'first@example.com');
});

test('extractEmail returns null when no email exists', () => {
  assert.equal(extractEmail('no mail here'), null);
});

test('decodeDataUrlImage parses valid image data URL', () => {
  const parsed = decodeDataUrlImage('data:image/png;base64,aGVsbG8=');
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.buffer.toString('utf8'), 'hello');
});

test('decodeDataUrlImage throws for invalid input', () => {
  assert.throws(() => decodeDataUrlImage('invalid-data-url'), /base64 data URL/);
});

test('runOcr command provider returns stdout text', async () => {
  const text = await runOcr('data:image/png;base64,aGVsbG8=', {
    provider: 'command',
    commandTemplate: 'node -e "process.stdout.write(\'qa@example.com\')" {input}',
  });
  assert.equal(text, 'qa@example.com');
});

test('runOcr throws when provider is disabled', async () => {
  await assert.rejects(
    runOcr('data:image/png;base64,aGVsbG8=', { provider: 'disabled' }),
    /disabled/
  );
});

test('command failure writes stderr log and exposes OCR_COMMAND_FAILED', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-log-test-'));
  const logPath = path.join(dir, 'ocr-errors.log');

  await assert.rejects(
    runOcr('data:image/png;base64,aGVsbG8=', {
      provider: 'command',
      commandTemplate: 'node -e "process.stderr.write(\'bad ocr\\n\'); process.exit(3)" {input}',
      errorLogPath: logPath,
    }),
    (err) => {
      assert.equal(err.code, 'OCR_COMMAND_FAILED');
      assert.equal(err.isTimeout, false);
      assert.match(err.stderr, /bad ocr/);
      return true;
    }
  );

  const raw = await fs.readFile(logPath, 'utf8');
  const lines = raw.trim().split('\n');
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.category, 'ocr_command_failure');
  assert.equal(entry.isTimeout, false);
  assert.equal(entry.exitCode, 3);
  assert.match(entry.stderr, /bad ocr/);
});

test('command timeout writes timeout log and marks timeout flag', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-timeout-test-'));
  const logPath = path.join(dir, 'ocr-errors.log');

  await assert.rejects(
    runOcr('data:image/png;base64,aGVsbG8=', {
      provider: 'command',
      commandTemplate: 'node -e "setTimeout(()=>{}, 1000)" {input}',
      timeoutMs: 20,
      errorLogPath: logPath,
    }),
    (err) => {
      assert.equal(err.code, 'OCR_COMMAND_FAILED');
      assert.equal(err.isTimeout, true);
      return true;
    }
  );

  const raw = await fs.readFile(logPath, 'utf8');
  const lines = raw.trim().split('\n');
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.category, 'ocr_command_failure');
  assert.equal(entry.isTimeout, true);
});
