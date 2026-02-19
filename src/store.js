let _nextId = 1;

export const db = {
  orders: [],
  payments: [],
  tickets: [],
  webhookLogs: [],

  create(collection, data) {
    const id = String(_nextId++);
    const record = { id, ...data };
    this[collection].push(record);
    return record;
  },

  findById(collection, id) {
    return this[collection].find((r) => r.id === String(id));
  },

  findOne(collection, predicate) {
    return this[collection].find(predicate);
  },

  filter(collection, predicate) {
    return this[collection].filter(predicate);
  },

  reset() {
    this.orders.length = 0;
    this.payments.length = 0;
    this.tickets.length = 0;
    this.webhookLogs.length = 0;
    _nextId = 1;
  },
};
