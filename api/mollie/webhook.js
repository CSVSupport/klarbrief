// /api/mollie/webhook.js
// Handles Mollie payment webhooks
// - Lifetime (oneoff): Updates user profile to 'lifetime' plan
// - Plus/Pro/Business (first): Creates recurring subscription, updates profile

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'MOLLIE_API_KEY not configured' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'No payment ID' });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'https://klarbrief24.de';

  // Init Supabase admin client (uses service role key for server-side updates)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = (supabaseUrl && serviceKey) ? createClient(supabaseUrl, serviceKey) : null;

  try {
    const paymentResp = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const payment = await paymentResp.json();

    console.log(`Webhook: Payment ${id} status=${payment.status} seq=${payment.sequenceType}`);

    if (payment.status !== 'paid') {
      return res.status(200).end();
    }

    const { plan, email, customerId } = payment.metadata || {};
    if (!plan || !email) {
      console.error('Missing metadata:', payment.metadata);
      return res.status(200).end();
    }

    // ── LIFETIME: One-off payment, no subscription ──
    if (payment.sequenceType === 'oneoff' && plan === 'lifetime') {
      console.log(`Lifetime payment received: ${email}`);
      if (supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({
            plan: 'lifetime',
            mollie_customer_id: customerId,
            subscription_active: true,
            next_payment_date: null,
          })
          .eq('email', email);
        if (error) console.error('Profile update error:', error);
        else console.log(`Profile updated to lifetime for ${email}`);
      } else {
        console.warn('Supabase not configured — cannot update profile');
      }
      return res.status(200).end();
    }

    // ── RECURRING (Plus/Pro/Business): First payment establishes mandate ──
    if (payment.sequenceType === 'first') {
      const prices = { plus: '4.99', pro: '9.99', business: '29.99' };
      const planNames = { plus: 'KlarBrief24 Plus', pro: 'KlarBrief24 Pro', business: 'KlarBrief24 Business' };
      const amount = prices[plan];

      if (!amount) {
        console.error('Invalid recurring plan:', plan);
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
        console.error('Subscription creation failed:', subscription);
      } else {
        console.log(`Subscription created: ${subscription.id} for ${email} (${plan})`);
        // Update profile in Supabase
        if (supabase) {
          const { error } = await supabase
            .from('profiles')
            .update({
              plan,
              mollie_customer_id: customerId,
              mollie_subscription_id: subscription.id,
              subscription_active: true,
              next_payment_date: subscription.nextPaymentDate || null,
            })
            .eq('email', email);
          if (error) console.error('Profile update error:', error);
        }
      }
      return res.status(200).end();
    }

    // ── RECURRING PAYMENT: Subsequent monthly charges ──
    if (payment.sequenceType === 'recurring') {
      console.log(`Recurring payment ${id}: ${payment.status} for ${email}`);
      return res.status(200).end();
    }

    return res.status(200).end();

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).end();
  }
}

export const config = {
  api: { bodyParser: true },
};
