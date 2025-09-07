const fs = require('fs').promises;
const path = require('path');

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
    const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);
    if (!dbExists) {
      await writeDB({ sites: [], logs: [] });
      console.log('Database file created at:', dbPath);
    } else {
      console.log('Database already exists at:', dbPath);
    }
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
    };
    db.sites.push(newSite);
    await writeDB(db);
    return newSite;
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
};

module.exports = db;
