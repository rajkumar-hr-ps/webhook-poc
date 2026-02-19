import { use, expect } from 'chai';
import chaiHttp from 'chai-http';
import { request } from 'chai-http';
import { app } from '../src/app.js';
import { db } from '../src/store.js';

use(chaiHttp);

describe('Payment Webhook Handler', function () {
  this.timeout(5000);

  beforeEach(() => {
    db.reset();
  });

  // --- Test 01: Payment not found ---
  it('should return 404 when payment does not exist', async () => {
    const body = {
      payment_id: '999',
      status: 'completed',
      amount: 100,
      webhook_event_id: 'evt_001',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(404);
    expect(res.body.error).to.match(/payment not found/i);
  });

  // --- Test 02: Amount mismatch ---
  it('should return 400 when amount does not match order total', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 100,
      webhook_event_id: 'evt_002',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(400);
    expect(res.body.error).to.match(/amount does not match/i);
  });

  // --- Test 03: Duplicate webhook idempotency ---
  it('should handle duplicate webhook idempotently', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: 'evt_003',
    };

    // First request — processes normally
    const res1 = await request.execute(app).post('/webhook').send(body);
    expect(res1).to.have.status(200);
    expect(res1.body.received).to.equal(true);
    expect(res1.body.payment_status).to.equal('completed');

    // Second request — same webhook_event_id → duplicate
    const res2 = await request.execute(app).post('/webhook').send(body);
    expect(res2).to.have.status(200);
    expect(res2.body.received).to.equal(true);
    expect(res2.body.duplicate).to.equal(true);
  });

  // --- Test 04: Valid payment completion ---
  it('should process valid payment completion and update order', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: 'evt_004',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(200);
    expect(res.body.received).to.equal(true);
    expect(res.body.payment_status).to.equal('completed');

    expect(order.status).to.equal('confirmed');
    expect(order.payment_status).to.equal('paid');
  });

  // --- Test 05: Invalid status transition ---
  it('should ignore invalid status transition (completed -> pending)', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'confirmed',
      payment_status: 'paid',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'completed',
    });

    const body = {
      payment_id: payment.id,
      status: 'pending',
      amount: 237,
      webhook_event_id: 'evt_005',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(200);
    expect(res.body.received).to.equal(true);
    expect(res.body.ignored).to.equal(true);
  });

  // --- Test 06: Tickets confirmed on successful payment ---
  it('should confirm all held tickets on successful payment', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });

    const ticket1 = db.create('tickets', { order_id: order.id, status: 'held', unit_price: 79 });
    const ticket2 = db.create('tickets', { order_id: order.id, status: 'held', unit_price: 79 });
    const ticket3 = db.create('tickets', { order_id: order.id, status: 'held', unit_price: 79 });

    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: 'evt_006',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(200);

    expect(ticket1.status).to.equal('confirmed');
    expect(ticket2.status).to.equal('confirmed');
    expect(ticket3.status).to.equal('confirmed');
  });

  // --- Test 07: Failed payment updates order ---
  it('should update order payment_status on failed payment', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'failed',
      amount: 237,
      webhook_event_id: 'evt_007',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(200);
    expect(res.body.payment_status).to.equal('failed');
    expect(order.payment_status).to.equal('failed');
  });

  // --- Test 08: WebhookLog entry created ---
  it('should create a webhook log entry', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'pending',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'pending',
    });

    const webhookEventId = 'evt_008_logged';
    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: webhookEventId,
    };

    await request.execute(app).post('/webhook').send(body);

    const log = db.findOne('webhookLogs', (l) => l.webhook_event_id === webhookEventId);
    expect(log).to.not.be.undefined;
    expect(log.webhook_event_id).to.equal(webhookEventId);
    expect(log.payment_id).to.equal(payment.id);
    expect(log.status).to.equal('completed');
  });

  // --- Test 09: Order not found for payment ---
  it('should return 404 when order does not exist for payment', async () => {
    const payment = db.create('payments', {
      order_id: '999',
      amount: 237,
      status: 'pending',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: 'evt_009',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(404);
    expect(res.body.error).to.match(/order not found/i);
  });

  // --- Test 10: Valid processing -> completed transition ---
  it('should allow valid processing -> completed transition', async () => {
    const order = db.create('orders', {
      total_amount: 237,
      status: 'pending',
      payment_status: 'processing',
    });
    const payment = db.create('payments', {
      order_id: order.id,
      amount: 237,
      status: 'processing',
    });

    const body = {
      payment_id: payment.id,
      status: 'completed',
      amount: 237,
      webhook_event_id: 'evt_010',
    };

    const res = await request.execute(app).post('/webhook').send(body);

    expect(res).to.have.status(200);
    expect(res.body.received).to.equal(true);
    expect(res.body.payment_status).to.equal('completed');
    expect(order.status).to.equal('confirmed');
    expect(order.payment_status).to.equal('paid');
  });
});
