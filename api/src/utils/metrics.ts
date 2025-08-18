import * as client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const holdsCreated = new client.Counter({ name: 'paymaster_holds_total', help: 'Total holds created' });
export const holdsExpired = new client.Counter({ name: 'paymaster_holds_expired_total', help: 'Total holds expired' });
export const settleDebits = new client.Counter({ name: 'paymaster_settles_total', help: 'Total settle debits' });
export const rateLimitHits = new client.Counter({ name: 'paymaster_rate_limit_hits_total', help: 'Rate limit hits' });
export const idempotencyPersistenceFailures = new client.Counter({ name: 'paymaster_idempotency_persistence_failures_total', help: 'Idempotency persistence failures' });
export const missedRelease = new client.Counter({ name: 'paymaster_missed_release_total', help: 'Missed redis lock releases' });
export const preauthRejects = new client.Counter({ name: 'paymaster_preauth_reject_total', help: 'Preauth rejects by reason' });

export const preauthLatency = new client.Histogram({ name: 'paymaster_preauth_latency_ms', help: 'Preauth latency in ms', buckets: [10,50,100,250,500,1000,2000] });
export const settleLatency = new client.Histogram({ name: 'paymaster_settle_latency_ms', help: 'Settle latency in ms', buckets: [10,50,100,250,500,1000,2000] });

register.registerMetric(holdsCreated);
register.registerMetric(holdsExpired);
register.registerMetric(settleDebits);
register.registerMetric(rateLimitHits);
register.registerMetric(idempotencyPersistenceFailures);
register.registerMetric(preauthLatency);
register.registerMetric(settleLatency);
register.registerMetric(missedRelease);
register.registerMetric(preauthRejects);

// Helper: increment counter optionally with labels
export function incCounter(counter: client.Counter, value: number = 1, labels?: Record<string,string>){
	try {
		if (labels && Object.keys(labels).length > 0) counter.inc(labels, value);
		else counter.inc(value);
	} catch (e) {
		// best-effort
	}
}

export default register;
