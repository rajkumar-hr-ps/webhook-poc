export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Webhook POC — Payment Webhook Handler',
    version: '1.0.0',
    description:
      'Standalone proof-of-concept for the payment webhook handler. ' +
      'Uses an in-memory store — no MongoDB or Redis required.',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local dev server' }],
  paths: {
    '/webhook': {
      post: {
        tags: ['Webhook'],
        summary: 'Process a payment webhook event',
        description:
          'Receives a payment gateway callback, validates amount, enforces status ' +
          'transitions, deduplicates by webhook_event_id, and updates order/ticket state.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookRequest' },
              examples: {
                valid_completion: {
                  summary: 'Valid payment completion',
                  value: {
                    payment_id: '2',
                    status: 'completed',
                    amount: 237,
                    webhook_event_id: 'evt_001',
                  },
                },
                amount_mismatch: {
                  summary: 'Amount mismatch (400)',
                  value: {
                    payment_id: '2',
                    status: 'completed',
                    amount: 100,
                    webhook_event_id: 'evt_002',
                  },
                },
                failed_payment: {
                  summary: 'Failed payment',
                  value: {
                    payment_id: '2',
                    status: 'failed',
                    amount: 237,
                    webhook_event_id: 'evt_003',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Webhook processed (or duplicate / ignored)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookResponse' },
              },
            },
          },
          400: {
            description: 'Amount mismatch',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Payment or order not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/seed': {
      post: {
        tags: ['Setup'],
        summary: 'Seed test data into the in-memory store',
        description:
          'Creates orders, payments, and tickets in one call. ' +
          'IDs are auto-incremented starting from 1.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SeedRequest' },
              example: {
                orders: [
                  { total_amount: 237, status: 'pending', payment_status: 'pending' },
                ],
                payments: [
                  { order_id: '1', amount: 237, status: 'pending' },
                ],
                tickets: [
                  { order_id: '1', status: 'held', unit_price: 79 },
                  { order_id: '1', status: 'held', unit_price: 79 },
                  { order_id: '1', status: 'held', unit_price: 79 },
                ],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Seeded records with assigned IDs',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SeedResponse' },
              },
            },
          },
        },
      },
    },
    '/reset': {
      post: {
        tags: ['Setup'],
        summary: 'Reset the in-memory store',
        description: 'Clears all collections and resets the auto-increment counter.',
        responses: {
          200: {
            description: 'Store reset',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'reset complete' } },
                },
              },
            },
          },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Lookup'],
        summary: 'Get an order by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: {
          200: {
            description: 'Order found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          404: {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/payments/{id}': {
      get: {
        tags: ['Lookup'],
        summary: 'Get a payment by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '2',
          },
        ],
        responses: {
          200: {
            description: 'Payment found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Payment' },
              },
            },
          },
          404: {
            description: 'Payment not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      WebhookRequest: {
        type: 'object',
        required: ['payment_id', 'status', 'amount', 'webhook_event_id'],
        properties: {
          payment_id: { type: 'string', description: 'ID of the payment record' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed'],
            description: 'New payment status from the gateway',
          },
          amount: { type: 'number', description: 'Payment amount (must match order total)' },
          webhook_event_id: {
            type: 'string',
            description: 'Unique event ID for idempotency',
          },
        },
      },
      WebhookResponse: {
        type: 'object',
        properties: {
          received: { type: 'boolean', example: true },
          payment_status: { type: 'string', example: 'completed' },
          duplicate: { type: 'boolean', description: 'True if this event was already processed' },
          ignored: { type: 'boolean', description: 'True if the status transition was invalid' },
          reason: { type: 'string', description: 'Reason for ignoring' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'payment not found' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          total_amount: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'] },
          payment_status: { type: 'string', enum: ['pending', 'processing', 'paid', 'failed'] },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          order_id: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
        },
      },
      SeedRequest: {
        type: 'object',
        properties: {
          orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          payments: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
          tickets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                order_id: { type: 'string' },
                status: { type: 'string' },
                unit_price: { type: 'number' },
              },
            },
          },
        },
      },
      SeedResponse: {
        type: 'object',
        properties: {
          orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          payments: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
          tickets: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};
