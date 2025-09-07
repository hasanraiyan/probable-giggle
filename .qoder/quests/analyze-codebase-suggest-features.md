# Telegram Notification System Implementation

## Overview

This document provides a detailed design for implementing a Telegram notification system for the uptime monitoring application. This feature will allow users to receive real-time alerts via Telegram when their monitored websites experience downtime or performance issues.

## Current System Analysis

The application is a Node.js/Express-based uptime monitoring system with the following key components:

1. **Backend Framework**: Express.js with EJS templating engine
2. **Authentication**: Session-based authentication with bcrypt password hashing
3. **Database**: JSON file-based storage system (`db/database.json`)
4. **Monitoring**: HTTP/HTTPS website monitoring with response time tracking
5. **Scheduling**: node-cron for periodic website checks (every 30 seconds)
6. **Notification System**: Currently only has client-side toast notifications

## Telegram Notification System Design

### 1. System Architecture

The Telegram notification system will be integrated into the existing monitoring workflow:

1. **Monitoring Check**: The cron job checks all active sites every 30 seconds
2. **Status Change Detection**: When a site status changes (UP → DOWN or DOWN → UP), a notification is triggered
3. **Telegram Integration**: Notifications are sent via Telegram Bot API
4. **User Configuration**: Users can configure their Telegram chat ID in their profile

### 2. Technical Implementation

#### Dependencies
- Add `node-telegram-bot-api` package for Telegram integration
- No additional external services required (Telegram is free)

#### Key Components

1. **Telegram Bot Setup**:
   - Create a Telegram bot using BotFather
   - Store bot token in environment variables
   - Users obtain their chat ID and store it in their profile

2. **Notification Service** (`services/telegram.js`):
   - Initialize Telegram bot with token
   - Send message function with error handling
   - Format notification messages with site details

3. **Database Integration**:
   - Add `telegram_chat_id` field to user model
   - Create user profile page to set Telegram chat ID

4. **Notification Logic**:
   - Modify `checkAllSites` function to detect status changes
   - Compare new status with previous status
   - Trigger Telegram notification on status change
   - Implement rate limiting to prevent spam

#### Implementation Steps

1. **Install Dependencies**:
   ```bash
   npm install node-telegram-bot-api
   ```

2. **Create Telegram Service**:
   - Create `services/telegram.js` to handle Telegram API interactions
   - Implement message formatting and sending functions

3. **Database Updates**:
   - Modify user model to include `telegram_chat_id`
   - Add profile management route and view

4. **Notification Logic**:
   - Update monitoring logic to detect status changes
   - Integrate Telegram notification calls
   - Add rate limiting to prevent notification spam

5. **User Interface**:
   - Add Telegram chat ID field to user profile
   - Provide instructions for obtaining chat ID

### 3. Notification Content

Notifications will include:
- Site URL
- Status change (UP/DOWN)
- Response time (if applicable)
- Timestamp of the check
- Error details (for DOWN status)

Example notification:
```
🚨 Uptime Alert

Status Change: UP → DOWN
Site: https://example.com
Response Time: N/A
Error: Connection timeout
Checked at: 2023-06-15 14:30:22 UTC
```

### 4. Rate Limiting

To prevent notification spam:
- Limit notifications to once per hour per site per user
- Implement cooldown period after notification is sent
- Track notification timestamps in database

### 5. Error Handling

- Handle Telegram API errors gracefully
- Log failed notifications for debugging
- Provide fallback notification mechanisms
- Retry failed notifications with exponential backoff

## Benefits

1. **Real-time Alerts**: Users receive immediate notifications via Telegram
2. **Cost-effective**: Telegram is free to use
3. **Cross-platform**: Works on mobile and desktop
4. **Reliable**: Telegram has high uptime and fast delivery
5. **User-friendly**: Easy to set up and use

## Implementation Plan

### 1. Install Dependencies

First, we need to install the Telegram bot API library:

