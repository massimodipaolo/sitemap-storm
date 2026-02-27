document.addEventListener('DOMContentLoaded', () => {    // DOM elements
    const sitemapFileInput = document.getElementById('sitemap-file');
    const sitemapUrlInput = document.getElementById('sitemap-url');
    const fetchSitemapBtn = document.getElementById('fetch-sitemap');
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
    const headerKeyInput = document.getElementById('header-key');
    const headerValueInput = document.getElementById('header-value');
    const addHeaderBtn = document.getElementById('add-header');
    const headerListDiv = document.getElementById('header-list');
    const estimatedThroughput = document.getElementById('estimated-throughput');
    
    // Chart instances
    let responseTimeChart = null;
    let statusChart = null;
    let liveRateChart = null;
    
    // Test data
    let sitemapUrls = [];
    let testResults = [];
    let testAborted = false;
    let customHeaders = {};
    let testHistory = [];
    
    // Load test history from localStorage
    function loadTestHistory() {
        const saved = localStorage.getItem('sitemapTestHistory');
        if (saved) {
            try {
                testHistory = JSON.parse(saved);
                // Keep only last 10 tests
                if (testHistory.length > 10) {
                    testHistory = testHistory.slice(-10);
                    localStorage.setItem('sitemapTestHistory', JSON.stringify(testHistory));
                }
            } catch (e) {
                console.error('Failed to load test history:', e);
                testHistory = [];
            }
        }
    }
    
    // Save test history to localStorage
    function saveTestHistory(testData) {
        testHistory.push(testData);
        // Keep only last 10 tests
        if (testHistory.length > 10) {
            testHistory.shift();
        }
        localStorage.setItem('sitemapTestHistory', JSON.stringify(testHistory));
    }
    
    // Initialize test history
    loadTestHistory();
    
    // Live rate tracking
    let recentResponseTimes = [];
    let baselineTime = 1000; // 1 second baseline
    let rateCheckInterval = null;
      // Update range sliders
    concurrencyInput.addEventListener('input', () => {
        concurrencyValue.textContent = concurrencyInput.value;
        updateEstimatedThroughput();
    });
    
    delayInput.addEventListener('input', () => {
        delayValue.textContent = `${delayInput.value}ms`;
        updateEstimatedThroughput();
    });
    
    maxUrlsInput.addEventListener('input', () => {
        maxUrlsValue.textContent = `${maxUrlsInput.value}%`;
    });
    
    // Calculate and display estimated throughput
    function updateEstimatedThroughput() {
        if (!estimatedThroughput) return; // Guard clause if element doesn't exist
        
        const concurrency = parseInt(concurrencyInput.value);
        const delay = parseInt(delayInput.value);
        
        // Assume average response time of 1000ms (1 second) for estimation
        const estimatedAvgResponseTime = 1000;
        const totalTimePerRequest = estimatedAvgResponseTime + delay;
        
        // Requests per user per minute
        const requestsPerUserPerMin = (60000 / totalTimePerRequest);
        
        // Total requests per minute across all concurrent users
        const totalRequestsPerMin = Math.round(concurrency * requestsPerUserPerMin);
        
        estimatedThroughput.textContent = `~${totalRequestsPerMin} requests/min`;
        
        // Update info text
        const infoConcurrency = document.getElementById('info-concurrency');
        const infoDelay = document.getElementById('info-delay');
        if (infoConcurrency) infoConcurrency.textContent = concurrency;
        if (infoDelay) infoDelay.textContent = delay;
    }
    
    // Initialize throughput display
    updateEstimatedThroughput();
    
    // Handle adding custom headers
    addHeaderBtn.addEventListener('click', () => {
        const key = headerKeyInput.value.trim();
        const value = headerValueInput.value.trim();
        
        if (!key) {
            alert('Please enter a header name');
            return;
        }
        
        if (!value) {
            alert('Please enter a header value');
            return;
        }
        
        // Add to headers object
        customHeaders[key] = value;
        
        // Clear inputs
        headerKeyInput.value = '';
        headerValueInput.value = '';
        
        // Render headers list
        renderHeadersList();
    });
    
    // Allow Enter key to add header
    headerValueInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addHeaderBtn.click();
        }
    });
    
    // Render custom headers list
    function renderHeadersList() {
        headerListDiv.innerHTML = '';
        
        const headerKeys = Object.keys(customHeaders);
        
        if (headerKeys.length === 0) {
            headerListDiv.innerHTML = '<div class="text-muted small p-2">No custom headers added</div>';
            return;
        }
        
        headerKeys.forEach(key => {
            const div = document.createElement('div');
            div.className = 'header-item';
            
            const keySpan = document.createElement('span');
            keySpan.className = 'badge bg-secondary';
            keySpan.textContent = key;
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'flex-grow-1';
            valueSpan.textContent = customHeaders[key];
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-sm btn-danger';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
                delete customHeaders[key];
                renderHeadersList();
            };
            
            div.appendChild(keySpan);
            div.appendChild(valueSpan);
            div.appendChild(removeBtn);
            headerListDiv.appendChild(div);
        });
    }
    
    // Initialize headers list
    renderHeadersList();
      // Handle sitemap file upload
    sitemapFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // Clear URL input when file is selected
        sitemapUrlInput.value = '';
        
        // Check if the file is an XML
        if (!file.name.toLowerCase().endsWith('.xml')) {
            alert('Please upload a valid XML sitemap file');
            sitemapFileInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const xmlContent = e.target.result;
            processSitemap(xmlContent);
        };
        
        reader.readAsText(file);
    });
    
    // Handle sitemap URL fetch
    fetchSitemapBtn.addEventListener('click', () => {
        const url = sitemapUrlInput.value.trim();
        
        if (!url) {
            alert('Please enter a sitemap URL');
            return;
        }
        
        // Basic URL validation
        try {
            new URL(url);
        } catch (e) {
            alert('Please enter a valid URL');
            return;
        }
        
        // Clear file input when URL is used
        sitemapFileInput.value = '';
        
        // Show loading state
        fetchSitemapBtn.disabled = true;
        fetchSitemapBtn.textContent = 'Fetching...';
        sitemapPreview.classList.add('d-none');
        urlListDiv.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Fetching sitemap from URL...</p></div>';
        
        // Fetch the sitemap
        fetch('/api/sitemap/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.urls && data.urls.length > 0) {
                sitemapUrls = data.urls;
                urlCountSpan.textContent = sitemapUrls.length;
                sitemapPreview.classList.remove('d-none');
                renderUrlList();
            } else {
                alert('No URLs found in the sitemap or invalid format');
                sitemapUrlInput.value = '';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error fetching sitemap: ' + error.message);
            sitemapUrlInput.value = '';
        })
        .finally(() => {
            fetchSitemapBtn.disabled = false;
            fetchSitemapBtn.textContent = 'Fetch';
        });
    });
    
    // Allow Enter key to fetch sitemap
    sitemapUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchSitemapBtn.click();
        }
    });
    
    // Process sitemap XML content
    function processSitemap(xmlContent) {
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
    }
    
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
        const totalRequests = maxUrls * concurrency; // Total requests = URLs × Concurrent Users
        
        // Show progress
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressText.textContent = `Simulating ${concurrency} concurrent users testing ${maxUrls} URLs (${totalRequests} total requests)...`;
        document.getElementById('urls-total').textContent = totalRequests;
        document.getElementById('urls-completed').textContent = '0';
        document.getElementById('live-success-count').textContent = '0';
        document.getElementById('live-error-count').textContent = '0';
        document.getElementById('live-avg-time').textContent = '0';
        document.getElementById('live-active-requests').textContent = '0';
        
        // Initialize live rate tracking
        recentResponseTimes = [];
        baselineTime = 1000; // 1 second
        initializeLiveRateChart();
        startRateTracking();
        
        // Run the test with streaming
        runStressTestStreaming(sitemapUrls, concurrency, delay, maxUrls);
    });
    
    // Abort the test
    abortTestBtn.addEventListener('click', () => {
        testAborted = true;
        abortTestBtn.disabled = true;
        abortTestBtn.textContent = 'Aborting...';
        progressText.textContent = 'Aborting test...';
        stopRateTracking();
    });
    
    // Initialize live rate chart
    function initializeLiveRateChart() {
        const ctx = document.getElementById('live-rate-chart');
        if (!ctx) return;
        
        // Clean up previous chart if it exists
        if (liveRateChart) {
            liveRateChart.destroy();
        }
        
        liveRateChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Avg Response Time',
                        data: [],
                        borderColor: '#20e3b2',
                        backgroundColor: 'rgba(32, 227, 178, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointBackgroundColor: '#20e3b2',
                        segment: {
                            borderColor: ctx => {
                                const value = ctx.p1.parsed.y;
                                if (value > 3000) return '#f5576c'; // Red for >3s
                                if (value > 2000) return '#ffd93d'; // Yellow for >2s
                                if (value > 1500) return '#fd7e14'; // Orange for >1.5s
                                return '#20e3b2'; // Green for good
                            }
                        }
                    },
                    {
                        label: 'Target (1s)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.05)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        ticks: { color: '#adb5bd' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#adb5bd' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            color: '#e9ecef'
                        }
                    }
                },
                animation: {
                    duration: 200
                }
            }
        });
    }
    
    // Start rate tracking interval
    function startRateTracking() {
        stopRateTracking(); // Clear any existing interval
        
        rateCheckInterval = setInterval(() => {
            if (!liveRateChart || recentResponseTimes.length === 0) return;
            
            // Calculate average response time from recent results
            const recentLimit = 20; // Use last 20 requests for moving average
            const recentSlice = recentResponseTimes.slice(-recentLimit);
            const avgResponseTime = Math.round(
                recentSlice.reduce((sum, time) => sum + time, 0) / recentSlice.length
            );
            
            // Get current time label
            const timeLabel = new Date().toLocaleTimeString();
            
            // Update chart data
            liveRateChart.data.labels.push(timeLabel);
            liveRateChart.data.datasets[0].data.push(avgResponseTime);
            liveRateChart.data.datasets[1].data.push(baselineTime);
            
            // Keep only last 15 data points for readability
            if (liveRateChart.data.labels.length > 15) {
                liveRateChart.data.labels.shift();
                liveRateChart.data.datasets[0].data.shift();
                liveRateChart.data.datasets[1].data.shift();
            }
            
            liveRateChart.update();
        }, 2000); // Update every 2 seconds
    }
    
    // Stop rate tracking
    function stopRateTracking() {
        if (rateCheckInterval) {
            clearInterval(rateCheckInterval);
            rateCheckInterval = null;
        }
    }      // Run the stress test with Server-Sent Events for real-time progress
    function runStressTestStreaming(urls, concurrency, delayMs, maxUrls) {
        // Limit the number of URLs to test based on user's selection
        const urlsToTest = maxUrls ? urls.slice(0, maxUrls) : urls;
        
        // Update initial UI
        progressBar.style.width = '0%';
        progressBar.classList.remove('bg-danger');
        progressText.textContent = `Starting test on ${urlsToTest.length} URLs...`;
        
        // Prepare the request body
        const requestBody = {
            urls: urlsToTest,
            concurrency,
            delay: delayMs,
            headers: customHeaders
        };
        
        // Start SSE connection
        fetch('/api/stress-test-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            function processStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        console.log('Stream complete');
                        return;
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer
                    
                    lines.forEach(line => {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                handleStreamEvent(data);
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    });
                    
                    return processStream();
                });
            }
            
            return processStream();
        })
        .catch(error => {
            console.error('Error during stress test:', error);
            alert('Error running stress test: ' + error.message);
            progressText.textContent = `Error: ${error.message}`;
            progressBar.classList.add('bg-danger');
        });
    }
    
    // Handle streaming events
    function handleStreamEvent(data) {
        switch (data.type) {
            case 'start':
                console.log(`Test started with ${data.total} URLs`);
                break;
                
            case 'progress':
                // Add result to our array
                testResults.push(data.result);
                
                // Track response time for chart
                recentResponseTimes.push(data.result.responseTime);
                
                // Update progress bar
                progressBar.style.width = `${data.percent}%`;
                progressBar.textContent = `${data.percent}%`;
                
                // Update progress text
                progressText.textContent = `User ${data.userId + 1} testing... ${data.completed} of ${data.total} requests completed`;
                
                // Update live counters
                document.getElementById('urls-completed').textContent = data.completed;
                document.getElementById('live-success-count').textContent = data.successCount;
                document.getElementById('live-error-count').textContent = data.errorCount;
                document.getElementById('live-avg-time').textContent = data.avgResponseTime;
                document.getElementById('live-active-requests').textContent = data.activeRequests || 0;
                
                console.log(`Progress: ${data.percent}% - ${data.result.url} - ${data.result.status} - ${data.result.responseTime}ms`);
                break;
                
            case 'complete':
                console.log('Test completed');
                stopRateTracking();
                progressContainer.classList.add('d-none');
                displayTestResults();
                break;
                
            case 'error':
                console.error('Test error:', data.error);
                stopRateTracking();
                alert('Error during test: ' + data.error);
                progressContainer.classList.add('d-none');
                break;
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
        
        // Save test to history
        const testData = {
            timestamp: new Date().toISOString(),
            results: testResults,
            summary: {
                totalRequests,
                successRate: parseFloat(successRate),
                errorRate: parseFloat(errorRate),
                avgResponseTime
            },
            config: {
                concurrency: parseInt(concurrencyInput.value),
                delay: parseInt(delayInput.value)
            }
        };
        saveTestHistory(testData);
        
        // Generate charts
        createResponseTimeHistogram(responseTimes);
        createStatusCodeChart(testResults);
        
        // Display detailed results
        displayDetailedResults(testResults);
          // Show export and test again buttons
        if (totalRequests > 0) {
            // Remove existing button container if it exists
            const existingButtons = document.getElementById('results-action-buttons');
            if (existingButtons) {
                existingButtons.remove();
            }
            
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'results-action-buttons';
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
                const comparisonSection = document.getElementById('comparison-section');
                if (comparisonSection) comparisonSection.style.display = 'none';
                testResults = [];
            };
            
            const compareButton = document.createElement('button');
            compareButton.className = 'btn btn-primary ms-2';
            compareButton.innerHTML = '📊 Compare Tests';
            if (testHistory.length < 2) {
                compareButton.disabled = true;
                compareButton.title = 'Need at least 2 test runs to compare';
            } else {
                compareButton.onclick = showComparisonView;
            }
            
            buttonContainer.appendChild(exportButton);
            buttonContainer.appendChild(testAgainButton);
            buttonContainer.appendChild(compareButton);
            
            const container = document.getElementById('results-container');
            container.parentNode.insertBefore(buttonContainer, container);
        }
    }
    
    // Export results to CSV
    function exportResultsToCSV() {
        if (testResults.length === 0) return;
        
        // Group results by URL
        const groupedByUrl = {};
        testResults.forEach(result => {
            if (!groupedByUrl[result.url]) {
                groupedByUrl[result.url] = [];
            }
            groupedByUrl[result.url].push(result);
        });
        
        const headers = ['URL', 'Total Requests', 'Success Rate (%)', 'Min Response Time (ms)', 'Max Response Time (ms)', 'Avg Response Time (ms)', 'Status Codes'];
        const rows = Object.entries(groupedByUrl).map(([url, urlResults]) => {
            const responseTimes = urlResults.map(r => r.responseTime);
            const minTime = Math.min(...responseTimes);
            const maxTime = Math.max(...responseTimes);
            const avgTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
            const totalRequests = urlResults.length;
            const successCount = urlResults.filter(r => r.success).length;
            const successRate = ((successCount / totalRequests) * 100).toFixed(1);
            
            // Group by status code
            const statusGroups = {};
            urlResults.forEach(r => {
                const status = r.status;
                if (!statusGroups[status]) {
                    statusGroups[status] = 0;
                }
                statusGroups[status]++;
            });
            
            const statusDisplay = Object.entries(statusGroups)
                .map(([status, count]) => `${status}(${count})`)
                .join(' ');
            
            return [
                url,
                totalRequests,
                successRate,
                minTime,
                maxTime,
                avgTime,
                statusDisplay
            ];
        });
        
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
        
        // Group results by URL
        const groupedByUrl = {};
        results.forEach(result => {
            if (!groupedByUrl[result.url]) {
                groupedByUrl[result.url] = [];
            }
            groupedByUrl[result.url].push(result);
        });
        
        // Process each URL group
        const urlStats = Object.entries(groupedByUrl).map(([url, urlResults]) => {
            const responseTimes = urlResults.map(r => r.responseTime);
            const minTime = Math.min(...responseTimes);
            const maxTime = Math.max(...responseTimes);
            const avgTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
            const totalRequests = urlResults.length;
            
            // Group by status code
            const statusGroups = {};
            urlResults.forEach(r => {
                const status = r.status;
                if (!statusGroups[status]) {
                    statusGroups[status] = { count: 0, statusText: r.statusText };
                }
                statusGroups[status].count++;
            });
            
            // Determine overall status class
            const successCount = urlResults.filter(r => r.success).length;
            const successRate = (successCount / totalRequests) * 100;
            let statusClass = 'success';
            if (successRate < 50) {
                statusClass = 'error';
            } else if (successRate < 100) {
                statusClass = 'warning';
            }
            
            return {
                url,
                minTime,
                maxTime,
                avgTime,
                totalRequests,
                statusGroups,
                statusClass,
                successRate
            };
        });
        
        // Sort by average response time (descending)
        urlStats.sort((a, b) => b.avgTime - a.avgTime);
        
        // Display each URL group
        urlStats.forEach(stats => {
            const div = document.createElement('div');
            div.className = `result-item ${stats.statusClass}`;
            
            // Build status codes display
            const statusDisplay = Object.entries(stats.statusGroups)
                .map(([status, info]) => `${status} (${info.count})`)
                .join(', ');
            
            // Create content
            div.innerHTML = `
                <div class="mb-2">
                    <strong>URL:</strong> ${stats.url}
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <strong>Requests:</strong> ${stats.totalRequests}<br>
                        <strong>Success Rate:</strong> ${stats.successRate.toFixed(1)}%
                    </div>
                    <div class="col-md-6">
                        <strong>Response Time:</strong><br>
                        &nbsp;&nbsp;Min: ${stats.minTime}ms | Max: ${stats.maxTime}ms | Avg: ${stats.avgTime}ms
                    </div>
                </div>
                <div class="mt-2">
                    <strong>Status Codes:</strong> ${statusDisplay}
                </div>
            `;
            
            container.appendChild(div);
        });
    }
    
    // Show comparison view
    function showComparisonView() {
        const comparisonSection = document.getElementById('comparison-section');
        if (!comparisonSection) {
            // Create comparison section if it doesn't exist
            const section = document.createElement('div');
            section.id = 'comparison-section';
            section.className = 'card mt-4';
            section.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h4>📊 Test Comparison</h4>
                    <button id="close-comparison" class="btn btn-sm btn-danger">Close</button>
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label class="form-label">Test 1</label>
                            <select id="test1-select" class="form-select"></select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Test 2</label>
                            <select id="test2-select" class="form-select"></select>
                        </div>
                    </div>
                    <button id="run-comparison" class="btn btn-primary mb-3">Compare Selected Tests</button>
                    <div id="comparison-results"></div>
                </div>
            `;
            dashboardDiv.appendChild(section);
            
            // Add event listener for close button
            document.getElementById('close-comparison').addEventListener('click', () => {
                section.style.display = 'none';
            });
            
            // Add event listener for compare button
            document.getElementById('run-comparison').addEventListener('click', compareSelectedTests);
        }
        
        // Populate dropdowns with test history
        const test1Select = document.getElementById('test1-select');
        const test2Select = document.getElementById('test2-select');
        
        test1Select.innerHTML = '';
        test2Select.innerHTML = '';
        
        testHistory.forEach((test, index) => {
            const date = new Date(test.timestamp);
            const label = `Test ${index + 1} - ${date.toLocaleString()} (${test.summary.totalRequests} requests)`;
            
            const option1 = document.createElement('option');
            option1.value = index;
            option1.textContent = label;
            test1Select.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = index;
            option2.textContent = label;
            test2Select.appendChild(option2);
        });
        
        // Select the last two tests by default
        if (testHistory.length >= 2) {
            test1Select.value = testHistory.length - 2;
            test2Select.value = testHistory.length - 1;
        }
        
        comparisonSection.style.display = 'block';
        comparisonSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Compare selected tests
    function compareSelectedTests() {
        const test1Index = parseInt(document.getElementById('test1-select').value);
        const test2Index = parseInt(document.getElementById('test2-select').value);
        
        if (test1Index === test2Index) {
            alert('Please select two different tests to compare');
            return;
        }
        
        const test1 = testHistory[test1Index];
        const test2 = testHistory[test2Index];
        
        const resultsDiv = document.getElementById('comparison-results');
        resultsDiv.innerHTML = '';
        
        // Summary comparison
        const summaryCard = document.createElement('div');
        summaryCard.className = 'card mb-3';
        summaryCard.innerHTML = `
            <div class="card-header"><h5>Summary Comparison</h5></div>
            <div class="card-body">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Test 1</th>
                            <th>Test 2</th>
                            <th>Difference</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Requests</td>
                            <td>${test1.summary.totalRequests}</td>
                            <td>${test2.summary.totalRequests}</td>
                            <td>${formatDifference(test2.summary.totalRequests - test1.summary.totalRequests, '')}</td>
                        </tr>
                        <tr>
                            <td>Success Rate</td>
                            <td>${test1.summary.successRate.toFixed(2)}%</td>
                            <td>${test2.summary.successRate.toFixed(2)}%</td>
                            <td>${formatDifference(test2.summary.successRate - test1.summary.successRate, '%', true)}</td>
                        </tr>
                        <tr>
                            <td>Avg Response Time</td>
                            <td>${test1.summary.avgResponseTime}ms</td>
                            <td>${test2.summary.avgResponseTime}ms</td>
                            <td>${formatDifference(test2.summary.avgResponseTime - test1.summary.avgResponseTime, 'ms', false)}</td>
                        </tr>
                        <tr>
                            <td>Error Rate</td>
                            <td>${test1.summary.errorRate.toFixed(2)}%</td>
                            <td>${test2.summary.errorRate.toFixed(2)}%</td>
                            <td>${formatDifference(test2.summary.errorRate - test1.summary.errorRate, '%', false)}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="mt-3">
                    <h6>Configuration</h6>
                    <p><strong>Test 1:</strong> ${test1.config.concurrency} concurrent users, ${test1.config.delay}ms delay</p>
                    <p><strong>Test 2:</strong> ${test2.config.concurrency} concurrent users, ${test2.config.delay}ms delay</p>
                </div>
            </div>
        `;
        resultsDiv.appendChild(summaryCard);
        
        // URL-by-URL comparison
        const urlCard = document.createElement('div');
        urlCard.className = 'card';
        urlCard.innerHTML = '<div class="card-header"><h5>URL-by-URL Comparison</h5></div><div class="card-body" id="url-comparison-body"></div>';
        resultsDiv.appendChild(urlCard);
        
        const urlBody = document.getElementById('url-comparison-body');
        
        // Group results by URL for both tests
        const test1ByUrl = groupResultsByUrl(test1.results);
        const test2ByUrl = groupResultsByUrl(test2.results);
        
        // Find all unique URLs
        const allUrls = new Set([...Object.keys(test1ByUrl), ...Object.keys(test2ByUrl)]);
        
        allUrls.forEach(url => {
            const stats1 = test1ByUrl[url];
            const stats2 = test2ByUrl[url];
            
            if (!stats1 || !stats2) {
                // URL only in one test
                const urlDiv = document.createElement('div');
                urlDiv.className = 'alert alert-warning';
                urlDiv.innerHTML = `<strong>${url}</strong><br>Only tested in ${stats1 ? 'Test 1' : 'Test 2'}`;
                urlBody.appendChild(urlDiv);
                return;
            }
            
            const urlDiv = document.createElement('div');
            urlDiv.className = 'mb-3 p-3 border rounded';
            
            const avgDiff = stats2.avgTime - stats1.avgTime;
            const successDiff = stats2.successRate - stats1.successRate;
            
            let statusClass = '';
            if (avgDiff < 0 && successDiff >= 0) {
                statusClass = 'border-success';
            } else if (avgDiff > 0 || successDiff < 0) {
                statusClass = 'border-danger';
            }
            
            urlDiv.className += ` ${statusClass}`;
            
            urlDiv.innerHTML = `
                <div class="mb-2"><strong>${url}</strong></div>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Test 1</th>
                            <th>Test 2</th>
                            <th>Difference</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Avg Response Time</td>
                            <td>${stats1.avgTime}ms</td>
                            <td>${stats2.avgTime}ms</td>
                            <td>${formatDifference(avgDiff, 'ms', false)}</td>
                        </tr>
                        <tr>
                            <td>Min Response Time</td>
                            <td>${stats1.minTime}ms</td>
                            <td>${stats2.minTime}ms</td>
                            <td>${formatDifference(stats2.minTime - stats1.minTime, 'ms', false)}</td>
                        </tr>
                        <tr>
                            <td>Max Response Time</td>
                            <td>${stats1.maxTime}ms</td>
                            <td>${stats2.maxTime}ms</td>
                            <td>${formatDifference(stats2.maxTime - stats1.maxTime, 'ms', false)}</td>
                        </tr>
                        <tr>
                            <td>Success Rate</td>
                            <td>${stats1.successRate.toFixed(1)}%</td>
                            <td>${stats2.successRate.toFixed(1)}%</td>
                            <td>${formatDifference(successDiff, '%', true)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
            
            urlBody.appendChild(urlDiv);
        });
    }
    
    // Helper function to group results by URL
    function groupResultsByUrl(results) {
        const grouped = {};
        results.forEach(result => {
            if (!grouped[result.url]) {
                grouped[result.url] = [];
            }
            grouped[result.url].push(result);
        });
        
        // Calculate stats for each URL
        Object.keys(grouped).forEach(url => {
            const urlResults = grouped[url];
            const responseTimes = urlResults.map(r => r.responseTime);
            const successCount = urlResults.filter(r => r.success).length;
            
            grouped[url] = {
                minTime: Math.min(...responseTimes),
                maxTime: Math.max(...responseTimes),
                avgTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
                successRate: (successCount / urlResults.length) * 100,
                totalRequests: urlResults.length
            };
        });
        
        return grouped;
    }
    
    // Helper function to format difference with color coding
    function formatDifference(diff, unit, higherIsBetter) {
        const sign = diff > 0 ? '+' : '';
        const value = `${sign}${diff.toFixed(2)}${unit}`;
        
        let color = 'text-secondary';
        if (diff !== 0) {
            const isImprovement = higherIsBetter ? diff > 0 : diff < 0;
            color = isImprovement ? 'text-success' : 'text-danger';
        }
        
        return `<span class="${color} fw-bold">${value}</span>`;
    }
});
