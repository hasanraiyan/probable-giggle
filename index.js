const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { db, setupDatabase } = require('./db/database');
const { checkWebsite } = require('./checker');

const app = express();
const port = 3000;

// Set up view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Initialize the database
setupDatabase();

// --- Routes ---

// GET / -> Dashboard
app.get('/', (req, res) => {
  const query = `
    SELECT
      s.id,
      s.url,
      l.status,
      l.response_time,
      l.checked_at,
      l.details
    FROM sites s
    LEFT JOIN (
      SELECT
        site_id,
        status,
        response_time,
        checked_at,
        details,
        ROW_NUMBER() OVER(PARTITION BY site_id ORDER BY checked_at DESC) as rn
      FROM logs
    ) l ON s.id = l.site_id AND l.rn = 1
    ORDER BY s.created_at DESC;
  `;

  db.all(query, [], (err, sites) => {
    if (err) {
      console.error('Error fetching sites and logs:', err.message);
      return res.status(500).send('Error fetching data from database');
    }
    res.render('dashboard', { sites });
  });
});

// POST /add -> Add a new site
app.post('/add', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    new URL(url);
  } catch (error) {
    return res.status(400).send('Invalid URL format provided.');
  }

  const query = 'INSERT INTO sites (url) VALUES (?)';
  db.run(query, [url], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
         return res.status(409).send('This URL is already being monitored.');
      }
      console.error('Error adding new site:', err.message);
      return res.status(500).send('Error adding site to database');
    }
    res.redirect('/');
  });
});

// POST /delete/:id -> Delete a site
app.post('/delete/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM sites WHERE id = ?';
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error deleting site:', err.message);
      return res.status(500).send('Error deleting site from database');
    }
    if (this.changes === 0) {
      return res.status(404).send('Site not found.');
    }
    res.redirect('/');
  });
});

// POST /check-all -> Manually trigger a check for all sites
app.post('/check-all', (req, res) => {
  console.log('Manual check-all triggered.');
  // We can optionally pass a callback to redirect after the check is done,
  // but for now, a quick redirect is fine. The results will show up on the next JS refresh.
  checkAllSites();
  res.redirect('/');
});

// POST /check/:id -> Manually trigger a check for one site
app.post('/check/:id', (req, res) => {
  const { id } = req.params;
  console.log(`Manual check triggered for site ID: ${id}`);

  const siteQuery = 'SELECT url FROM sites WHERE id = ?';
  db.get(siteQuery, [id], (err, site) => {
    if (err) {
      console.error('Error fetching site for manual check:', err.message);
      return res.status(500).send('Error fetching site.');
    }
    if (!site) {
      return res.status(404).send('Site not found.');
    }

    checkWebsite(site.url).then(result => {
      const logQuery = 'INSERT INTO logs (site_id, status, response_time, details) VALUES (?, ?, ?, ?)';
      db.run(logQuery, [id, result.status, result.responseTime, result.details], (err) => {
        if (err) {
          console.error(`[Manual Check] Error saving log for ${site.url}:`, err.message);
        }
        res.redirect('/');
      });
    });
  });
});

// GET /site/:id -> Detailed logs for one site
app.get('/site/:id', (req, res) => {
  const { id } = req.params;
  const siteQuery = 'SELECT * FROM sites WHERE id = ?';
  const logsQuery = 'SELECT * FROM logs WHERE site_id = ? ORDER BY checked_at DESC LIMIT 50';

  db.get(siteQuery, [id], (err, site) => {
    if (err) {
      console.error('Error fetching site:', err.message);
      return res.status(500).send('Error fetching site data.');
    }
    if (!site) {
      return res.status(404).send('Site not found.');
    }

    db.all(logsQuery, [id], (err, logs) => {
      if (err) {
        console.error('Error fetching logs:', err.message);
        return res.status(500).send('Error fetching log data.');
      }
      res.render('site-detail', { site, logs });
    });
  });
});

// GET /api/status -> JSON data for dashboard refresh
app.get('/api/status', (req, res) => {
  const query = `
    SELECT
      s.id,
      s.url,
      l.status,
      l.response_time,
      l.checked_at,
      l.details
    FROM sites s
    LEFT JOIN (
      SELECT
        site_id,
        status,
        response_time,
        checked_at,
        details,
        ROW_NUMBER() OVER(PARTITION BY site_id ORDER BY checked_at DESC) as rn
      FROM logs
    ) l ON s.id = l.site_id AND l.rn = 1
    ORDER BY s.created_at DESC;
  `;

  db.all(query, [], (err, sites) => {
    if (err) {
      console.error('Error fetching API status:', err.message);
      return res.status(500).json({ error: 'Error fetching data from database' });
    }
    res.json(sites);
  });
});

// --- Background Job ---
const checkAllSites = () => {
  console.log('Running scheduled check for all sites...');
  db.all('SELECT id, url FROM sites', [], (err, sites) => {
    if (err) {
      console.error('[Cron] Error fetching sites:', err.message);
      return;
    }

    if (!sites || sites.length === 0) {
      console.log('[Cron] No sites to check.');
      return;
    }

    console.log(`[Cron] Checking ${sites.length} site(s).`);
    const logQuery = 'INSERT INTO logs (site_id, status, response_time, details) VALUES (?, ?, ?, ?)';

    sites.forEach(site => {
      checkWebsite(site.url).then(result => {
        db.run(logQuery, [site.id, result.status, result.responseTime, result.details], (err) => {
          if (err) {
            console.error(`[Cron] Error saving log for ${site.url}:`, err.message);
          }
        });
      });
    });
  });
};

// Schedule the job to run every 5 minutes.
cron.schedule('*/5 * * * *', checkAllSites);
console.log('Cron job scheduled to run every 5 minutes.');

// To provide immediate feedback, let's run the check once on startup.
setTimeout(() => {
  console.log('Running initial check on startup...');
  checkAllSites();
}, 2000);


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
