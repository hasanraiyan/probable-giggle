const TelegramBot = require('node-telegram-bot-api');

// Initialize the Telegram bot (token will be loaded from environment variables)
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot;

if (token) {
  bot = new TelegramBot(token, { polling: false });
}

// Store last notification timestamps to prevent spam
const lastNotificationTimestamps = new Map();

/**
 * Send a notification to a user via Telegram with rate limiting
 * @param {string} chatId - The Telegram chat ID of the user
 * @param {object} site - The site object with URL and other details
 * @param {object} previousLog - The previous log entry for this site
 * @param {object} currentLog - The current log entry for this site
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
const sendNotification = async (chatId, site, previousLog, currentLog) => {
  // Only send notification if bot is properly configured
  if (!bot || !chatId) {
    return false;
  }

  try {
    // Check if status has changed
    const statusChanged = previousLog && previousLog.status !== currentLog.status;
    
    // If there's no status change, don't send notification
    if (!statusChanged) {
      return false;
    }

    // Implement rate limiting (max one notification per hour per site)
    const key = `${chatId}-${site.id}`;
    const now = Date.now();
    const lastNotification = lastNotificationTimestamps.get(key) || 0;
    const oneHour = 60 * 60 * 1000;
    
    if (now - lastNotification < oneHour) {
      console.log(`[Telegram] Skipping notification for site ${site.url} - rate limited`);
      return false;
    }

    // Format the message
    const statusChange = `${previousLog.status} → ${currentLog.status}`;
    const timestamp = new Date(currentLog.checked_at).toLocaleString();
    
    let message = `🚨 Uptime Alert\n\n`;
    message += `Status Change: ${statusChange}\n`;
    message += `Site: ${site.url}\n`;
    
    if (currentLog.response_time) {
      message += `Response Time: ${currentLog.response_time}ms\n`;
    } else {
      message += `Response Time: N/A\n`;
    }
    
    if (currentLog.details) {
      message += `Details: ${currentLog.details}\n`;
    }
    
    message += `Checked at: ${timestamp}`;

    // Send the message
    await bot.sendMessage(chatId, message);
    
    // Update the last notification timestamp
    lastNotificationTimestamps.set(key, now);
    
    console.log(`[Telegram] Notification sent to chat ${chatId} for site ${site.url}`);
    return true;
  } catch (error) {
    console.error(`[Telegram] Error sending notification to chat ${chatId}:`, error.message);
    return false;
  }
};

module.exports = {
  sendNotification
};