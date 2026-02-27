const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const axios = require('axios');
const https = require('https');

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

// Fetch sitemap from URL
app.post('/api/sitemap/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    console.log(`Fetching sitemap from URL: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Sitemap-Stress-Tester/1.0'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    if (response.status !== 200) {
      return res.status(400).json({ success: false, error: `Failed to fetch sitemap: HTTP ${response.status}` });
    }
    
    const urls = await parseSitemap(response.data);
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Error fetching sitemap from URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stress test endpoint with Server-Sent Events for real-time progress
app.post('/api/stress-test-stream', (req, res) => {
  const { urls, concurrency, delay, headers } = req.body;
  
  // Basic validation
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, error: 'No URLs provided' });
  }
  
  // Validate concurrency and delay parameters
  const validatedConcurrency = Math.min(Math.max(parseInt(concurrency) || 3, 1), 20);
  const validatedDelay = Math.min(Math.max(parseInt(delay) || 500, 0), 10000);
  
  console.log(`Starting streaming stress test with ${urls.length} URLs, concurrency ${validatedConcurrency}, delay ${validatedDelay}ms`);
  console.log(`Total requests to be made: ${urls.length * validatedConcurrency}`);
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial event
  res.write(`data: ${JSON.stringify({ type: 'start', total: urls.length })}\n\n`);
  
  // Run the test with progress callbacks
  performStressTestStreaming(urls, validatedConcurrency, validatedDelay, headers, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  })
  .then(() => {
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();
  })
  .catch(error => {
    console.error('Error during streaming stress test:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected from stress test stream');
  });
});

// Stress test endpoint (kept for backward compatibility)
app.post('/api/stress-test', async (req, res) => {
  try {
    const { urls, concurrency, delay, headers } = req.body;
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
    const results = await performStressTest(urlsToTest, validatedConcurrency, validatedDelay, headers);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error during stress test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Perform stress test logic with progress callback - simulates multiple concurrent users
async function performStressTestStreaming(urls, concurrency = 3, delayMs = 500, customHeaders = {}, onProgress) {
  const results = [];
  const totalUrls = urls.length;
  const totalRequests = totalUrls * concurrency; // Each "user" tests all URLs
  let completed = 0;
  
  // Create an array representing each user's progress through the URL list
  const users = Array.from({ length: concurrency }, (_, userId) => ({
    userId,
    urlIndex: 0,
    active: true
  }));
  
  return new Promise((resolve, reject) => {
    // Function to process next URL for a specific user
    async function processNextForUser(user) {
      if (user.urlIndex >= totalUrls) {
        // This user has completed all URLs
        user.active = false;
        
        // Check if all users are done
        if (users.every(u => !u.active)) {
          resolve(results);
        }
        return;
      }
      
      const url = urls[user.urlIndex];
      const currentUrlIndex = user.urlIndex;
      user.urlIndex++;
      
      try {
        // Test the URL
        const result = await testUrl(url, customHeaders);
        result.userId = user.userId; // Track which user made the request
        result.urlIndex = currentUrlIndex;
        results.push(result);
        completed++;
        
        // Calculate statistics
        const progressPercent = Math.round((completed / totalRequests) * 100);
        const successfulRequests = results.filter(r => r.success).length;
        const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
        const activeUsers = users.filter(u => u.active).length;
        
        // Send progress event
        onProgress({
          type: 'progress',
          result,
          completed,
          total: totalRequests,
          percent: progressPercent,
          successCount: successfulRequests,
          errorCount: completed - successfulRequests,
          avgResponseTime,
          activeRequests: activeUsers,
          userId: user.userId
        });
        
      } catch (error) {
        console.error(`Error testing URL ${url} for user ${user.userId}:`, error);
        completed++;
      }
      
      // Apply delay before starting next request if configured
      if (delayMs > 0 && user.urlIndex < totalUrls) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Continue with next URL for this user
      if (user.active) {
        processNextForUser(user);
      }
    }
    
    // Start all users simultaneously
    users.forEach(user => {
      processNextForUser(user);
    });
  });
}

// Perform stress test logic (kept for backward compatibility)
async function performStressTest(urls, concurrency = 3, delayMs = 500, customHeaders = {}) {
  const results = [];
  const urlQueue = [...urls];
  const totalUrls = urls.length;
  
  // Process URLs in chunks based on concurrency
  while (urlQueue.length > 0) {
    const chunk = urlQueue.splice(0, concurrency);
    const chunkPromises = chunk.map(url => testUrl(url, customHeaders));
    
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
async function testUrl(url, customHeaders = {}) {
  const startTime = Date.now();
  let status = 'error';
  let statusText = '';
  let responseTime = 0;
  
  console.log(`Testing URL: ${url}`);
  
  try {
    // Merge custom headers with default User-Agent
    const headers = {
      ...customHeaders
    };
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true, // Accept all status codes
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Skip certificate validation
      })
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
