// /api/mollie/checkout.js
// Creates a Mollie customer + first payment to establish a mandate for recurring billing

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'MOLLIE_API_KEY not configured' });

  const { email, name, plan } = req.body;
  if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });

  const prices = { plus: '4.99', pro: '9.99', business: '29.99', lifetime: '59.00' };
  const planNames = { plus: 'KlarBrief24 Plus', pro: 'KlarBrief24 Pro', business: 'KlarBrief24 Business', lifetime: 'KlarBrief24 Lifetime' };
  const amount = prices[plan];
  if (!amount) return res.status(400).json({ error: 'Invalid plan' });

  const isLifetime = plan === 'lifetime';
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'https://klarbrief24.de';

  try {
    // Step 1: Create or find Mollie customer
    const customersResp = await fetch('https://api.mollie.com/v2/customers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || email, email }),
    });
    const customer = await customersResp.json();

    if (customer.status >= 400) {
      return res.status(400).json({ error: 'Could not create customer', details: customer });
    }

    // Step 2: Create payment
    // - Lifetime → oneoff, redirect to /danke
    // - Plus/Pro → first payment to establish mandate for recurring
    const paymentBody = isLifetime ? {
      amount: { currency: 'EUR', value: amount },
      customerId: customer.id,
      sequenceType: 'oneoff',
      description: `${planNames[plan]} — Einmalzahlung`,
      redirectUrl: `${baseUrl}/#danke?plan=${plan}&customerId=${customer.id}`,
      webhookUrl: `${baseUrl}/api/mollie/webhook`,
      metadata: { plan, email, customerId: customer.id },
    } : {
      amount: { currency: 'EUR', value: amount },
      customerId: customer.id,
      sequenceType: 'first',
      description: `${planNames[plan]} — Ersteinrichtung`,
      redirectUrl: `${baseUrl}/#/payment-success?plan=${plan}&customerId=${customer.id}`,
      webhookUrl: `${baseUrl}/api/mollie/webhook`,
      metadata: { plan, email, customerId: customer.id },
    };

    const paymentResp = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentBody),
    });
    const payment = await paymentResp.json();

    if (payment.status >= 400 || !payment._links?.checkout?.href) {
      return res.status(400).json({ error: 'Could not create payment', details: payment });
    }

    return res.status(200).json({
      checkoutUrl: payment._links.checkout.href,
      customerId: customer.id,
      paymentId: payment.id,
    });

  } catch (error) {
    console.error('Mollie checkout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
