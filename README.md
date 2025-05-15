# Sitemap Stress Tester

A web application for stress testing websites using sitemap.xml files to determine performance under load.

## Features

- Upload and parse any sitemap.xml file
- Configure test parameters:
  - Concurrent requests (1-20)
  - Delay between batches (0-2000ms)
  - Max URLs to test (10% to 100% of sitemap)
- Real-time progress tracking
- Detailed results dashboard with:
  - Response time distribution chart
  - Status code distribution chart
  - Success/error rates
  - Average response time
  - Detailed results for each URL
- Export results to CSV

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/sitemap-storm.git

# Navigate to the project directory
cd sitemap-storm

# Install dependencies
npm install

# Start the server
npm start
```

## Usage

1. Open your browser and navigate to http://localhost:3000
2. Upload a sitemap.xml file
3. Configure the test parameters:
   - Adjust concurrent requests (default: 3)
   - Set delay between batches (default: 500ms)
   - Choose the percentage of URLs to test (default: 100%)
4. Click "Start Stress Test"
5. View the results in the dashboard
6. Export results to CSV if needed

## Sample Sitemap

A sample sitemap is included in the `public` folder for testing purposes.

## Technology Stack

- Frontend: HTML, CSS, JavaScript, Chart.js, Bootstrap
- Backend: Node.js, Express
- Libraries: xml2js for XML parsing, axios for HTTP requests

## License

MIT
