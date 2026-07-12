module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  // Optional ?row=N selects which data row to read (1 = legacy Southern Jits
  // scrims, 3 = teams registry, 4+ = additional team scrim data). Row 2 is
  // config and served by getConfig instead.
  const row = parseInt((req.query || {}).row) || 1;
  if (row < 1 || row === 2) {
    return res.status(400).json({ error: 'Invalid row' });
  }

  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/scrims?select=data&id=eq.${row}&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const rows = await supaRes.json();
    if (!supaRes.ok) throw new Error(rows.message || 'Supabase error');

    const data = rows[0]?.data || [];
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
