// =============================================================================
// SOLUTION — Payment Webhook Handler (all tests pass with this code)
//
// The BUGGY version (what the candidate receives) is at the bottom of this file
// in a comment block. Swap them to see tests fail.
// =============================================================================

import { db } from './store.js';

const VALID_STATUS_TRANSITIONS = {
  pending: ['processing', 'completed', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: ['processing'],
};

export const processWebhook = (body) => {
  const { payment_id, status, amount, webhook_event_id } = body;

  // 1. Idempotency: skip if this webhook event was already processed
  const existingLog = db.findOne(
    'webhookLogs',
    (l) => l.webhook_event_id === webhook_event_id
  );
  if (existingLog) {
    return { received: true, duplicate: true };
  }

  // 2. Log this webhook event
  db.create('webhookLogs', {
    webhook_event_id,
    payment_id,
    status,
    received_at: new Date().toISOString(),
  });

  // 3. Find payment
  const payment = db.findById('payments', payment_id);
  if (!payment) {
    throw { status: 404, message: 'payment not found' };
  }

  // 4. Find order
  const order = db.findById('orders', payment.order_id);
  if (!order) {
    throw { status: 404, message: 'order not found' };
  }

  // 5. Verify amount matches order total
  if (Math.abs(amount - order.total_amount) > 0.01) {
    throw { status: 400, message: 'payment amount does not match order total' };
  }

  // 6. Validate status transition
  const allowed = VALID_STATUS_TRANSITIONS[payment.status];
  if (!allowed || !allowed.includes(status)) {
    return {
      received: true,
      ignored: true,
      reason: `cannot transition from '${payment.status}' to '${status}'`,
    };
  }

  // 7. Update payment status
  payment.status = status;
  payment.processed_at = new Date().toISOString();

  // 8. Update order and tickets based on new status
  if (status === 'completed') {
    order.status = 'confirmed';
    order.payment_status = 'paid';

    // Confirm all held tickets for this order
    const heldTickets = db.filter(
      'tickets',
      (t) => t.order_id === order.id && t.status === 'held'
    );
    heldTickets.forEach((t) => {
      t.status = 'confirmed';
    });
  } else if (status === 'failed') {
    order.payment_status = 'failed';
  }

  return { received: true, payment_status: payment.status };
};

// =============================================================================
// BUGGY VERSION — Swap this into `processWebhook` to see tests fail
// =============================================================================
//
// export const processWebhook = (body) => {
//   const { payment_id, status } = body;
//
//   const payment = db.findById('payments', payment_id);
//   if (!payment) {
//     throw { status: 404, message: 'payment not found' };
//   }
//
//   // BUG: No idempotency check — duplicate webhooks processed multiple times
//   // BUG: No amount verification — accepts any amount
//   // BUG: No status transition validation — allows completed -> pending
//   // BUG: No webhook logging — no audit trail
//   // BUG: No ticket confirmation — held tickets stay held forever
//
//   payment.status = status;
//
//   const order = db.findById('orders', payment.order_id);
//   if (order && status === 'completed') {
//     order.status = 'confirmed';
//     order.payment_status = 'paid';
//   }
//
//   return { received: true, payment_status: status };
// };
