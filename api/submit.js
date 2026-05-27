'use strict';

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, session_type } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Missing required fields' });

  const clean = (str) => String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
  const safeName    = clean(name);
  const safePhone   = clean(phone);
  const safeSession = clean(session_type);

  const orderId = `KD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const now = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short'
  });

  // Send notifications (non-blocking — don't wait for email)
  await Promise.allSettled([
    sendTelegram(safeName, safePhone, safeSession, orderId, now),
    sendEmail(safeName, safePhone, safeSession, orderId, now)
  ]);

  // Initialize T-Bank payment
  let paymentUrl = null;
  try {
    paymentUrl = await initPayment(safeName, safePhone, safeSession, orderId);
  } catch (e) {
    console.error('T-Bank init failed:', e.message);
    // Don't fail the whole request — we already sent the notification
  }

  return res.status(200).json({ success: true, paymentUrl, orderId });
};

// ===== T-Bank token =====
function tBankToken(params, password) {
  const obj = { ...params, Password: password };
  delete obj.Token; delete obj.DATA; delete obj.Receipt; delete obj.Items;
  const values = Object.keys(obj).sort().map(k => String(obj[k])).join('');
  return crypto.createHash('sha256').update(values).digest('hex');
}

// ===== T-Bank Init =====
async function initPayment(name, phone, sessionType, orderId) {
  const terminalKey = process.env.TBANK_TERMINAL_KEY;
  const password    = process.env.TBANK_PASSWORD;
  if (!terminalKey || !password) throw new Error('T-Bank not configured');

  const amountKopecks = sessionType?.includes('Групповое') ? 620000 : 2040000;

  const params = {
    TerminalKey:     terminalKey,
    Amount:          amountKopecks,
    OrderId:         orderId,
    Description:     `Картина Души — ${sessionType || 'Сессия'}`,
    NotificationURL: 'https://kartina-dushi.vercel.app/api/payment-notify',
    SuccessURL:      'https://kartina-dushi.vercel.app/?payment=success',
    FailURL:         'https://kartina-dushi.vercel.app/?payment=fail',
    DATA:            { Phone: phone, Name: name }
  };
  params.Token = tBankToken(params, password);

  const r = await fetch('https://securepay.tinkoff.ru/v2/Init', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params)
  });
  const data = await r.json();
  if (!data.Success) throw new Error(`T-Bank: ${data.Message || data.ErrorCode}`);
  return data.PaymentURL;
}

// ===== Telegram =====
async function sendTelegram(name, phone, session, orderId, time) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const sessionRow = session ? `\n🎯 <b>Формат:</b> ${session}` : '';
  const text = [
    '🌸 <b>Новая заявка — Картина Души</b>',
    '',
    `👤 <b>Имя:</b> ${name}`,
    `📞 <b>Телефон:</b> ${phone}${sessionRow}`,
    `🔖 <b>Заказ:</b> ${orderId}`,
    '',
    `🕐 ${time}`,
    '⏳ Ожидаем оплату…'
  ].join('\n');

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
  if (!r.ok) throw new Error(`Telegram API ${r.status}`);
}

// ===== Email via FormSubmit.co =====
async function sendEmail(name, phone, session, orderId, time) {
  const emailTo = process.env.EMAIL_TO;
  if (!emailTo) throw new Error('EMAIL_TO not configured');

  const r = await fetch(`https://formsubmit.co/ajax/${emailTo}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: `Новая заявка от ${name} — Картина Души`,
      Имя:      name,
      Телефон:  phone,
      Формат:   session || '—',
      Заказ:    orderId,
      Статус:   'Ожидает оплату',
      Время:    time,
      _template: 'table'
    })
  });
  if (!r.ok) throw new Error(`FormSubmit error: ${r.status}`);
}
