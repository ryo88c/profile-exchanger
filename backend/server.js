require('dotenv').config();
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpSecure = String(process.env.SMTP_SECURE).toLowerCase() === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS || '';
const senderEmail = process.env.SENDER_EMAIL;
const selfEmail = process.env.SELF_EMAIL;

// SMTP check
if (!smtpHost) {
  console.warn('Warning: SMTP_HOST is not set. Emails will not be sent.');
}
console.log('SMTP env present:', {
  SMTP_HOST: !!smtpHost,
  SMTP_PORT: !!smtpPort,
  SMTP_SECURE: !!process.env.SMTP_SECURE,
  SMTP_USER: !!smtpUser,
  SMTP_PASS: !!smtpPass,
  SENDER_EMAIL: !!senderEmail,
  SELF_EMAIL: !!selfEmail,
});

const transporter = nodemailer.createTransport(
  smtpHost
    ? {
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure,
        auth: smtpUser
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
      }
    : {
        service: 'gmail',
        auth: smtpUser
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
      }
);

app.use(cors());
// Accept JSON payloads up to 10MB (enough for small images)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
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
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const isoTime = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const base64Image = image.split(',')[1];
  const selfMsg = {
    from,
    to: process.env.SELF_EMAIL,
    subject: '名刺交換の記録',
    text: `名刺交換の記録です。撮影日時: ${isoTime} 位置: (${latitude}, ${longitude})`,
    html: `<p>名刺交換の記録です。</p><p>撮影日時: ${isoTime}</p><p>位置: (${latitude}, ${longitude})</p>`,
    attachments: [
      {
        filename: 'business_card.png',
        content: base64Image,
        encoding: 'base64',
        contentType: 'image/png',
      },
    ],
  };
  // Prepare profile email to contact
  const profileMsg = sendProfile ? {
    from,
    to: email,
    subject: 'プロフィール交換のお知らせ',
    text: '名刺交換ありがとうございます。こちらが私のプロフィールです。',
    html: '<p>名刺交換ありがとうございます。こちらが私のプロフィールです。</p>',
  } : null;
  try {
    // Send self email first
    if (smtpUser && senderEmail) {
      await transporter.sendMail(selfMsg);
      if (profileMsg) {
        await transporter.sendMail(profileMsg);
      }
      res.json({ message: 'メール送信が完了しました' });
    } else {
      console.log('SMTP settings are not set; skipping email send.');
      res.json({ message: 'メール送信 (ダミー) が完了しました' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
