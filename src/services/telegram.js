import TelegramBot from 'node-telegram-bot-api';
import { log } from '../utils/logger.js';

let bot = null;
let chatId = null;

export function initBot(token, targetChatId) {
  bot = new TelegramBot(token, { polling: false });
  chatId = targetChatId;
  log.info('Telegram bot initialized.');
}

/**
 * Send HTML message. Splits messages over 4000 chars.
 */
export async function sendMessage(html) {
  if (!bot || !chatId) {
    log.error('Bot not initialized.');
    return;
  }

  const MAX = 4000;

  if (html.length <= MAX) {
    try {
      await bot.sendMessage(chatId, html, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (error) {
      log.error('TG send failed:', error.message);
      // Fallback: strip HTML and retry
      if (error.message.includes('parse') || error.message.includes('HTML')) {
        try {
          await bot.sendMessage(chatId, html.replace(/<[^>]*>/g, ''));
        } catch (e2) {
          log.error('TG fallback send failed:', e2.message);
        }
      }
    }
    return;
  }

  // Split at line boundaries
  const lines = html.split('\n');
  let chunk = '';
  for (const line of lines) {
    if ((chunk + '\n' + line).length > MAX && chunk) {
      await sendMessage(chunk);
      chunk = line;
    } else {
      chunk += (chunk ? '\n' : '') + line;
    }
  }
  if (chunk) await sendMessage(chunk);
}

// Rate-limited queue: 3s between messages to same chat
const queue = [];
let processing = false;

export async function queueMessage(html) {
  if (!html) return;
  queue.push(html);
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const msg = queue.shift();
    await sendMessage(msg);
    if (queue.length > 0) await new Promise((r) => setTimeout(r, 3000));
  }
  processing = false;
}
