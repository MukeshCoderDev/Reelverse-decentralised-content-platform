import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const holdsCreated = new client.Counter({ name: 'holds_created_total', help: 'Total holds created' });
export const holdsExpired = new client.Counter({ name: 'holds_expired_total', help: 'Total holds expired' });
export const settleDebits = new client.Counter({ name: 'settle_debits_total', help: 'Total settle debits' });
export const rateLimitHits = new client.Counter({ name: 'rate_limit_hits_total', help: 'Rate limit hits' });

register.registerMetric(holdsCreated);
register.registerMetric(holdsExpired);
register.registerMetric(settleDebits);
register.registerMetric(rateLimitHits);

export default register;
