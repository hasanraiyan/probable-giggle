const http = require('http');
const https = require('https');
const url = require('url');

const checkWebsite = (siteUrl) => {
  return new Promise((resolve) => {
    const options = url.parse(siteUrl);
    options.timeout = 15000; // 15-second timeout

    const client = options.protocol === 'https:' ? https : http;
    const startTime = Date.now();

    const req = client.get(options, (res) => {
      const responseTime = Date.now() - startTime;
      const { statusCode } = res;

      // Any status code is considered "UP" as long as we get a response.
      // We'll log the status code in the details.
      if (statusCode) {
         const status = (statusCode >= 200 && statusCode < 400) ? 'UP' : 'DOWN';
         resolve({
          status: status,
          responseTime: responseTime,
          details: `Status code: ${statusCode}`,
        });
      }

      // We must consume the response body to free up memory
      res.resume();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'DOWN',
        responseTime: null,
        details: 'Request timed out after 15 seconds.',
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'DOWN',
        responseTime: null,
        details: err.message,
      });
    });
  });
};

module.exports = {
  checkWebsite,
};
