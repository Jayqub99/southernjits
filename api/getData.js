module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/scrims?select=data&order=id.asc&limit=1`, {
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
