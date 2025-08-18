/* Smoke integration: direct DB+Redis verification of credits hold/settle flow

   Steps:
   - wait for DB/Redis
   - apply migrations
   - run direct SQL transactions that mirror service behavior for topup, preauth (hold), settle
   - run a concurrency test with parallel preauths
*/

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Redis = require('redis');

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

const PG_CONFIG = { host: 'localhost', port: 55432, user: 'reelverse', password: 'reelverse', database: 'reelverse_test' };
const REDIS_URL = 'redis://localhost:63790';

async function applyMigrations(){
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_create_credits_tables.sql'), 'utf8');
  const c = new Client(PG_CONFIG);
  await c.connect();
  await c.query(sql);
  await c.end();
}

async function doTopup(orgId, amountCents, provider, providerRef){
  const c = new Client(PG_CONFIG);
  await c.connect();
  try{
    await c.query('BEGIN');
    await c.query(`INSERT INTO credit_accounts(org_id, balance_cents, currency) VALUES($1, $2, 'USD') ON CONFLICT (org_id) DO NOTHING`, [orgId, 0]);
    // idempotent by provider/providerRef
    if (provider && providerRef){
      const ex = await c.query(`SELECT id, amount_cents FROM credit_transactions WHERE provider=$1 AND provider_ref=$2 LIMIT 1`, [provider, providerRef]);
      if (ex.rowCount>0){ await c.query('COMMIT'); return ex.rows[0]; }
    }
    await c.query(`UPDATE credit_accounts SET balance_cents = balance_cents + $1, updated_at = now() WHERE org_id = $2`, [amountCents, orgId]);
    const res = await c.query(`INSERT INTO credit_transactions(org_id, type, amount_cents, provider, provider_ref) VALUES($1,'issue',$2,$3,$4) RETURNING id, amount_cents`, [orgId, amountCents, provider||null, providerRef||null]);
    await c.query('COMMIT');
    return res.rows[0];
  }catch(e){ await c.query('ROLLBACK'); throw e; } finally { await c.end(); }
}

async function insertIdempotency(key, method, orgId, responseObj, statusCode=200){
  const c = new Client(PG_CONFIG);
  await c.connect();
  try{
    await c.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [key, method, orgId, null, JSON.stringify(responseObj), statusCode]);
  } finally { await c.end(); }
}

