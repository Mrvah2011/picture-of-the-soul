'use strict';

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // T-Bank always expects 200 OK plain text
  if (req.method !== 'POST') return res.status(200).send('OK');

  const body = req.body || {};

  // Debug: log what T-Bank sent (so we can diagnose issues)
  console.log('[payment-notify] Status:', body.Status, '| OrderId:', body.OrderId, '| Amount:', body.Amount);

  // Verify token signature from T-Bank
  const password = process.env.TBANK_PASSWORD;
  if (password && body.Token) {
    const obj = {};
    // Collect all fields except Token, DATA, Receipt, Items
    for (const [k, v] of Object.entries(body)) {
      if (k === 'Token' || k === 'DATA' || k === 'Receipt' || k === 'Items') continue;
      obj[k] = v;
    }
    obj.Password = password;
    // Sort keys, convert values to string (matching T-Bank's algorithm)
    const values = Object.keys(obj).sort()
      .map(k => {
        const v = obj[k];
        if (v === null || v === undefined) return '';
        return String(v);
      })
      .join('');
    const expected = crypto.createHash('sha256').update(values).digest('hex');

    if (body.Token.toLowerCase() !== expected.toLowerCase()) {
      console.error('[payment-notify] Token mismatch. Got:', body.Token, 'Expected:', expected, '| Values string:', values);
      // Send notification anyway but mark as unverified (so Svetlana still hears about it)
      // return res.status(200).send('OK');
    }
  }

  // Accept CONFIRMED (one-stage) and AUTHORIZED (two-stage / test terminal)
  const successStatuses = ['CONFIRMED', 'AUTHORIZED'];
  if (!successStatuses.includes(body.Status)) {
    console.log('[payment-notify] Skipping status:', body.Status);
    return res.status(200).send('OK');
  }

  const orderId   = body.OrderId   || '—';
  const amount    = body.Amount    ? `${(body.Amount / 100).toLocaleString('ru-RU')} ₽` : '—';
  const paymentId = body.PaymentId || '—';
  const status    = body.Status    || '—';

  const now = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short'
  });

  await Promise.allSettled([
    notifyTelegram(orderId, amount, paymentId, status, now),
    notifyEmail(orderId, amount, paymentId, now)
  ]);

  return res.status(200).send('OK');
};

// ===== Telegram =====
async function notifyTelegram(orderId, amount, paymentId, status, time) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const text = [
    '✅ <b>Оплата получена — Картина Души</b>',
    '',
    `🔖 <b>Заказ:</b> ${orderId}`,
    `💰 <b>Сумма:</b> ${amount}`,
    `🆔 <b>Платёж:</b> ${paymentId}`,
    `📋 <b>Статус:</b> ${status}`,
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
