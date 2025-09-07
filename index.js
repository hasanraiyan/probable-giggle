require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db/database');
const { checkWebsite } = require('./checker');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---

// Set up view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'a-very-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Middleware to make user info available in all templates
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  res.locals.user = req.session.user || null;
  next();
});

// Middleware to protect routes
const isAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
};

// --- Authentication Routes ---

// GET /register -> Show registration page
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// POST /register -> Handle user registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('register', { error: 'Username and password are required.' });
  }

  try {
    await db.createUser(username, password);
    res.redirect('/login');
  } catch (error) {
    res.render('register', { error: error.message });
  }
});

// GET /login -> Show login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// POST /login -> Handle user login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.findUserByUsername(username);

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  req.session.isAuthenticated = true;
  req.session.user = { id: user.id, username: user.username };
  res.redirect('/');
});

// POST /logout -> Handle user logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// --- Protected Application Routes ---

// GET / -> Dashboard
app.get('/', isAuthenticated, async (req, res) => {
  try {
    const sites = await db.getAllSites();
    const latestLogs = await db.getLatestLogs();

    const uptimeStatsPromises = sites.map(site => db.getUptimeStats(site.id));
    const uptimeStats = await Promise.all(uptimeStatsPromises);

    const viewModel = sites.map((site, index) => {
      const log = latestLogs[site.id];
      return {
        ...site,
        status: log?.status,
        response_time: log?.response_time,
        checked_at: log?.checked_at,
        details: log?.details,
        uptime: uptimeStats[index],
      };
    });

    res.render('dashboard', { sites: viewModel });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).send('Error fetching data.');
  }
});

// POST /add -> Add a new site
app.post('/add', isAuthenticated, async (req, res) => {
  // ... (rest of the route is the same)
  const { url } = req.body;
  if (!url) { return res.status(400).send('URL is required'); }
  try { new URL(url); } catch (error) { return res.status(400).send('Invalid URL format provided.'); }
  try { await db.addSite(url); res.redirect('/'); } catch (error) { res.status(500).send('Error adding site.'); }
});

// POST /delete/:id -> Delete a site
app.post('/delete/:id', isAuthenticated, async (req, res) => {
  // ... (rest of the route is the same)
  const id = parseInt(req.params.id, 10);
  const deleted = await db.deleteSite(id);
  if (!deleted) { return res.status(404).send('Site not found.'); }
  res.redirect('/');
});

// POST /check-all -> Manually trigger a check for all sites
app.post('/check-all', isAuthenticated, (req, res) => {
  checkAllSites();
  res.redirect('/');
});

// POST /check/:id -> Manually trigger a check for one site
app.post('/check/:id', isAuthenticated, async (req, res) => {
  // ... (rest of the route is the same)
  const id = parseInt(req.params.id, 10);
  const site = await db.getSiteById(id);
  if (!site) { return res.status(404).send('Site not found.'); }
  if (site.is_paused) { return res.redirect('/'); } // Don't check if paused
  const result = await checkWebsite(site.url);
  await db.addLog(id, result);
  res.redirect('/');
});

// POST /site/:id/toggle-pause -> Pause or resume a site
app.post('/site/:id/toggle-pause', isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const success = await db.togglePauseSite(id);
  if (!success) {
    return res.status(404).send('Site not found.');
  }
  res.redirect('/');
});

// GET /site/:id -> Detailed logs for one site
app.get('/site/:id', isAuthenticated, async (req, res) => {
  // ... (rest of the route is the same)
  const id = parseInt(req.params.id, 10);
  const site = await db.getSiteById(id);
  if (!site) { return res.status(404).send('Site not found.'); }
  const logs = await db.getLogsBySiteId(id);
  res.render('site-detail', { site, logs });
});

// GET /api/status -> JSON data for dashboard refresh
app.get('/api/status', isAuthenticated, async (req, res) => {
  // ... (rest of the route is the same)
  try {
    const sites = await db.getAllSites();
    const latestLogs = await db.getLatestLogs();
    const viewModel = sites.map(site => {
      const log = latestLogs[site.id];
      return { ...site, status: log?.status, response_time: log?.response_time, checked_at: log?.checked_at, details: log?.details };
    });
    res.json(viewModel);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching data.' });
  }
});

// GET /api/latency -> JSON data for latency chart
app.get('/api/latency', isAuthenticated, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const sites = await db.getAllSites();
    const activeSites = sites.filter(site => !site.is_paused);
    
    if (activeSites.length === 0) {
      return res.json([]);
    }
    
    // Get all logs from the last X hours
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    const dbData = await db.readDB();
    
    // Filter logs for active sites within time range
    const relevantLogs = dbData.logs.filter(log => {
      const logTime = new Date(log.checked_at);
      const isActiveSite = activeSites.some(site => site.id === log.site_id);
      const isWithinTimeRange = logTime >= hoursAgo;
      const hasValidResponseTime = log.response_time !== null && log.status === 'UP';
      
      return isActiveSite && isWithinTimeRange && hasValidResponseTime;
    });
    
    // Group logs by hour and calculate average latency
    const latencyData = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const hourLogs = relevantLogs.filter(log => {
        const logTime = new Date(log.checked_at);
        return logTime >= hourStart && logTime < hourEnd;
      });
      
      let avgLatency = null;
      if (hourLogs.length > 0) {
        const totalLatency = hourLogs.reduce((sum, log) => sum + log.response_time, 0);
        avgLatency = Math.round(totalLatency / hourLogs.length);
      }
      
      latencyData.push({
        time: hourStart.toISOString(),
        latency: avgLatency,
        count: hourLogs.length
      });
    }
    
    res.json(latencyData);
  } catch (error) {
    console.error('Error fetching latency data:', error);
    res.status(500).json({ error: 'Error fetching latency data.' });
  }
});

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
    for (const site of activeSites) {
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
  cron.schedule('*/30 * * * * *', checkAllSites);
  console.log('Cron job scheduled to run every 30 seconds.');
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
