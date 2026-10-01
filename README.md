# ⚡ Sitemap Storm

Web application for stress testing websites using sitemap.xml files to determine performance under load. 

## ✨ Features

- **Flexible Sitemap Input**
  - Upload sitemap.xml files directly
  - Fetch sitemaps from any URL
  - Sample sitemap included for testing

- **Configurable Test Parameters**
  - Concurrent requests (simultaneous users)
  - Delay between batches (0-2000ms)
  - Max URLs to test (10% to 100% of sitemap)
  - Custom HTTP headers support (for authentication, API keys, etc.)
  - Custom host mappings for sitemap fetching and page requests

- **Real-Time Monitoring**
  - Live progress tracking with animated charts
  - Active request counter
  - Success/error counts in real-time
  - Average response time updates
  - Expected request rate calculator

- **Comprehensive Dashboard**
  - Response time distribution chart
  - Status code distribution chart
  - Success/error rates
  - Average response time metrics
  - Detailed per-URL statistics

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/massimodipaolo/sitemap-storm.git

# Navigate to the project directory
cd sitemap-storm

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at http://localhost:3000

To use a different port, pass it to the start script:

```bash
npm start -- --port 3001
```

The application will then be available at http://localhost:3001.

## 📖 Usage

1. Open your browser and navigate to http://localhost:3000
2. **Load a sitemap**:
   - Upload a sitemap.xml file, OR
   - Enter a sitemap URL and click "Fetch", OR
   - Use the included sample sitemap
3. **Configure test parameters**:
   - Adjust concurrent requests (default: 3)
   - Set delay between batches (default: 500ms)
   - Choose the percentage of URLs to test (default: 100%)
   - Add custom headers if needed (optional)
4. **Review estimated throughput** displayed on screen
5. Click "Start Stress Test"
6. **Monitor** real-time progress with live charts
7. **Analyze** detailed results in the dashboard

## Custom Host Resolution

Before fetching a sitemap, enter optional rules in **Host mappings**, one per line:

```text
MAP 127.0.0.1 dev.example.com
MAP ::1 ipv6.example.com
```

Fetch a URL such as `http://dev.example.com:8080/sitemap.xml`, then start the test. The same mappings apply to sitemap fetching, page requests (including URLs from uploaded sitemaps), and redirects. Unmapped hostnames use normal DNS. Clear the field to disable the override.

Rules use `MAP <IP address> <hostname>` with exact, case-insensitive hostnames. IPv4 and IPv6 addresses are supported; wildcards, ports in rules, and duplicate hostnames are rejected. The original URL, HTTP `Host` header, TLS server name, scheme, and port are preserved. For example, an HTTPS URL still requires a local HTTPS listener on the URL's port.

Mappings are scoped to each API request/test and never modify the system hosts file. `127.0.0.1` and `::1` refer to the machine or container running the Node.js server, not necessarily your browser. When mappings are present, outbound requests bypass environment-configured HTTP/HTTPS proxies so DNS resolution happens locally. The existing HTTPS certificate-verification behavior is unchanged.

API clients can send the same multiline string as `hostMappings` in the JSON body of `/api/sitemap/fetch`, `/api/stress-test-stream`, and `/api/stress-test`. Include it on each request. Invalid rules return HTTP 400 with an error message before any outbound requests or streaming events.

## 📋 Scripts

```bash
npm start     # Start the production server
npm run dev   # Start development server with auto-reload
npm test      # Run resolver and API tests (Node.js 18+)

# Start on a specific port
npm start -- --port 3001
```

## 📄 Sample Sitemap

A sample sitemap is included at `/sample-sitemap.xml` for testing purposes. You can access it directly in the app or use your own sitemap URLs.
