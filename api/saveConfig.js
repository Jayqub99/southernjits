module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Callers send only the fields they changed ({ riotIds } alone, etc.), so
    // merge into the stored config instead of replacing it — otherwise saving
    // a Riot ID wiped the saved API key and Discord webhook.
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/scrims?select=data&id=eq.2&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const existingRows = await existingRes.json();
    if (!existingRes.ok) throw new Error(existingRows.message || 'Supabase error');
    const existing = existingRows[0]?.data;
    const data = {
      ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
      ...req.body
    };

    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/scrims`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ id: 2, data, updated_at: new Date().toISOString() })
    });

    if (!supaRes.ok) {
      const err = await supaRes.text();
      throw new Error(err);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
