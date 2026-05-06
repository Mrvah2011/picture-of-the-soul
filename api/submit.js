'use strict';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, session_type } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Sanitize
  const clean = (str) => String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
  const safeName    = clean(name);
  const safePhone   = clean(phone);
  const safeSession = clean(session_type);

  const now = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short'
  });

  const results = await Promise.allSettled([
    sendTelegram(safeName, safePhone, safeSession, now),
    sendEmail(safeName, safePhone, safeSession, now)
  ]);

  const anyOk = results.some(r => r.status === 'fulfilled');

  if (!anyOk) {
    console.error('All channels failed:', results.map(r => r.reason?.message));
    return res.status(500).json({ error: 'Notification failed' });
  }

  return res.status(200).json({ success: true });
};

// ===== Telegram =====
async function sendTelegram(name, phone, session, time) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const sessionRow = session ? `\n🎯 <b>Формат:</b> ${session}` : '';
  const text = [
    '🌸 <b>Новая заявка — Картина Души</b>',
    '',
    `👤 <b>Имя:</b> ${name}`,
    `📞 <b>Телефон:</b> ${phone}${sessionRow}`,
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

// ===== Email via FormSubmit.co (без регистрации и SMTP) =====
async function sendEmail(name, phone, session, time) {
  const emailTo = process.env.EMAIL_TO;
  if (!emailTo) throw new Error('EMAIL_TO not configured');

  const sessionRow = session ? `\nФормат: ${session}` : '';
  const r = await fetch(`https://formsubmit.co/ajax/${emailTo}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: `Новая заявка от ${name} — Картина Души`,
      Имя:      name,
      Телефон:  phone,
      Формат:   session || '—',
      Время:    time,
      _template: 'table'
    })
  });

  if (!r.ok) throw new Error(`FormSubmit error: ${r.status}`);
}
