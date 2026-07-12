/**
 * Vercel Serverless Function: discord
 * -------------------------------------
 * Builds a Discord embed from a scrim session and POSTs it to a
 * Discord webhook URL. The webhook URL never touches the browser.
 *
 * POST body: { webhookUrl, session: [...games] }
 */

function fmtDate(d) {
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length === 3) {
    const [m, day, y] = parts;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
  }
  return d;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { webhookUrl, session, teamName } = req.body || {};
  const team = (typeof teamName === 'string' && teamName.trim()) ? teamName.trim() : 'Southern Jits';

  if (!webhookUrl || !Array.isArray(session) || !session.length) {
    return res.status(400).json({ error: 'Missing webhookUrl or session data' });
  }

  // Validate it's actually a Discord webhook
  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhookUrl)) {
    return res.status(400).json({ error: 'Invalid Discord webhook URL' });
  }

  const wins   = session.filter(g => g.result === 'Win').length;
  const losses = session.length - wins;
  const opponent = session[0].opponent || 'Unknown';
  const date     = fmtDate(session[0].date);

  // Embed color: green = series win, red = series loss, gold = split
  const color = wins > losses ? 0x27ae60 : losses > wins ? 0xe74c3c : 0xf39c12;

  // Series result line
  const seriesLabel = wins > losses
    ? `✅ Series Win — ${wins}–${losses}`
    : losses > wins
    ? `❌ Series Loss — ${wins}–${losses}`
    : `🤝 Split — ${wins}–${losses}`;

  const ROLES = ['top','jng','mid','adc','sup'];
  const ENEMY = ['etop','ejng','emid','eadc','esup'];

  const fields = session.map(g => {
    const icon  = g.result === 'Win' ? '🟢' : '🔴';
    const our   = ROLES.map(r => g[r] || '—').join(' · ');
    const enemy = ENEMY.map(r => g[r] || '—').join(' · ');
    const players = ROLES.map(r => g.players?.[r] || '').filter(Boolean).join(' · ');
    return {
      name:  `${icon} ${g.game} — **${g.result}**`,
      value: `**Our picks:** ${our}\n${players ? `**Players:** ${players}\n` : ''}**Enemy:** ${enemy}`,
      inline: false,
    };
  });

  // Add series summary as last field
  fields.push({
    name:  '──────────────',
    value: `**${seriesLabel}**`,
    inline: false,
  });

  const embed = {
    title:       `⚔️  ${team} vs ${opponent}`,
    description: date,
    color,
    fields,
    footer:     { text: `${team} Scrims` },
    timestamp:  new Date().toISOString(),
  };

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      return res.status(502).json({ error: `Discord error: ${err}` });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