We need to update the `package.json` file to include the `node-telegram-bot-api` dependency:

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "ejs": "^3.1.10",
    "dotenv": "^16.4.5",
    "express": "^5.1.0",
    "express-session": "^1.18.0",
    "node-cron": "^4.2.1",
    "node-telegram-bot-api": "^0.65.1"
  }
}

Then run:

```bash
npm install
```

### 2. Database Updates

We need to modify the database to store Telegram chat IDs for users. This involves:

1. Updating the user model in `db/database.js` to include a `telegram_chat_id` field
2. Creating a user profile page to allow users to set their Telegram chat ID

#### Modify Database Functions

Update the `createUser` function in `db/database.js` to include the Telegram chat ID field:

```javascript
/**
 * Creates a new user with a hashed password.
 * @param {string} username - The username.
 * @param {string} password - The plain-text password.
 * @param {string} telegramChatId - The Telegram chat ID (optional).
 * @returns {Promise<object>} The newly created user object.
 */
createUser: async (username, password, telegramChatId = null) => {
  const db = await readDB();
  if (db.users.some(user => user.username === username)) {
    throw new Error('User already exists.');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
    username,
    password: hashedPassword,
    telegram_chat_id: telegramChatId
  };
  db.users.push(newUser);
  await writeDB(db);
  return newUser;
},
```

Add a function to update a user's Telegram chat ID:

```javascript
/**
 * Updates a user's Telegram chat ID.
 * @param {number} userId - The ID of the user.
 * @param {string} telegramChatId - The Telegram chat ID.
 * @returns {Promise<object|undefined>} The updated user object or undefined if not found.
 */
updateUserTelegramChatId: async (userId, telegramChatId) => {
  const db = await readDB();
  const user = db.users.find(user => user.id === userId);
  if (!user) {
    return undefined;
  }
  user.telegram_chat_id = telegramChatId;
  await writeDB(db);
  return user;
},
```

Add a function to get a user's Telegram chat ID:

```javascript
/**
 * Gets a user's Telegram chat ID.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<string|undefined>} The Telegram chat ID or undefined if not found or not set.
 */
getUserTelegramChatId: async (userId) => {
  const db = await readDB();
  const user = db.users.find(user => user.id === userId);
  if (!user) {
    return undefined;
  }
  return user.telegram_chat_id || null;
},
```

### 3. User Profile Page

Create a new route and view for users to manage their Telegram settings:

In `index.js`, add a new route for the profile page:

```javascript
// GET /profile -> Show user profile page
app.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await db.findUserById(req.session.user.id);
    res.render('profile', { user, error: null, success: null });
  } catch (error) {
    res.render('profile', { user: req.session.user, error: 'Error loading profile.', success: null });
  }
});

// POST /profile -> Update user profile
app.post('/profile', isAuthenticated, async (req, res) => {
  const { telegramChatId } = req.body;
  try {
    await db.updateUserTelegramChatId(req.session.user.id, telegramChatId);
    const user = await db.findUserById(req.session.user.id);
    res.render('profile', { user, error: null, success: 'Profile updated successfully.' });
  } catch (error) {
    const user = await db.findUserById(req.session.user.id);
    res.render('profile', { user, error: 'Error updating profile.', success: null });
  }
});
```

Add a function to find a user by ID in `db/database.js`:

```javascript
/**
 * Finds a user by their ID.
 * @param {number} id - The user ID to find.
 * @returns {Promise<object|undefined>} The user object or undefined if not found.
 */
findUserById: async (id) => {
  const db = await readDB();
  return db.users.find(user => user.id === id);
},
```

### 3. Database Integration

In addition to the functions above, we need to modify the existing database functions to handle the new `telegram_chat_id` field.

Update the database initialization in `db/database.js` to ensure new users have the `telegram_chat_id` field:

