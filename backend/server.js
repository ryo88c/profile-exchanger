require('dotenv').config();
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const { buildProfileMessage } = require('./lib/profile-mail');
const { runOcr, extractEmail } = require('./lib/ocr');
const { reverseGeocode } = require('./lib/geocode');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;
const selfEmail = process.env.SELF_EMAIL;
const profileMailConfigPath = process.env.PROFILE_MAIL_CONFIG
  ? path.resolve(process.env.PROFILE_MAIL_CONFIG)
  : path.resolve(__dirname, 'user-mail/profile-mail.config.json');

if (!resendApiKey) {
  console.warn('Warning: RESEND_API_KEY is not set. Emails will not be sent.');
}
if (!resendFrom) {
  console.warn('Warning: RESEND_FROM is not set.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

app.use(cors());
// Accept JSON payloads up to 10MB (enough for small images)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint for OCR PoC
app.post('/ocr', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image is required' });
  }

  try {
    const text = await runOcr(image);
    const email = extractEmail(text);
    res.json({ text, email });
  } catch (err) {
    const isTimeout = Boolean(err && err.isTimeout);
    const code = err && err.code ? err.code : 'OCR_FAILED';
    const errorMessage = isTimeout
      ? 'OCRに失敗しました: タイムアウトしました'
      : `OCRに失敗しました: ${err.message}`;
    res.status(400).json({ error: errorMessage, code, isTimeout });
  }
});

// Endpoint to receive image and metadata and send emails
app.post('/send', async (req, res) => {
  const { image, email, latitude, longitude, timestamp, sendProfile } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image is required' });
  }
  if (sendProfile && !email) {
    return res.status(400).json({ error: 'email is required when sending profile' });
  }
  // Prepare self email with attachment
  const senderName = process.env.SENDER_NAME || 'Profile Exchange';
  const from = senderName ? `${senderName} <${resendFrom}>` : resendFrom;
  const isoTime = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const locationName = await reverseGeocode(latitude, longitude);
  const locationText = locationName
    ? `${locationName} (${latitude}, ${longitude})`
    : `(${latitude}, ${longitude})`;
  const base64Image = image.split(',')[1];
  const selfMsg = {
    from,
    to: selfEmail,
    subject: '名刺交換の記録',
    text: `名刺交換の記録です。撮影日時: ${isoTime} 位置: ${locationText}`,
    html: `<p>名刺交換の記録です。</p><p>撮影日時: ${isoTime}</p><p>位置: ${locationText}</p>`,
    attachments: [
      {
        filename: 'business_card.png',
        content: base64Image,
      },
    ],
  };
  try {
    const profileMsg = sendProfile ? await buildProfileMessage({
      from,
      recipientEmail: email,
      senderName,
      latitude,
      longitude,
      locationName,
      isoTime,
      profileMailConfigPath,
    }) : null;

    if (!resend || !from || !selfEmail) {
      console.log('Resend settings are not set; skipping email send.');
      res.json({ message: 'メール送信 (ダミー) が完了しました' });
      return;
    }

    const selfResult = await resend.emails.send(selfMsg);
    if (selfResult.error) {
      throw new Error(selfResult.error.message || 'Resend error');
    }
    if (profileMsg) {
      const profileResult = await resend.emails.send(profileMsg);
      if (profileResult.error) {
        throw new Error(profileResult.error.message || 'Resend error');
      }
    }
    res.json({ message: 'メール送信が完了しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `メール送信に失敗しました: ${err.message}` });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
