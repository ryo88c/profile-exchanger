const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');

const execAsync = promisify(exec);
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const MAX_LOG_TEXT_LENGTH = 4000;

function extractEmail(text) {
  if (!text) {
    return null;
  }
  const match = String(text).match(EMAIL_PATTERN);
  return match ? match[0] : null;
}

function decodeDataUrlImage(imageDataUrl) {
  if (typeof imageDataUrl !== 'string') {
    throw new Error('image must be a data URL string');
  }
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('image must be a base64 data URL');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function shellEscapeSingleQuoted(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function resolveImageExtension(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }
  return 'img';
}

function clipText(value) {
  const text = String(value || '');
  if (text.length <= MAX_LOG_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_LOG_TEXT_LENGTH)}...[truncated]`;
}

function isTimeoutError(err) {
  return Boolean(
    err &&
    (
      err.killed ||
      err.signal === 'SIGTERM' ||
      err.code === 'ETIMEDOUT'
    )
  );
}

function getOcrErrorLogPath(errorLogPath) {
  if (errorLogPath) {
    return path.resolve(errorLogPath);
  }
  if (process.env.OCR_ERROR_LOG_PATH) {
    return path.resolve(process.env.OCR_ERROR_LOG_PATH);
  }
  return path.resolve(__dirname, '../logs/ocr-errors.log');
}

async function appendOcrErrorLog(entry, errorLogPath) {
  const logPath = getOcrErrorLogPath(errorLogPath);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function reportOcrCommandFailure({ command, commandCwd, timeoutMs, err, errorLogPath }) {
  const entry = {
    timestamp: new Date().toISOString(),
    category: 'ocr_command_failure',
    command,
    commandCwd,
    timeoutMs,
    isTimeout: isTimeoutError(err),
    signal: err?.signal || null,
    code: err?.code || null,
    exitCode: typeof err?.code === 'number' ? err.code : null,
    message: clipText(err?.message),
    stderr: clipText(err?.stderr),
    stdout: clipText(err?.stdout),
  };

  try {
    await appendOcrErrorLog(entry, errorLogPath);
  } catch (logErr) {
    console.error('[ocr] failed to write error log:', logErr);
  }
}

async function runCommandOcr(imageDataUrl, options = {}) {
  const commandTemplate = options.commandTemplate || process.env.OCR_COMMAND;
  const commandCwd = options.commandCwd || process.env.OCR_COMMAND_CWD || path.resolve(__dirname, '..');
  const timeoutMs = Number(options.timeoutMs || process.env.OCR_COMMAND_TIMEOUT_MS || 30000);
  const errorLogPath = options.errorLogPath;
  if (!commandTemplate) {
    throw new Error('OCR_COMMAND is not set');
  }

  const { mimeType, buffer } = decodeDataUrlImage(imageDataUrl);
  const ext = resolveImageExtension(mimeType);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-command-'));
  const inputPath = path.join(tempDir, `input.${ext}`);
  await fs.writeFile(inputPath, buffer);

  const command = commandTemplate.includes('{input}')
    ? commandTemplate.replaceAll('{input}', shellEscapeSingleQuoted(inputPath))
    : `${commandTemplate} ${shellEscapeSingleQuoted(inputPath)}`;

  try {
    const { stdout } = await execAsync(command, {
      cwd: commandCwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      shell: true,
    });
    return String(stdout || '').trim();
  } catch (err) {
    await reportOcrCommandFailure({
      command,
      commandCwd,
      timeoutMs,
      err,
      errorLogPath,
    });

    const wrapped = new Error('OCR command failed');
    wrapped.code = 'OCR_COMMAND_FAILED';
    wrapped.isTimeout = isTimeoutError(err);
    wrapped.stderr = String(err?.stderr || '').trim();
    wrapped.stdout = String(err?.stdout || '').trim();
    wrapped.exitCode = typeof err?.code === 'number' ? err.code : null;
    wrapped.signal = err?.signal || null;
    throw wrapped;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runOcr(imageDataUrl, options = {}) {
  const provider = options.provider || process.env.OCR_PROVIDER || 'disabled';
  if (provider === 'disabled') {
    throw new Error('OCR provider is disabled');
  }
  if (provider === 'command') {
    return runCommandOcr(imageDataUrl, options);
  }
  throw new Error(`unsupported OCR provider: ${provider}`);
}

module.exports = {
  extractEmail,
  runOcr,
  runCommandOcr,
  decodeDataUrlImage,
};
