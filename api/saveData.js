module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = req.body;

    // Use upsert so the row is created automatically if it doesn't exist yet
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/scrims`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ id: 1, data, updated_at: new Date().toISOString() })
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
