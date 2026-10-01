const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const tls = require('node:tls');
const { test } = require('node:test');
const axios = require('axios');
const { createRequestOptions } = require('../src/host-resolver');
const app = require('../src/server');

function resolveHost(requestOptions, hostname, options = {}) {
  return new Promise((resolve, reject) => {
    requestOptions.httpAgent.options.lookup(hostname, options, (error, address, family) => {
      if (error) reject(error);
      else resolve(options.all ? address : { address, family });
    });
  });
}

test('empty mappings retain ordinary DNS and proxy behavior', () => {
  for (const input of [undefined, '', ' \r\n ']) {
    const options = createRequestOptions(input);
    assert.equal(options.httpAgent, undefined);
    assert.equal(options.proxy, undefined);
    assert.equal(options.httpsAgent.options.lookup, undefined);
    options.httpsAgent.destroy();
  }
});

test('rejects malformed and duplicate rules', () => {
  for (const input of [null, {}, ['MAP 127.0.0.1 dev.example.com'],
    'MAP dev.example.com 127.0.0.1', 'MAP localhost dev.example.com',
    'MAP 999.0.0.1 dev.example.com', 'MAP 127.0.0.1 https://dev.example.com',
    'MAP 127.0.0.1 dev.example.com:3000', 'MAP 127.0.0.1 *.example.com',
    'MAP 127.0.0.1 127.0.0.2', 'MAP 127.0.0.1 dev.example.com extra',
    'MAP 127.0.0.1 dev.example.com\nMAP ::1 DEV.EXAMPLE.COM.']) {
    assert.throws(() => createRequestOptions(input), /host mapping/i);
  }
});

test('resolves IPv4 and IPv6, normalizes names, and falls back for unmapped hosts', async context => {
  const options = createRequestOptions(' map 127.0.0.1 DEV.EXAMPLE.COM. \r\n\nMAP ::1 ipv6.example.com');
  context.after(() => {
    options.httpAgent.destroy();
    options.httpsAgent.destroy();
  });
  assert.equal(options.proxy, false);
  assert.equal(options.httpsAgent.options.lookup, options.httpAgent.options.lookup);
  assert.deepEqual(await resolveHost(options, 'dev.example.com'), { address: '127.0.0.1', family: 4 });
  assert.deepEqual(await resolveHost(options, 'DEV.EXAMPLE.COM.', { all: true }), [{ address: '127.0.0.1', family: 4 }]);
  assert.deepEqual(await resolveHost(options, 'ipv6.example.com', { family: 6, all: true }), [{ address: '::1', family: 6 }]);
  await assert.rejects(resolveHost(options, 'ipv6.example.com', { family: 4 }), { code: 'ENOTFOUND' });
  assert.ok([4, 6].includes((await resolveHost(options, 'localhost')).family));
});

test('mapping is isolated to its request options', async context => {
  const first = createRequestOptions('MAP 127.0.0.1 dev.example.com');
  const second = createRequestOptions('MAP 127.0.0.2 dev.example.com');
  context.after(() => {
    for (const options of [first, second]) {
      options.httpAgent.destroy();
      options.httpsAgent.destroy();
    }
  });
  const results = await Promise.all([first, second].map(options => resolveHost(options, 'dev.example.com')));
  assert.deepEqual(results.map(result => result.address), ['127.0.0.1', '127.0.0.2']);
});

test('Axios connects locally while preserving Host and following mapped redirects', async context => {
  const seenHosts = [];
  const server = http.createServer((request, response) => {
    seenHosts.push(request.headers.host);
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: `http://pages.invalid:${server.address().port}/page` });
      response.end();
    } else {
      response.end('local page');
    }
  });
  context.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const options = createRequestOptions('MAP 127.0.0.1 sitemap.invalid\nMAP 127.0.0.1 pages.invalid');
  context.after(() => {
    options.httpAgent.destroy();
    options.httpsAgent.destroy();
  });
  const port = server.address().port;
  const response = await axios.get(`http://sitemap.invalid:${port}/redirect`, { ...options, timeout: 2000 });
  assert.equal(response.data, 'local page');
  assert.deepEqual(seenHosts, [`sitemap.invalid:${port}`, `pages.invalid:${port}`]);
});

test('HTTPS connects locally with the original TLS server name', async context => {
  let seenServername;
  const server = tls.createServer({
    SNICallback(servername, callback) {
      seenServername = servername;
      callback(new Error('Stop after inspecting SNI'));
    }
  });
  server.on('tlsClientError', () => {});
  context.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const options = createRequestOptions('MAP 127.0.0.1 secure.invalid');
  context.after(() => {
    options.httpAgent.destroy();
    options.httpsAgent.destroy();
  });
  await assert.rejects(axios.get(`https://secure.invalid:${server.address().port}/`, { ...options, timeout: 2000 }));
  assert.equal(seenServername, 'secure.invalid');
});

test('API applies mappings to sitemap fetching and both stress-test endpoints', async context => {
  const seenHosts = [];
  const target = http.createServer((request, response) => {
    seenHosts.push(request.headers.host);
    if (request.url === '/sitemap.xml') {
      response.setHeader('Content-Type', 'application/xml');
      response.end(`<urlset><url><loc>http://pages.invalid:${target.address().port}/page</loc></url></urlset>`);
    } else {
      response.end('local page');
    }
  });
  target.listen(0, '127.0.0.1');
  context.after(() => new Promise(resolve => target.close(resolve)));
  await once(target, 'listening');
  const api = app.listen(0, '127.0.0.1');
  context.after(() => new Promise(resolve => api.close(resolve)));
  await once(api, 'listening');
  const client = axios.create({ baseURL: `http://127.0.0.1:${api.address().port}`, proxy: false, timeout: 3000 });
  const port = target.address().port;
  const hostMappings = 'MAP 127.0.0.1 sitemap.invalid\nMAP 127.0.0.1 pages.invalid';
  const url = `http://sitemap.invalid:${port}/sitemap.xml`;
  const pageUrl = `http://pages.invalid:${port}/page`;
  const sitemap = await client.post('/api/sitemap/fetch', { url, hostMappings });
  assert.deepEqual(sitemap.data, { success: true, urls: [pageUrl] });

  const payload = { urls: sitemap.data.urls, hostMappings, concurrency: 1, delay: 1 };
  const legacy = await client.post('/api/stress-test', payload);
  assert.equal(legacy.data.success, true);
  assert.equal(legacy.data.results[0].success, true);
  assert.equal(legacy.data.results[0].url, pageUrl);

  const stream = await client.post('/api/stress-test-stream', payload);
  assert.match(stream.headers['content-type'], /text\/event-stream/);
  const events = stream.data.trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
  assert.deepEqual(events.map(event => event.type), ['start', 'progress', 'complete']);
  assert.equal(events[1].result.success, true);
  assert.equal(events[1].result.url, pageUrl);
  assert.deepEqual(seenHosts, [`sitemap.invalid:${port}`, `pages.invalid:${port}`, `pages.invalid:${port}`]);

  for (const endpoint of ['/api/sitemap/fetch', '/api/stress-test', '/api/stress-test-stream']) {
    const response = await client.post(endpoint, { ...payload, url, hostMappings: 'MAP invalid-ip sitemap.invalid' }, {
      validateStatus: () => true
    });
    assert.equal(response.status, 400);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.equal(response.data.success, false);
    assert.match(response.data.error, /line 1/);
  }
  assert.equal(seenHosts.length, 3);

  const ordinary = await client.post('/api/sitemap/fetch', { url: `http://127.0.0.1:${port}/sitemap.xml` });
  assert.equal(ordinary.data.success, true);
});