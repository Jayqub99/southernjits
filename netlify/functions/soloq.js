/**
 * Netlify Serverless Function: soloq
 * -----------------------------------
 * Proxies Riot API calls server-side so the browser doesn't hit CORS errors.
 *
 * Called by the Solo Queue tab as:
 *   /.netlify/functions/soloq?endpoint=<riot_api_path>&key=<api_key>
 *
 * Supported endpoints (passed as the `endpoint` query param):
 *   /riot/account/v1/accounts/by-riot-id/{summoner}/{tag}   (americas)
 *   /lol/summoner/v4/summoners/by-puuid/{puuid}              (na1)
 *   /lol/league/v4/entries/by-summoner/{summonerId}          (na1)
 */

const https = require('https');

const REGION_MAP = {
  '/riot/account': 'americas.api.riotgames.com',
  '/lol/':         'na1.api.riotgames.com',
};

function getHost(endpoint) {
  for (const [prefix, host] of Object.entries(REGION_MAP)) {
    if (endpoint.startsWith(prefix)) return host;
  }
  return 'na1.api.riotgames.com';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ status: res.statusCode, data });
        } catch (e) {
          reject(new Error('Invalid JSON from Riot API'));
        }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { endpoint, key } = event.queryStringParameters || {};

  if (!endpoint || !key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing endpoint or key parameter' }),
    };
  }

  // Basic key sanity check
  if (!/^RGAPI-[a-zA-Z0-9-]+$/.test(key)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid API key format' }),
    };
  }

  const host = getHost(endpoint);
  const url = `https://${host}${endpoint}?api_key=${key}`;

  try {
    const { status, data } = await fetchJson(url);
    return {
      statusCode: status,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
