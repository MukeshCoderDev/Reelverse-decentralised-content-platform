const assert = require('assert');
const fetch = require('node-fetch');

// NOTE: This is a smoke test skeleton. Do not run until DB/Redis are available.
// It assumes the test environment runs the API on http://localhost:3001 and
// docker-compose.test.yml is up. Set PAYMASTER_HMAC_SECRET and IDEMPOTENCY_STRICT

const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const HMAC = process.env.PAYMASTER_HMAC_SECRET || 'test-secret';

function hmac(canonical){
  const crypto = require('crypto');
  return crypto.createHmac('sha256', HMAC).update(canonical).digest('hex');
}

async function preauth(idempotencyKey, body){
  const canonical = `${body.method||''}|${body.paramsHash||''}|${body.estGasWei}|${body.maxFeePerGasWei||''}|${body.maxPriorityFeePerGasWei||''}|${body.expiresAt||''}|${body.orgId}`;
  const signature = hmac(canonical);
  const res = await fetch(`${API}/paymaster/preauth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Signature': signature
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function settle(idempotencyKey, body){
  const canonical = `${body.paramsHash||''}|${body.approvalId}|${body.gasUsedWei}|${body.effectiveGasPriceWei}`;
  const signature = hmac(canonical);
  const res = await fetch(`${API}/paymaster/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Signature': signature
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

module.exports = {
  preauth,
  settle
};

// Example tests (commented):
// describe('Paymaster idempotency and lock behavior', () => {
//   it('persists idempotency before creating hold (strict)', async () => {
//     const id = 'test-key-1';
//     const res = await preauth(id, { orgId: 'org-test', holdId: 'hold-1', estGasWei: '1000000' });
//     assert.strictEqual(res.status, 200);
//     // subsequent replay should return same body/status
//     const replay = await preauth(id, { orgId: 'org-test', holdId: 'hold-1', estGasWei: '1000000' });
//     assert.strictEqual(replay.status, 200);
//     assert.deepStrictEqual(replay.body, res.body);
//   });
// });
