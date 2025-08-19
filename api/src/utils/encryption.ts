import * as crypto from 'crypto';
import { env } from '../config/env';
import { logger } from './logger';

class EncryptionService {
  private masterKey: Buffer;

  constructor() {
    if (!env.SMART_ACCOUNT_MASTER_KEY) {
      logger.error('SMART_ACCOUNT_MASTER_KEY environment variable is not configured.');
      throw new Error('SMART_ACCOUNT_MASTER_KEY environment variable is not configured.');
    }
    this.masterKey = Buffer.from(env.SMART_ACCOUNT_MASTER_KEY, 'hex');
    if (this.masterKey.length !== 32) {
      logger.error('SMART_ACCOUNT_MASTER_KEY must be a 32-byte (64-character) hex string.');
      throw new Error('SMART_ACCOUNT_MASTER_KEY must be a 32-byte (64-character) hex string.');
    }
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12); // GCM recommended IV length
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decrypt(encHex: string): string {
    const data = Buffer.from(encHex, 'hex');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  }
}

export const encryptionService = new EncryptionService();