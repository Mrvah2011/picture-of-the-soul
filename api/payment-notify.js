'use strict';

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // T-Bank always expects 200 OK plain text
  if (req.method !== 'POST') return res.status(200).send('OK');

  const body = req.body || {};

  // Verify token from T-Bank
  const password = process.env.TBANK_PASSWORD;
  if (password) {
    const obj = { ...body, Password: password };
    delete obj.Token; delete obj.DATA; delete obj.Receipt; delete obj.Items;
    const values = Object.keys(obj).sort().map(k => String(obj[k])).join('');
    const expected = crypto.createHash('sha256').update(values).digest('hex');
    if (body.Token !== expected) {
      console.error('T-Bank token mismatch — ignoring notification');
      return res.status(200).send('OK');
    }
  }

  // Only notify on final successful status
  if (body.Status !== 'CONFIRMED') {
    return res.status(200).send('OK');
  }

  const orderId  = body.OrderId  || '—';
  const amount   = body.Amount   ? `${(body.Amount / 100).toLocaleString('ru-RU')} ₽` : '—';
  const paymentId = body.PaymentId || '—';

  const now = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short'
  });

  await Promise.allSettled([
    notifyTelegram(orderId, amount, paymentId, now),
    notifyEmail(orderId, amount, paymentId, now)
  ]);

  return res.status(200).send('OK');
};

// ===== Telegram =====
async function notifyTelegram(orderId, amount, paymentId, time) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const text = [
    '✅ <b>Оплата подтверждена — Картина Души</b>',
    '',
    `🔖 <b>Заказ:</b> ${orderId}`,
    `💰 <b>Сумма:</b> ${amount}`,
    `🆔 <b>Платёж:</b> ${paymentId}`,
    '',
    `🕐 ${time}`
  ].join('\n');

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
  if (!r.ok) throw new Error(`Telegram API ${r.status}`);
}

// ===== Email via FormSubmit.co =====
async function notifyEmail(orderId, amount, paymentId, time) {
  const emailTo = process.env.EMAIL_TO;
  if (!emailTo) throw new Error('EMAIL_TO not configured');

  const r = await fetch(`https://formsubmit.co/ajax/${emailTo}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: `✅ Оплата получена — Заказ ${orderId}`,
      Заказ:    orderId,
      Сумма:    amount,
      Платёж:   paymentId,
      Статус:   'ОПЛАЧЕНО ✅',
      Время:    time,
      _template: 'table'
    })
  });
  if (!r.ok) throw new Error(`FormSubmit error: ${r.status}`);
}
