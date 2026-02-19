import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { db } from './store.js';
import { processWebhook } from './webhook.service.js';
import { swaggerSpec } from './swagger.js';

export const app = express();

app.use(express.json());

// --- Swagger UI ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// --- Webhook endpoint (the one being tested) ---
app.post('/webhook', async (req, res) => {
  const result = processWebhook(req.body);
  res.json(result);
});

// --- Helper endpoints for curl testing / data setup ---

app.post('/seed', (req, res) => {
  const results = {};
  if (req.body.orders) {
    results.orders = req.body.orders.map((o) => db.create('orders', o));
  }
  if (req.body.payments) {
    results.payments = req.body.payments.map((p) => db.create('payments', p));
  }
  if (req.body.tickets) {
    results.tickets = req.body.tickets.map((t) => db.create('tickets', t));
  }
  res.status(201).json(results);
});

app.get('/orders/:id', (req, res) => {
  const order = db.findById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

app.get('/payments/:id', (req, res) => {
  const payment = db.findById('payments', req.params.id);
  if (!payment) return res.status(404).json({ error: 'not found' });
  res.json(payment);
});

app.get('/tickets', (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ error: 'order_id query param required' });
  const tickets = db.filter('tickets', (t) => t.order_id === String(order_id));
  res.json(tickets);
});

app.get('/webhook-logs', (req, res) => {
  const { webhook_event_id } = req.query;
  if (webhook_event_id) {
    const log = db.findOne('webhookLogs', (l) => l.webhook_event_id === webhook_event_id);
    return res.json(log ? [log] : []);
  }
  res.json(db.webhookLogs);
});

app.post('/reset', (req, res) => {
  db.reset();
  res.json({ message: 'reset complete' });
});

// --- Error handler ---
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'internal error' });
});
