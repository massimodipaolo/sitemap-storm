document.addEventListener('DOMContentLoaded', () => {    // DOM elements
    const sitemapFileInput = document.getElementById('sitemap-file');
    const sitemapPreview = document.getElementById('sitemap-preview');
    const urlCountSpan = document.getElementById('url-count');
    const urlListDiv = document.getElementById('url-list');
    const startTestBtn = document.getElementById('start-test');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('test-progress');
    const progressText = document.getElementById('progress-text');
    const abortTestBtn = document.getElementById('abort-test');
    const dashboardDiv = document.getElementById('dashboard');
    const concurrencyInput = document.getElementById('concurrency');
    const concurrencyValue = document.getElementById('concurrency-value');
    const delayInput = document.getElementById('delay');
    const delayValue = document.getElementById('delay-value');
    const maxUrlsInput = document.getElementById('max-urls');
    const maxUrlsValue = document.getElementById('max-urls-value');
    
    // Chart instances
    let responseTimeChart = null;
    let statusChart = null;
    
    // Test data
    let sitemapUrls = [];
    let testResults = [];
    let testAborted = false;
      // Update range sliders
    concurrencyInput.addEventListener('input', () => {
        concurrencyValue.textContent = concurrencyInput.value;
    });
    
    delayInput.addEventListener('input', () => {
        delayValue.textContent = `${delayInput.value}ms`;
    });
    
    maxUrlsInput.addEventListener('input', () => {
        maxUrlsValue.textContent = `${maxUrlsInput.value}%`;
    });
      // Handle sitemap file upload
    sitemapFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // Check if the file is an XML
        if (!file.name.toLowerCase().endsWith('.xml')) {
            alert('Please upload a valid XML sitemap file');
            sitemapFileInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const xmlContent = e.target.result;
            
            // Show loading state
            sitemapPreview.classList.add('d-none');
            urlListDiv.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Processing sitemap...</p></div>';
            
            // Process the XML content
            fetch('/api/sitemap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: xmlContent }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success && data.urls && data.urls.length > 0) {
                    sitemapUrls = data.urls;
                    urlCountSpan.textContent = sitemapUrls.length;
                    sitemapPreview.classList.remove('d-none');
                    
                    // Display URLs
                    renderUrlList();
                } else {
                    alert('No URLs found in the sitemap or invalid format');
                    sitemapFileInput.value = '';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error processing sitemap: ' + error.message);
                sitemapFileInput.value = '';
            });
        };
        
        reader.readAsText(file);
    });
    
    // Render the list of URLs
    function renderUrlList() {
        urlListDiv.innerHTML = '';
        sitemapUrls.forEach((url, index) => {
            // Display only first 100 URLs in the preview to avoid UI lag
            if (index < 100) {
                const div = document.createElement('div');
                div.className = 'url-item';
                div.textContent = url;
                urlListDiv.appendChild(div);
            }
        });
        
        if (sitemapUrls.length > 100) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'url-item text-muted';
            moreDiv.textContent = `...and ${sitemapUrls.length - 100} more URLs`;
            urlListDiv.appendChild(moreDiv);
        }
    }
    
    // Start the stress test
    startTestBtn.addEventListener('click', () => {
        if (sitemapUrls.length === 0) {
            alert('No URLs found in the sitemap');
            return;
        }
        
        // Reset state
        testResults = [];
        testAborted = false;
          // Configure test parameters
        const concurrency = parseInt(concurrencyInput.value);
        const delay = parseInt(delayInput.value);
        const maxUrlsPercent = parseInt(maxUrlsInput.value);
        
        // Calculate max URLs to test based on percentage
        const maxUrls = Math.ceil(sitemapUrls.length * (maxUrlsPercent / 100));
        
        // Show progress
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressText.textContent = 'Initializing test...';
        
        // Run the test
        runStressTest(sitemapUrls, concurrency, delay, maxUrls);
    });
    
    // Abort the test
    abortTestBtn.addEventListener('click', () => {
        testAborted = true;
        abortTestBtn.disabled = true;
        abortTestBtn.textContent = 'Aborting...';
        progressText.textContent = 'Aborting test...';
    });      // Run the stress test
    async function runStressTest(urls, concurrency, delayMs, maxUrls) {
        try {
            // Update progress UI
            progressBar.style.width = '0%';
            progressBar.classList.remove('bg-danger');
            progressText.textContent = 'Starting test...';
            
            // Limit the number of URLs to test based on user's selection
            const urlsToTest = maxUrls ? urls.slice(0, maxUrls) : urls;
            
            // Display URL count being tested
            progressText.textContent = `Starting test on ${urlsToTest.length} URLs...`;
            
            // Start the test
            const response = await fetch('/api/stress-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls: urlsToTest, concurrency, delay: delayMs }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                testResults = data.results;
                displayTestResults();
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error during stress test:', error);
            alert('Error running stress test: ' + error.message);
            progressText.textContent = `Error: ${error.message}`;
            progressBar.classList.add('bg-danger');
        } finally {
            progressContainer.classList.add('d-none');
        }
    }
      // Display test results in the dashboard
    function displayTestResults() {
        dashboardDiv.style.display = 'block';
        
        // Calculate statistics
        const totalRequests = testResults.length;
        const successfulRequests = testResults.filter(r => r.success).length;
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) : 0;
        const errorRate = totalRequests > 0 ? (100 - successRate).toFixed(2) : 0;
        
        const responseTimes = testResults.map(r => r.responseTime);
        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;
        
        // Update summary statistics
        document.getElementById('total-requests').textContent = totalRequests;
        document.getElementById('success-rate').textContent = `${successRate}%`;
        document.getElementById('avg-time').textContent = `${avgResponseTime}ms`;
        document.getElementById('error-rate').textContent = `${errorRate}%`;
        
        // Generate charts
        createResponseTimeHistogram(responseTimes);
        createStatusCodeChart(testResults);
        
        // Display detailed results
        displayDetailedResults(testResults);
          // Show export and test again buttons
        if (totalRequests > 0) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'btn-group mt-3 mb-3';
            
            const exportButton = document.createElement('button');
            exportButton.className = 'btn btn-primary';
            exportButton.textContent = 'Export Results as CSV';
            exportButton.onclick = exportResultsToCSV;
            
            const testAgainButton = document.createElement('button');
            testAgainButton.className = 'btn btn-success ms-2';
            testAgainButton.textContent = 'Test Again';
            testAgainButton.onclick = () => {
                window.scrollTo(0, 0);
                dashboardDiv.style.display = 'none';
                progressContainer.classList.add('d-none');
                testResults = [];
            };
            
            buttonContainer.appendChild(exportButton);
            buttonContainer.appendChild(testAgainButton);
            
            const container = document.getElementById('results-container');
            container.parentNode.insertBefore(buttonContainer, container);
        }
    }
    
    // Export results to CSV
    function exportResultsToCSV() {
        if (testResults.length === 0) return;
        
        const headers = ['URL', 'Status Code', 'Status Text', 'Response Time (ms)', 'Success'];
        const rows = testResults.map(result => [
            result.url,
            result.status,
            result.statusText || '',
            result.responseTime,
            result.success ? 'Yes' : 'No'
        ]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            // Properly escape fields that may contain commas
            const escapedRow = row.map(field => {
                if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            });
            csvContent += escapedRow.join(',') + '\n';
        });
        
        // Create a blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sitemap_stress_test_results.csv');
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Create response time histogram
    function createResponseTimeHistogram(responseTimes) {
        const ctx = document.getElementById('response-time-chart').getContext('2d');
        
        // Clean up previous chart if it exists
        if (responseTimeChart) {
            responseTimeChart.destroy();
        }
        
        // Define buckets for histogram (in milliseconds)
        const buckets = [
            { label: '0-100', min: 0, max: 100, count: 0 },
            { label: '101-250', min: 101, max: 250, count: 0 },
            { label: '251-500', min: 251, max: 500, count: 0 },
            { label: '501-1000', min: 501, max: 1000, count: 0 },
            { label: '1001-2000', min: 1001, max: 2000, count: 0 },
            { label: '2001-5000', min: 2001, max: 5000, count: 0 },
            { label: '5000+', min: 5001, max: Infinity, count: 0 }
        ];
        
        // Count responses in each bucket
        responseTimes.forEach(time => {
            const bucket = buckets.find(b => time >= b.min && time <= b.max);
            if (bucket) {
                bucket.count++;
            }
        });
        
        responseTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: buckets.map(b => b.label),
                datasets: [{
                    label: 'Response Time Distribution',
                    data: buckets.map(b => b.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Requests'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    }
                }
            }
        });
    }
    
    // Create status code chart
    function createStatusCodeChart(results) {
        const ctx = document.getElementById('status-chart').getContext('2d');
        
        // Clean up previous chart if it exists
        if (statusChart) {
            statusChart.destroy();
        }
        
        // Count status codes
        const statusCounts = {};
        results.forEach(result => {
            const status = result.status === 'error' ? 'Network Error' : result.status;
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        // Create labels and data
        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);
        
        // Create background colors based on status code
        const backgroundColors = labels.map(label => {
            if (label === 'Network Error') return 'rgba(220, 53, 69, 0.5)'; // Error
            const code = parseInt(label);
            if (code >= 200 && code < 300) return 'rgba(40, 167, 69, 0.5)';  // Success
            if (code >= 300 && code < 400) return 'rgba(255, 193, 7, 0.5)';  // Redirect
            if (code >= 400 && code < 500) return 'rgba(253, 126, 20, 0.5)'; // Client Error
            if (code >= 500) return 'rgba(220, 53, 69, 0.5)';               // Server Error
            return 'rgba(108, 117, 125, 0.5)';                              // Unknown
        });
        
        statusChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(c => c.replace('0.5', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }
    
    // Display detailed results
    function displayDetailedResults(results) {
        const container = document.getElementById('results-container');
        container.innerHTML = '';
        
        // Sort by response time
        const sortedResults = [...results].sort((a, b) => b.responseTime - a.responseTime);
        
        sortedResults.forEach(result => {
            const div = document.createElement('div');
            
            // Style based on response
            let statusClass = 'warning';
            if (result.success) {
                statusClass = 'success';
            } else if (result.status === 'error' || result.status >= 500) {
                statusClass = 'error';
            }
            
            div.className = `result-item ${statusClass}`;
            
            // Create content
            div.innerHTML = `
                <strong>URL:</strong> ${result.url}<br>
                <strong>Status:</strong> ${result.status} ${result.statusText ? `(${result.statusText})` : ''}<br>
                <strong>Response Time:</strong> ${result.responseTime}ms
            `;
            
            container.appendChild(div);
        });
    }
});