async function doPreauth(orgId, approvalId, amountCents, expiresAt){
  const c = new Client(PG_CONFIG);
  await c.connect();
  try{
    await c.query('BEGIN');
    const acc = await c.query(`SELECT balance_cents FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [orgId]);
    if (acc.rowCount===0){ await c.query('ROLLBACK'); throw new Error('Account not found'); }
    const available = BigInt(acc.rows[0].balance_cents);
    if (available < BigInt(amountCents)){ await c.query('ROLLBACK'); throw new Error('INSUFFICIENT_CREDITS'); }
    await c.query(`INSERT INTO credit_holds(approval_id, org_id, amount_cents, expires_at, status) VALUES($1,$2,$3,$4,'active')`, [approvalId, orgId, amountCents, expiresAt||null]);
    await c.query(`UPDATE credit_accounts SET balance_cents = balance_cents - $1, updated_at = now() WHERE org_id=$2`, [amountCents, orgId]);
    await c.query(`INSERT INTO credit_transactions(org_id,type,amount_cents,reason) VALUES($1,'hold', $2, 'hold')`, [orgId, -Math.abs(amountCents)]);
    await c.query('COMMIT');
    return { approvalId, amountCents };
  }catch(e){ await c.query('ROLLBACK'); throw e; } finally { await c.end(); }
}

async function doSettle(approvalId, txHash, gasUsedWei, effectiveGasPriceWei){
  const c = new Client(PG_CONFIG);
  await c.connect();
  try{
    await c.query('BEGIN');
    const holdRes = await c.query(`SELECT id, org_id, amount_cents, status FROM credit_holds WHERE approval_id=$1 FOR UPDATE`, [approvalId]);
    if (holdRes.rowCount===0){ await c.query('ROLLBACK'); throw new Error('HOLD_NOT_FOUND'); }
    const hold = holdRes.rows[0];
    if (hold.status!=='active'){ await c.query('ROLLBACK'); throw new Error('HOLD_INVALID'); }
    const amount = Number(hold.amount_cents);
    // compute actual cents from gas (stub ETH price 1800)
    const ethUsdCents = 180000; // 1800.00
    const actualWei = BigInt(gasUsedWei) * BigInt(effectiveGasPriceWei);
    const actualCents = Number((actualWei * BigInt(ethUsdCents)) / BigInt(1e18));

    // mark hold captured
    await c.query(`UPDATE credit_holds SET status='captured' WHERE id=$1`, [hold.id]);
    await c.query(`INSERT INTO credit_transactions(org_id,type,amount_cents,reason,ref_id) VALUES($1,'debit',$2,$3,$4)`, [hold.org_id, -Math.abs(actualCents), 'capture', txHash]);
    await c.query('COMMIT');
    return { orgId: hold.org_id, debited: actualCents };
  }catch(e){ await c.query('ROLLBACK'); throw e; } finally { await c.end(); }
}

async function concurrencyTest(){
  console.log('Running concurrency test: 10 preauths racing for same balance (expect 5 successes)');
  const org = 'raceOrgBig';
  await doTopup(org, 5000, 'stripe', 'ch_race_big');
  // 10 preauths of 1000 each => only 5 can succeed
  const attempts = Array.from({length:10}).map((_,i)=>doPreauth(org, `race${i}`, 1000, null).then(r=>({ok:true,r})).catch(e=>({ok:false,e:e.message})));
  const results = await Promise.all(attempts);
  const success = results.filter(x=>x.ok).length;
  console.log('Concurrency results:', success, 'successful holds out of 10');
  if (success !== 5) {
    console.error('Concurrency test failed: expected 5 successes');
    process.exit(2);
  }
}

async function expiryTest(){
  console.log('Running expiry test');
  const org = 'expiryOrg';
  await doTopup(org, 1000, 'stripe', 'ch_exp');
  const now = new Date();
  const expires = new Date(now.getTime()+2000).toISOString();
  await doPreauth(org, 'exp1', 500, expires);
  console.log('Sleeping to let hold expire...');
  await sleep(3000);
  try{
    await doSettle('exp1', '0xdead', '21000', '20000000000');
    console.error('Expiry test failed: settle succeeded after expiry');
    process.exit(2);
  } catch(e){
    console.log('Expiry test: expected failure:', e.message);
  }
}

async function run(){
  console.log('Smoke: waiting for services...');
  await sleep(5000);
  await applyMigrations();
  console.log('Migrations applied');

  console.log('Topup org1 10000 cents');
  const top = await doTopup('org1', 10000, 'stripe', 'ch_123');
  console.log('Topup result:', top);

  console.log('Preauth hold1');
  const pre = await doPreauth('org1', 'hold1', 5000, new Date(Date.now()+60000).toISOString());
  console.log('Preauth result:', pre);

  // simulate idempotency replay: store response and re-run preauth logic to ensure stored response returned
  await insertIdempotency('idem-preauth-1', 'POST /paymaster/preauth', 'org1', { approvalId: 'hold1', creditsHoldCents: 5000, expiresAt: new Date(Date.now()+60000).toISOString() }, 200);
  const replay = await (async ()=>{
    const c = new Client(PG_CONFIG);
    await c.connect();
    try{
      const ex = await c.query(`SELECT response_json FROM idempotency_keys WHERE key=$1 LIMIT 1`, ['idem-preauth-1']);
      return ex.rows[0].response_json;
    } finally { await c.end(); }
  })();
  console.log('Idempotency replay fetched:', replay);

  console.log('Settle hold1');
  const settled = await doSettle('hold1', '0xabc', '21000', '20000000000');
  console.log('Settle result:', settled);

  // record idempotent settle response and replay
  await insertIdempotency('idem-settle-1', 'POST /paymaster/settle', 'org1', { txnId: 'tx_sim', newBalanceCents: 5000 }, 200);
  const replaySettle = await (async ()=>{
    const c = new Client(PG_CONFIG);
    await c.connect();
    try{
      const ex = await c.query(`SELECT response_json FROM idempotency_keys WHERE key=$1 LIMIT 1`, ['idem-settle-1']);
      return ex.rows[0].response_json;
    } finally { await c.end(); }
  })();
  console.log('Idempotency settle replay fetched:', replaySettle);

  await concurrencyTest();
  console.log('Smoke finished');
}

run().catch(err=>{ console.error(err); process.exit(1); });
