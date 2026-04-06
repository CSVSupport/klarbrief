// /api/mollie/status.js
// Returns subscription status for a Mollie customer

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'MOLLIE_API_KEY not configured' });

  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: 'customerId required' });

  try {
    const resp = await fetch(
      `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    const data = await resp.json();

    if (data._embedded?.subscriptions) {
      const active = data._embedded.subscriptions.find(s => s.status === 'active');
      if (active) {
        return res.status(200).json({
          active: true,
          subscriptionId: active.id,
          plan: active.metadata?.plan || 'plus',
          amount: active.amount?.value,
          interval: active.interval,
          nextPaymentDate: active.nextPaymentDate,
          startDate: active.startDate,
        });
      }
    }

    return res.status(200).json({ active: false });

  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
