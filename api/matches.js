/**
 * Vercel Serverless Function: matches
 * ------------------------------------
 * Fetches recent ranked solo queue match history for a given PUUID.
 * Makes all Riot Match-V5 calls server-side to avoid CORS and to
 * parallelize the per-match detail fetches in one round trip.
 *
 * Query params:
 *   puuid  — player PUUID (from account API)
 *   key    — Riot API key
 *   count  — number of matches to list (default 10, max 20)
 *   have   — comma-separated match IDs the browser already has cached;
 *            their details aren't fetched again (finished matches never change)
 *
 * Returns { ids: [...newest first], details: { matchId: summary|null } }
 * with details only for IDs not in `have`.
 */

const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body), retryAfter: res.headers['retry-after'] }); }
        catch (e) { reject(new Error('Invalid JSON from Riot API')); }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { puuid, key, count, have } = req.query || {};
  const cached = new Set(String(have || '').split(',').filter(Boolean));

  if (!puuid || !key) return res.status(400).json({ error: 'Missing puuid or key' });
  if (!/^RGAPI-[a-zA-Z0-9-]+$/.test(key)) return res.status(400).json({ error: 'Invalid key format' });

  const gameCount = Math.min(parseInt(count) || 10, 20);

  try {
    // 1. Get recent ranked solo queue match IDs (queue=420)
    const { status: s1, data: ids, retryAfter } = await fetchJson(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=420&type=ranked&count=${gameCount}&api_key=${key}`
    );

    if (s1 !== 200) {
      if (retryAfter) res.setHeader('Retry-After', retryAfter);
      return res.status(s1).json({ error: ids?.status?.message || `Match list error (${s1})` });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(200).json({ ids: [], details: {} });
    }

    // 2. Fetch details only for matches the browser doesn't have yet
    const missing = ids.filter(id => !cached.has(id));
    const fetched = await Promise.all(
      missing.map(id => fetchJson(`https://americas.api.riotgames.com/lol/match/v5/matches/${id}?api_key=${key}`).catch(() => ({ status: 0 })))
    );

    // 3. Extract the data relevant to this player from each match.
    // Failed fetches (e.g. rate limited) are left out, so they're retried next time.
    const details = {};
    fetched.forEach(({ status, data: m }, i) => {
      if (status !== 200 || !m?.info?.participants) return;
      const p = m.info.participants.find(x => x.puuid === puuid);
      if (!p) return;
      details[missing[i]] = {
        champion:  p.championName,
        position:  p.teamPosition,   // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ""
        win:       p.win,
        kills:     p.kills,
        deaths:    p.deaths,
        assists:   p.assists,
        cs:        p.totalMinionsKilled + p.neutralMinionsKilled,
        duration:  m.info.gameDuration,   // seconds
        gameDate:  m.info.gameStartTimestamp, // epoch ms
      };
    });

    return res.status(200).json({ ids, details });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