```javascript
/**
 * Initializes the database file if it doesn't exist.
 */
setupDatabase: async () => {
  try {
    const db = await readDB();
    if (!db.users) {
      db.users = [];
    } else {
      // Ensure all existing users have the telegram_chat_id field
      db.users.forEach(user => {
        if (user.telegram_chat_id === undefined) {
          user.telegram_chat_id = null;
        }
      });
    }
    if (!db.sites) {
      db.sites = [];
    }
    if (!db.logs) {
      db.logs = [];
    }
    await writeDB(db);
    console.log('Database schema verified and ready.');
  } catch (error) {
    // If the file doesn't exist, create it with the full schema.
    if (error.code === 'ENOENT') {
      await writeDB({ sites: [], logs: [], users: [] });
      console.log('Database file created at:', dbPath);
    } else {
      console.error('Error setting up database:', error);
    }
  }
},
```

### 4. Notification Integration

Modify the monitoring logic in `index.js` to send Telegram notifications when site status changes:

```javascript
// --- Background Job ---
const checkAllSites = async () => {
  console.log('Running scheduled check for all sites...');
  try {
    const sites = await db.getAllSites();
    const activeSites = sites.filter(site => !site.is_paused);

    if (!activeSites || activeSites.length === 0) {
      console.log('[Cron] No active sites to check.');
      return;
    }

    console.log(`[Cron] Checking ${activeSites.length} active site(s).`);
    
    // Get the Telegram service
    const { sendNotification } = require('./services/telegram');
    
    for (const site of activeSites) {
      try {
        const result = await checkWebsite(site.url);
        
        // Get the previous log for this site
        const latestLogs = await db.getLatestLogs();
        const previousLog = latestLogs[site.id];
        
        // Add the new log
        await db.addLog(site.id, result);
        
        // Get the user's Telegram chat ID
        // Note: In a real implementation, we would need to associate sites with users
        // For simplicity in this example, we'll assume all sites belong to the first user
        const users = await db.getAllUsers();
        if (users.length > 0) {
          const userTelegramChatId = await db.getUserTelegramChatId(users[0].id);
        
          // Send notification if status changed and user has Telegram configured
          if (userTelegramChatId) {
            await sendNotification(userTelegramChatId, site, previousLog, result);
          }
        }
      } catch (error) {
        console.error(`[Cron] Error checking or logging for ${site.url}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[Cron] Error fetching sites:', error.message);
  }
};
```

We also need to add a function to get all users in `db/database.js`:

```javascript
/**
 * Retrieves all users from the database.
 * @returns {Promise<Array<object>>} A list of all users.
 */
