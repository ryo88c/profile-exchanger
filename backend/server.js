require('dotenv').config();
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// SMTP check
if (!process.env.SMTP_HOST) {
  console.warn('Warning: SMTP_HOST is not set. Emails will not be sent.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      }
    : undefined,
});

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
  const senderEmail = process.env.SENDER_EMAIL;
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
    if (process.env.SMTP_USER && senderEmail) {
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
