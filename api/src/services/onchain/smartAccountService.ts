import * as crypto from 'crypto';
import { getDatabase } from '../../config/database';

const MASTER_KEY = process.env.SMART_ACCOUNT_MASTER_KEY || '';
if (!MASTER_KEY) {
  // Not throwing at module load to allow environments without master key during dev.
}

export class SmartAccountService {
  masterKey: Buffer | null;
  constructor() {
    this.masterKey = MASTER_KEY ? Buffer.from(MASTER_KEY, 'hex') : null;
  }

  encryptPrivateKey(plain: string) {
    if (!this.masterKey) throw new Error('SMART_ACCOUNT_MASTER_KEY not configured');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decryptPrivateKey(encHex: string) {
    if (!this.masterKey) throw new Error('SMART_ACCOUNT_MASTER_KEY not configured');
    const data = Buffer.from(encHex, 'hex');
    const iv = data.slice(0,12);
    const tag = data.slice(12,28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  }

  async createSmartAccount(orgId: string, privateKey: string, address: string) {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const enc = this.encryptPrivateKey(privateKey);
      await client.query(`INSERT INTO smart_accounts(org_id, address, encrypted_private_key) VALUES($1,$2,$3) ON CONFLICT (org_id) DO UPDATE SET address = EXCLUDED.address, encrypted_private_key = EXCLUDED.encrypted_private_key`, [orgId, address, enc]);
    } finally {
      client.release();
    }
  }

  async getPrivateKeyForOrg(orgId: string): Promise<string | null> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const res = await client.query(`SELECT encrypted_private_key FROM smart_accounts WHERE org_id=$1 LIMIT 1`, [orgId]);
      if (res.rowCount === 0) return null;
      return this.decryptPrivateKey(res.rows[0].encrypted_private_key);
    } finally { client.release(); }
  }
}

export default new SmartAccountService();
