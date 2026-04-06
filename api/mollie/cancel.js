// /api/mollie/cancel.js
// Cancels an active Mollie subscription

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'MOLLIE_API_KEY not configured' });

  const { customerId, subscriptionId } = req.body;
  if (!customerId || !subscriptionId) {
    return res.status(400).json({ error: 'customerId and subscriptionId required' });
  }

  try {
    const resp = await fetch(
      `https://api.mollie.com/v2/customers/${customerId}/subscriptions/${subscriptionId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    if (resp.status === 204 || resp.status === 200) {
      return res.status(200).json({ success: true, message: 'Subscription cancelled' });
    }

    const data = await resp.json();
    return res.status(resp.status).json({ error: 'Cancel failed', details: data });

  } catch (error) {
    console.error('Cancel error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
