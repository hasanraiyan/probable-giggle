const db = require('./db/database');

/**
 * Generates synthetic latency data for the last 24 hours
 * This will create realistic latency patterns with variations
 */
async function generateSyntheticData() {
  console.log('🚀 Starting synthetic data generation...');
  
  try {
    // Get all sites
    const sites = await db.getAllSites();
    
    if (sites.length === 0) {
      console.log('❌ No sites found. Please add at least one site first.');
      return;
    }
    
    console.log(`📊 Found ${sites.length} site(s). Generating data...`);
    
    // Generate data for each site
    for (const site of sites) {
      await generateDataForSite(site.id, site.url);
    }
    
    console.log('✅ Synthetic data generation completed!');
    console.log('🎯 You can now see rich latency graphs in your dashboard.');
    
  } catch (error) {
    console.error('❌ Error generating synthetic data:', error);
  }
}

/**
 * Generates realistic latency data for a specific site
 */
async function generateDataForSite(siteId, siteUrl) {
  console.log(`📈 Generating data for site: ${siteUrl}`);
  
  const now = new Date();
  const hoursToGenerate = 24;
  const pointsPerHour = 6; // Every 10 minutes
  const totalPoints = hoursToGenerate * pointsPerHour;
  
  // Base latency patterns (realistic for different times of day)
  const getBaseLatency = (hour) => {
    // Simulate daily patterns - higher latency during peak hours
    if (hour >= 9 && hour <= 17) {
      return 150; // Business hours - higher load
    } else if (hour >= 18 && hour <= 22) {
      return 120; // Evening - moderate load
    } else {
      return 80; // Night/early morning - lower load
    }
  };
  
  // Generate data points
  for (let i = totalPoints - 1; i >= 0; i--) {
    const timeOffset = i * 10 * 60 * 1000; // 10 minutes in milliseconds
    const timestamp = new Date(now.getTime() - timeOffset);
    const hour = timestamp.getHours();
    
    // Get base latency for this hour
    const baseLatency = getBaseLatency(hour);
    
    // Add realistic variations
    const variation = Math.sin(i * 0.1) * 20 + Math.random() * 30 - 15;
    const spikes = Math.random() < 0.05 ? Math.random() * 200 : 0; // 5% chance of latency spikes
    
    const latency = Math.max(50, Math.min(500, baseLatency + variation + spikes));
    
    // Determine status based on latency (simulate some downtime)
    let status = 'UP';
    let details = `Status code: ${Math.random() < 0.95 ? '200' : '301'}`;
    
    // Simulate occasional downtime (2% chance)
    if (Math.random() < 0.02) {
      status = 'DOWN';
      details = Math.random() < 0.5 ? 'Connection timeout' : 'Status code: 500';
    }
    
    // Add log entry
    await db.addLog(siteId, {
      status: status,
      responseTime: status === 'UP' ? Math.round(latency) : null,
      details: details
    });
    
    // Update the log timestamp to match our generated time
    const fs = require('fs').promises;
    const path = require('path');
    const dbPath = path.join(__dirname, 'db', 'database.json');
    
    const dbData = JSON.parse(await fs.readFile(dbPath, 'utf8'));
    const lastLog = dbData.logs[dbData.logs.length - 1];
    lastLog.checked_at = timestamp.toISOString();
    await fs.writeFile(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  }
  
  console.log(`✅ Generated ${totalPoints} data points for ${siteUrl}`);
}

// Add some additional sites for more interesting data
async function addSampleSites() {
  const sampleSites = [
    'https://github.com',
    'https://stackoverflow.com',
    'https://reddit.com',
    'https://youtube.com'
  ];
  
  console.log('🌐 Adding sample sites...');
  
  for (const url of sampleSites) {
    try {
      await db.addSite(url);
      console.log(`✅ Added: ${url}`);
    } catch (error) {
      if (error.message.includes('already being monitored')) {
        console.log(`⚠️  Already exists: ${url}`);
      } else {
        console.error(`❌ Error adding ${url}:`, error.message);
      }
    }
  }
}

// Main execution
async function main() {
  console.log('🎯 Synthetic Data Generator for Uptime Monitor');
  console.log('===============================================');
  
  // Setup database
  await db.setupDatabase();
  
  // Add sample sites
  await addSampleSites();
  
  // Generate synthetic data
  await generateSyntheticData();
  
  console.log('\n🎉 All done! Your dashboard should now show rich latency data.');
  console.log('💡 Tip: Refresh your dashboard to see the new data.');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateSyntheticData, addSampleSites };