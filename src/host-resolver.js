const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const { isIP } = require('node:net');
const { domainToASCII } = require('node:url');

function normalizeHostname(hostname) {
  return domainToASCII(hostname).toLowerCase().replace(/\.$/, '');
}

function createRequestOptions(hostMappings = '') {
  if (typeof hostMappings !== 'string') {
    throw new Error('Host mappings must be text containing one MAP <IP> <hostname> rule per line');
  }

  const mappings = new Map();
  hostMappings.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;

    const parts = line.trim().split(/\s+/);
    const [command, address, hostname] = parts;
    const normalized = hostname ? normalizeHostname(hostname) : '';
    const validHostname = normalized.length <= 253 && normalized.split('.').every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    );

    if (parts.length !== 3 || command.toUpperCase() !== 'MAP' || !isIP(address || '') ||
        !validHostname || isIP(normalized) || /[\s/:@?#\\]/.test(hostname)) {
      throw new Error(`Invalid host mapping on line ${index + 1}. Expected MAP <IP> <hostname>`);
    }
    if (mappings.has(normalized)) {
      throw new Error(`Duplicate host mapping on line ${index + 1}: ${hostname}`);
    }
    mappings.set(normalized, { address, family: isIP(address) });
  });

  if (mappings.size === 0) {
    return { httpsAgent: new https.Agent({ rejectUnauthorized: false }) };
  }

  function lookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    } else if (typeof options === 'number') {
      options = { family: options };
    }
    options = options || {};

    const mapping = mappings.get(normalizeHostname(hostname));
    if (!mapping) return dns.lookup(hostname, options, callback);

    process.nextTick(() => {
      if (options.family && options.family !== mapping.family) {
        const error = new Error(`Host mapping for ${hostname} has no IPv${options.family} address`);
        error.code = 'ENOTFOUND';
        callback(error);
      } else if (options.all) {
        callback(null, [{ ...mapping }]);
      } else {
        callback(null, mapping.address, mapping.family);
      }
    });
  }

  return {
    proxy: false,
    httpAgent: new http.Agent({ lookup }),
    httpsAgent: new https.Agent({ lookup, rejectUnauthorized: false })
  };
}

module.exports = { createRequestOptions };