const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'database.json');

// --- Database Utility Functions ---

/**
 * Reads the entire database from the JSON file.
 * @returns {Promise<object>} A promise that resolves to the database content.
 */
const readDB = async () => {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist or is invalid, return a default structure
    if (error.code === 'ENOENT') {
      return { sites: [], logs: [] };
    }
    console.error('Error reading database:', error);
    throw error; // Re-throw other errors
  }
};

/**
 * Writes the entire database to the JSON file.
 * @param {object} data - The data to write to the database.
 * @returns {Promise<void>}
 */
const writeDB = async (data) => {
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to database:', error);
    throw error;
  }
};

// --- Public API for Database Operations ---

const db = {
  /**
   * Initializes the database file if it doesn't exist.
   */
  setupDatabase: async () => {
    try {
      const db = await readDB();
      if (!db.users) {
        db.users = [];
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

  // --- User Operations ---

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

  /**
   * Finds a user by their username.
   * @param {string} username - The username to find.
   * @returns {Promise<object|undefined>} The user object or undefined if not found.
   */
  findUserByUsername: async (username) => {
    const db = await readDB();
    return db.users.find(user => user.username === username);
  },

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

  /**
   * Finds a user by their ID.
   * @param {number} id - The user ID to find.
   * @returns {Promise<object|undefined>} The user object or undefined if not found.
   */
  findUserById: async (id) => {
    const db = await readDB();
    return db.users.find(user => user.id === id);
  },

  // --- Site Operations ---

  /**
   * Adds a new site to the database.
   * @param {string} url - The URL of the site to add.
   * @returns {Promise<object>} The newly created site object.
   */
  addSite: async (url) => {
    const db = await readDB();
    if (db.sites.some(site => site.url === url)) {
      throw new Error('UNIQUE constraint failed: This URL is already being monitored.');
    }
    const newSite = {
      id: db.sites.length > 0 ? Math.max(...db.sites.map(s => s.id)) + 1 : 1,
      url,
      created_at: new Date().toISOString(),
      is_paused: false,
    };
    db.sites.push(newSite);
    await writeDB(db);
    return newSite;
  },

  /**
   * Toggles the paused state of a site.
   * @param {number} id - The ID of the site to toggle.
   * @returns {Promise<boolean>} True if the site was found and toggled, false otherwise.
   */
  togglePauseSite: async (id) => {
    const db = await readDB();
    const site = db.sites.find(site => site.id === id);
    if (!site) {
      return false;
    }
    site.is_paused = !site.is_paused;
    await writeDB(db);
    return true;
  },

  /**
   * Deletes a site and its associated logs from the database.
   * @param {number} id - The ID of the site to delete.
   * @returns {Promise<boolean>} True if a site was deleted, false otherwise.
   */
  deleteSite: async (id) => {
    const db = await readDB();
    const siteIndex = db.sites.findIndex(site => site.id === id);
    if (siteIndex === -1) {
      return false; // Site not found
    }
    db.sites.splice(siteIndex, 1);
    // Also remove associated logs
    db.logs = db.logs.filter(log => log.site_id !== id);
    await writeDB(db);
    return true;
  },

  /**
   * Retrieves a single site by its ID.
   * @param {number} id - The ID of the site to retrieve.
   * @returns {Promise<object|undefined>} The site object or undefined if not found.
   */
  getSiteById: async (id) => {
    const db = await readDB();
    return db.sites.find(site => site.id === id);
  },

  /**
   * Retrieves all sites from the database.
   * @returns {Promise<Array<object>>} A list of all sites.
   */
  getAllSites: async () => {
    const db = await readDB();
    return db.sites;
  },

  // --- Log Operations ---

  /**
   * Adds a new log entry to the database.
   * @param {number} site_id - The ID of the site this log belongs to.
   * @param {object} logData - The log data { status, response_time, details }.
   * @returns {Promise<void>}
   */
  addLog: async (site_id, { status, responseTime, details }) => {
    const db = await readDB();
    const newLog = {
      id: db.logs.length > 0 ? Math.max(...db.logs.map(l => l.id)) + 1 : 1,
      site_id,
      status,
      response_time: responseTime,
      details,
      checked_at: new Date().toISOString(),
    };
    db.logs.push(newLog);
    await writeDB(db);
  },

  /**
   * Retrieves all logs for a specific site, sorted by most recent.
   * @param {number} site_id - The ID of the site.
   * @returns {Promise<Array<object>>} A list of logs for the given site.
   */
  getLogsBySiteId: async (site_id) => {
    const db = await readDB();
    return db.logs
      .filter(log => log.site_id === site_id)
      .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
  },

  /**
   * Retrieves the latest log for each site.
   * @returns {Promise<object>} An object mapping site IDs to their latest log.
   */
  getLatestLogs: async () => {
    const db = await readDB();
    const latestLogs = {};
    for (const log of db.logs) {
      if (!latestLogs[log.site_id] || new Date(log.checked_at) > new Date(latestLogs[log.site_id].checked_at)) {
        latestLogs[log.site_id] = log;
      }
    }
    return latestLogs;
  },

  /**
   * Calculates uptime percentages for a given site.
   * @param {number} site_id - The ID of the site.
   * @returns {Promise<object>} An object with uptime stats for 24h and 7d.
   */
  getUptimeStats: async (site_id) => {
    const db = await readDB();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const siteLogs = db.logs.filter(log => log.site_id === site_id);

    const calcUptime = (logs, since) => {
      const relevantLogs = logs.filter(log => new Date(log.checked_at) >= since);
      if (relevantLogs.length === 0) {
        return 'N/A';
      }
      const upLogs = relevantLogs.filter(log => log.status === 'UP').length;
      return ((upLogs / relevantLogs.length) * 100).toFixed(2) + '%';
    };

    return {
      '24h': calcUptime(siteLogs, twentyFourHoursAgo),
      '7d': calcUptime(siteLogs, sevenDaysAgo),
    };
  },
};

module.exports = {
  ...db,
  readDB,
  writeDB
};
