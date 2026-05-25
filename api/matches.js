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
 *   count  — number of matches to fetch (default 7, max 15)
 */

const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('Invalid JSON from Riot API')); }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { puuid, key, count } = req.query || {};

  if (!puuid || !key) return res.status(400).json({ error: 'Missing puuid or key' });
  if (!/^RGAPI-[a-zA-Z0-9-]+$/.test(key)) return res.status(400).json({ error: 'Invalid key format' });

  const gameCount = Math.min(parseInt(count) || 7, 15);

  try {
    // 1. Get recent ranked solo queue match IDs (queue=420)
    const { status: s1, data: ids } = await fetchJson(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=420&type=ranked&count=${gameCount}&api_key=${key}`
    );

    if (s1 !== 200) {
      return res.status(s1).json({ error: ids?.status?.message || `Match list error (${s1})` });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Fetch all match details in parallel
    const details = await Promise.all(
      ids.map(id => fetchJson(`https://americas.api.riotgames.com/lol/match/v5/matches/${id}?api_key=${key}`))
    );

    // 3. Extract the data relevant to this player from each match
    const result = details.map(({ status, data: m }) => {
      if (status !== 200 || !m?.info?.participants) return null;
      const p = m.info.participants.find(x => x.puuid === puuid);
      if (!p) return null;
      return {
        champion:  p.championName,
        position:  p.teamPosition,   // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ""
        win:       p.win,
        kills:     p.kills,
        deaths:    p.deaths,
        assists:   p.assists,
        cs:        p.totalMinionsKilled + p.neutralMinionsKilled,
        duration:  m.info.gameDuration,   // seconds
      };
    }).filter(Boolean);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