getAllUsers: async () => {
  const db = await readDB();
  return db.users;
},
```

### 5. User Profile Page Implementation

Create a new view file `views/profile.ejs` with the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Profile - Uptime Monitor</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <link href="/css/styles.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
  <!-- Navigation -->
  <nav class="glass-effect border-b border-white/10 sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-white">Uptime Monitor</h1>
        </div>
        <div class="flex items-center space-x-4">
          <a href="/" class="text-slate-300 hover:text-white transition-colors">
            <i class="fas fa-tachometer-alt mr-1"></i> Dashboard
          </a>
          <a href="/profile" class="text-white">
            <i class="fas fa-user mr-1"></i> Profile
          </a>
          <form action="/logout" method="POST" class="inline">
            <button type="submit" class="text-slate-300 hover:text-white transition-colors">
              <i class="fas fa-sign-out-alt mr-1"></i> Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="glass-effect rounded-xl p-6 mb-8">
      <h2 class="text-2xl font-bold text-white mb-6">User Profile</h2>
      
      <% if (typeof success !== 'undefined' && success) { %>
        <div class="bg-green-500/10 border border-green-500/20 text-green-300 px-4 py-3 rounded-lg mb-6">
          <i class="fas fa-check-circle mr-2"></i><%= success %>
        </div>
      <% } %>
      
      <% if (typeof error !== 'undefined' && error) { %>
        <div class="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg mb-6">
          <i class="fas fa-exclamation-circle mr-2"></i><%= error %>
        </div>
      <% } %>

      <form action="/profile" method="POST" class="space-y-6">
        <div>
          <label class="block text-slate-300 mb-2">Username</label>
          <div class="glass-effect border border-white/10 rounded-lg px-4 py-3 text-white">
            <%= user.username %>
          </div>
        </div>
        
        <div>
          <label for="telegramChatId" class="block text-slate-300 mb-2">
            Telegram Chat ID
            <span class="text-sm text-slate-400 ml-2">(Optional)</span>
          </label>
          <input 
            type="text" 
            id="telegramChatId" 
            name="telegramChatId" 
            value="<%= user.telegram_chat_id || '' %>"
            placeholder="Enter your Telegram Chat ID"
            class="w-full glass-effect border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="mt-2 text-sm text-slate-400">
            To get your Telegram Chat ID:
            <ol class="list-decimal list-inside mt-1 space-y-1">
              <li>Create a bot with <a href="https://t.me/BotFather" target="_blank" class="text-blue-400 hover:underline">@BotFather</a></li>
              <li>Message your bot</li>
              <li>Visit <a href="https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates" target="_blank" class="text-blue-400 hover:underline">this link</a> (replace &lt;YOUR_BOT_TOKEN&gt; with your bot token)</li>
              <li>Find the "id" field in the response - that's your chat ID</li>
            </ol>
          </p>
        </div>
        
        <div class="flex justify-end space-x-4 pt-4">
          <a href="/" class="glass-effect border border-white/10 px-6 py-3 rounded-lg text-white hover:bg-white/5 transition-colors">
            <i class="fas fa-arrow-left mr-2"></i> Back to Dashboard
          </a>
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white transition-colors">
            <i class="fas fa-save mr-2"></i> Save Changes
          </button>
        </div>
      </form>
    </div>
  </main>

  <footer class="glass-effect border-t border-white/10 py-6 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
      <p>Uptime Monitor &copy; 2023</p>
    </div>
  </footer>
</body>
</html>
```

### 5. Environment Configuration

Add the Telegram bot token to the `.env` file:

```
PORT=3000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 6. Rate Limiting Implementation

To prevent notification spam, implement rate limiting in the notification service:

## Implementation Files

### 1. Telegram Service (`services/telegram.js`)

Create a new file `services/telegram.js` with the following content:

```javascript
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
```

## Testing Plan

1. Create a Telegram bot using BotFather and obtain the token
2. Set up the environment variable with the token
3. Register a new user and set their Telegram chat ID in the profile
4. Add a test site to monitor
5. Simulate a site going down and verify the Telegram notification is sent
6. Verify rate limiting works correctly
7. Test error handling for invalid chat IDs or network issues

## Deployment Considerations

1. Ensure the Telegram bot token is properly secured in environment variables
2. Test the notification system in a staging environment before production deployment
3. Monitor Telegram API usage and implement proper error handling
4. Consider adding logging for all notification attempts for debugging purposes
5. Document the setup process for users to configure their Telegram notifications

## Future Enhancements

1. Add support for notification templates that users can customize
2. Implement notification channels (e.g., separate channels for different site groups)
3. Add support for Telegram inline buttons to acknowledge alerts
4. Implement notification scheduling (e.g., only send notifications during business hours)
5. Add support for group chats or channels for team notifications

## Conclusion

The Telegram notification system provides a cost-effective and user-friendly way to receive real-time alerts about website uptime issues. By integrating with the existing monitoring infrastructure, users can stay informed about their site status without constantly checking the dashboard. The implementation is designed to be non-intrusive, with proper error handling and rate limiting to ensure a good user experience.

The system leverages Telegram's reliability and cross-platform support to deliver notifications quickly and consistently. With the modular design, additional notification channels can be added in the future while maintaining the core functionality.