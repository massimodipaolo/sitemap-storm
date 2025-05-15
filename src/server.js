const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));  // Increased limit for large sitemaps
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Route for sample sitemap (informational purpose)
app.get('/sample-sitemap', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Sample Sitemap</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { color: #2c3e50; }
          p { margin-bottom: 15px; }
          .btn { display: inline-block; padding: 10px 15px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Sample Sitemap</h1>
        <p>This is a sample sitemap.xml file included for testing purposes.</p>
        <p>You can download this file and use it to test the Sitemap Stress Tester application.</p>
        <p><a href="/sample-sitemap.xml" class="btn">View Sample Sitemap</a></p>
        <p><a href="/" class="btn">Back to Application</a></p>
      </body>
    </html>
  `);
});

// Parse sitemap XML function
async function parseSitemap(xmlContent) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser();
    parser.parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        // Extract URLs from sitemap
        let urls = [];
        if (result.urlset && result.urlset.url) {
          urls = result.urlset.url.map(item => item.loc[0]);
        }
        resolve(urls);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Process the uploaded sitemap
app.post('/api/sitemap', async (req, res) => {
  try {
    const xmlContent = req.body.content;
    const urls = await parseSitemap(xmlContent);
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Error processing sitemap:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stress test endpoint
app.post('/api/stress-test', async (req, res) => {
  try {
    const { urls, concurrency, delay } = req.body;
      // Basic validation
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'No URLs provided' });
    }
    
    // Validate concurrency and delay parameters
    const validatedConcurrency = Math.min(Math.max(parseInt(concurrency) || 3, 1), 20);
    const validatedDelay = Math.min(Math.max(parseInt(delay) || 500, 0), 10000);
    
    // The URL count is now managed by the frontend via the slider
    const urlsToTest = urls;
    
    console.log(`Client requested testing ${urlsToTest.length} URLs`);
    
    // Run the test and send results
    console.log(`Starting stress test with ${urlsToTest.length} URLs, concurrency ${validatedConcurrency}, delay ${validatedDelay}ms`);
    const results = await performStressTest(urlsToTest, validatedConcurrency, validatedDelay);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error during stress test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Perform stress test logic
async function performStressTest(urls, concurrency = 3, delayMs = 500) {
  const results = [];
  const urlQueue = [...urls];
  const totalUrls = urls.length;
  
  // Process URLs in chunks based on concurrency
  while (urlQueue.length > 0) {
    const chunk = urlQueue.splice(0, concurrency);
    const chunkPromises = chunk.map(url => testUrl(url));
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Calculate progress
    const completed = results.length;
    const progressPercent = Math.round((completed / totalUrls) * 100);
    
    console.log(`Progress: ${progressPercent}% (${completed}/${totalUrls})`);
    
    if (urlQueue.length > 0 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Log summary statistics
  const successfulRequests = results.filter(r => r.success).length;
  const avgResponseTime = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
    : 0;
  
  console.log(`Test completed: ${results.length} requests, ${successfulRequests} successful, ${avgResponseTime}ms avg response time`);
  
  return results;
}

// Test individual URL
async function testUrl(url) {
  const startTime = Date.now();
  let status = 'error';
  let statusText = '';
  let responseTime = 0;
  
  console.log(`Testing URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true, // Accept all status codes
      headers: {
        'User-Agent': 'Sitemap-Stress-Tester/1.0'
      }
    });
    
    status = response.status;
    statusText = response.statusText;
    responseTime = Date.now() - startTime;
    
    const result = {
      url,
      status,
      statusText,
      responseTime,
      success: status >= 200 && status < 400
    };
    
    console.log(`Completed: ${url} - Status: ${status}, Time: ${responseTime}ms`);
    return result;
  } catch (error) {
    const result = {
      url,
      status: error.response ? error.response.status : 'error',
      statusText: error.message,
      responseTime: Date.now() - startTime,
      success: false
    };
    
    console.log(`Failed: ${url} - Error: ${error.message}, Time: ${result.responseTime}ms`);
    return result;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
