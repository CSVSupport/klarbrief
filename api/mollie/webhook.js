// /api/mollie/webhook.js
// Handles Mollie payment webhooks — creates subscription after first successful payment

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'MOLLIE_API_KEY not configured' });

  const { id } = req.body; // Mollie sends payment ID
  if (!id) return res.status(400).json({ error: 'No payment ID' });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'https://klarbrief.de';

  try {
    // Fetch payment details
    const paymentResp = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const payment = await paymentResp.json();

    console.log(`Webhook: Payment ${id} status=${payment.status} seq=${payment.sequenceType}`);

    // Only act on successful first payments (to create subscription)
    if (payment.status === 'paid' && payment.sequenceType === 'first') {
      const { plan, email, customerId } = payment.metadata || {};
      if (!plan || !customerId) {
        console.error('Missing metadata in payment:', payment.metadata);
        return res.status(200).end(); // Still return 200 to Mollie
      }

      const prices = { plus: '4.99', pro: '9.99', business: '29.99' };
      const planNames = { plus: 'KlarBrief Plus', pro: 'KlarBrief Pro', business: 'KlarBrief Business' };
      const amount = prices[plan];

      if (!amount) {
        console.error('Invalid plan in metadata:', plan);
        return res.status(200).end();
      }

      // Create recurring subscription
      const subResp = await fetch(`https://api.mollie.com/v2/customers/${customerId}/subscriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency: 'EUR', value: amount },
          interval: '1 month',
          description: `${planNames[plan]} — Monatliches Abo`,
          webhookUrl: `${baseUrl}/api/mollie/webhook`,
          metadata: { plan, email },
        }),
      });
      const subscription = await subResp.json();

      if (subscription.status >= 400) {
        console.error('Failed to create subscription:', subscription);
      } else {
        console.log(`Subscription created: ${subscription.id} for ${email} (${plan})`);
      }
    }

    // Log recurring payment status
    if (payment.sequenceType === 'recurring') {
      console.log(`Recurring payment ${id}: ${payment.status} for ${payment.metadata?.email}`);
    }

    // Always return 200 to acknowledge webhook
    return res.status(200).end();

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).end(); // Still return 200
  }
}

export const config = {
  api: { bodyParser: true },
};
