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

## 📋 Scripts

```bash
npm start     # Start the production server
npm run dev   # Start development server with auto-reload
```

## 📄 Sample Sitemap

A sample sitemap is included at `/sample-sitemap.xml` for testing purposes. You can access it directly in the app or use your own sitemap URLs.
