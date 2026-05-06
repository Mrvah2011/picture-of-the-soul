'use strict';

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, telegram, phone, session_type } = req.body || {};

  if (!name || !telegram) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Sanitize: strip HTML tags, limit length
  const clean = (str) =>
    String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);

  const safeName     = clean(name);
  const safeTelegram = clean(telegram);
  const safePhone    = clean(phone);
  const safeSession  = clean(session_type);

  const now = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const results = await Promise.allSettled([
    sendTelegram(safeName, safeTelegram, safePhone, safeSession, now),
    sendEmail(safeName, safeTelegram, safePhone, safeSession, now)
  ]);

  const anyOk = results.some(r => r.status === 'fulfilled');

  if (!anyOk) {
    console.error('All notification channels failed:', results.map(r => r.reason?.message));
    return res.status(500).json({ error: 'Notification failed' });
  }

  return res.status(200).json({ success: true });
};

// ===== Telegram =====
async function sendTelegram(name, telegram, phone, session, time) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const phoneRow   = phone   ? `\n📞 <b>Телефон:</b> ${phone}`   : '';
  const sessionRow = session ? `\n🎯 <b>Формат:</b> ${session}`   : '';
  const text = [
    '🌸 <b>Новая заявка — Картина Души</b>',
    '',
    `👤 <b>Имя:</b> ${name}`,
    `✈️ <b>Telegram:</b> ${telegram}${phoneRow}${sessionRow}`,
    '',
    `🕐 ${time}`
  ].join('\n');

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
  if (!r.ok) throw new Error(`Telegram API ${r.status}`);
}

// ===== Email =====
async function sendEmail(name, telegram, phone, session, time) {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_TO } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    throw new Error('Email not configured');
  }

  const port   = Number(EMAIL_PORT) || 465;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host:   EMAIL_HOST,
    port,
    secure,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });

  const phoneRow   = phone   ? `<tr><td style="padding:6px 0;color:#888;white-space:nowrap">Телефон:</td><td style="padding:6px 0;padding-left:16px;font-weight:600">${phone}</td></tr>` : '';
  const sessionRow = session ? `<tr><td style="padding:6px 0;color:#888;white-space:nowrap">Формат:</td><td style="padding:6px 0;padding-left:16px;font-weight:600;color:#FFB800">${session}</td></tr>` : '';

  await transporter.sendMail({
    from:    `"Картина Души" <${EMAIL_USER}>`,
    to:      EMAIL_TO,
    subject: `Новая заявка от ${name}`,
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#FFB800,#E29578);padding:28px 36px">
              <p style="margin:0;font-size:20px;font-weight:700;color:#0A0A0B;font-family:Georgia,serif;letter-spacing:.04em">Картина Души</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(10,10,11,.65)">Светлана Юзмиева · Новая заявка</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="padding:6px 0;color:#888;white-space:nowrap">Имя:</td>
                    <td style="padding:6px 0;padding-left:16px;font-weight:600;color:#111">${name}</td></tr>
                <tr><td style="padding:6px 0;color:#888;white-space:nowrap">Telegram:</td>
                    <td style="padding:6px 0;padding-left:16px;font-weight:600;color:#111">${telegram}</td></tr>
                ${phoneRow}${sessionRow}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px;font-size:12px;color:#aaa;border-top:1px solid #f0f0f0;padding-top:20px">
              ${time} · Москва
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  });
}
