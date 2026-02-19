// =============================================================================
// BUGGY VERSION — This is what the candidate receives
// Swap the import in app.js from ./webhook.service.js to ./webhook.buggy.js
// =============================================================================

import { db } from './store.js';

export const processWebhook = (body) => {
  const { payment_id, status } = body;

  const payment = db.findById('payments', payment_id);
  if (!payment) {
    throw { status: 404, message: 'payment not found' };
  }

  // BUG: No idempotency check — duplicate webhooks processed multiple times
  // BUG: No amount verification — accepts any amount
  // BUG: No status transition validation — allows completed -> pending
  // BUG: No webhook logging — no audit trail
  // BUG: No ticket confirmation — held tickets stay held forever

  payment.status = status;

  const order = db.findById('orders', payment.order_id);
  if (order && status === 'completed') {
    order.status = 'confirmed';
    order.payment_status = 'paid';
  }

  return { received: true, payment_status: status };
};
