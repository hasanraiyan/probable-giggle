require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const db = require('./db/database');
const { checkWebsite } = require('./checker');

const app = express();
const port = process.env.PORT || 3000;

// Set up view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---

// GET / -> Dashboard
app.get('/', async (req, res) => {
  try {
    const sites = await db.getAllSites();
    const latestLogs = await db.getLatestLogs();

    const viewModel = sites.map(site => {
      const log = latestLogs[site.id];
      return {
        ...site,
        status: log ? log.status : 'N/A',
        response_time: log ? log.response_time : null,
        checked_at: log ? log.checked_at : null,
        details: log ? log.details : 'Not checked yet.',
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.render('dashboard', { sites: viewModel });
  } catch (error) {
    console.error('Error fetching sites and logs:', error.message);
    res.status(500).send('Error fetching data from database');
  }
});

// POST /add -> Add a new site
app.post('/add', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    new URL(url); // Validate URL format
  } catch (error) {
    return res.status(400).send('Invalid URL format provided.');
  }

  try {
    await db.addSite(url);
    res.redirect('/');
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).send('This URL is already being monitored.');
    }
    console.error('Error adding new site:', error.message);
    res.status(500).send('Error adding site to database');
  }
});

// POST /delete/:id -> Delete a site
app.post('/delete/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await db.deleteSite(id);
    if (!deleted) {
      return res.status(404).send('Site not found.');
    }
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting site:', error.message);
    res.status(500).send('Error deleting site from database');
  }
});

// POST /check-all -> Manually trigger a check for all sites
app.post('/check-all', (req, res) => {
  console.log('Manual check-all triggered.');
  checkAllSites();
  res.redirect('/');
});

// POST /check/:id -> Manually trigger a check for one site
app.post('/check/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    console.log(`Manual check triggered for site ID: ${id}`);

    const site = await db.getSiteById(id);
    if (!site) {
      return res.status(404).send('Site not found.');
    }

    const result = await checkWebsite(site.url);
    await db.addLog(id, result);

    res.redirect('/');
  } catch (error) {
    console.error(`[Manual Check] Error for site ID ${req.params.id}:`, error.message);
    res.status(500).send('Error during manual check.');
  }
});

// GET /site/:id -> Detailed logs for one site
app.get('/site/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const site = await db.getSiteById(id);
    if (!site) {
      return res.status(404).send('Site not found.');
    }
    const logs = await db.getLogsBySiteId(id);
    res.render('site-detail', { site, logs });
  } catch (error) {
    console.error('Error fetching site details:', error.message);
    res.status(500).send('Error fetching data.');
  }
});

// GET /api/status -> JSON data for dashboard refresh
app.get('/api/status', async (req, res) => {
  try {
    const sites = await db.getAllSites();
    const latestLogs = await db.getLatestLogs();

    const viewModel = sites.map(site => {
      const log = latestLogs[site.id];
      return {
        ...site,
        status: log ? log.status : 'N/A',
        response_time: log ? log.response_time : null,
        checked_at: log ? log.checked_at : null,
        details: log ? log.details : 'Not checked yet.',
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(viewModel);
  } catch (error) {
    console.error('Error fetching API status:', error.message);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// --- Background Job ---
const checkAllSites = async () => {
  console.log('Running scheduled check for all sites...');
  try {
    const sites = await db.getAllSites();
    if (!sites || sites.length === 0) {
      console.log('[Cron] No sites to check.');
      return;
    }

    console.log(`[Cron] Checking ${sites.length} site(s).`);
    for (const site of sites) {
      try {
        const result = await checkWebsite(site.url);
        await db.addLog(site.id, result);
      } catch (error) {
        console.error(`[Cron] Error checking or logging for ${site.url}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[Cron] Error fetching sites:', error.message);
  }
};

// --- Initialization and Server Start ---
const startServer = async () => {
  await db.setupDatabase();

  // Schedule the job to run every 30 seconds.
  cron.schedule('*/30 * * * * *', checkAllSites);
  console.log('Cron job scheduled to run every 30 seconds.');

  // Run an initial check on startup after a short delay.
  setTimeout(() => {
    console.log('Running initial check on startup...');
    checkAllSites();
  }, 2000);

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start the server:', error);
  process.exit(1);
});
