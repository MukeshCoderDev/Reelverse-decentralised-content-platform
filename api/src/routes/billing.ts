import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreditsService } from '../services/creditsService';
import { EscrowService } from '../services/escrowService';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { rateLimit } from '../middleware/rateLimit';
import { parseRateLimit } from '../utils/rateLimitParser';
import { idempotencyMiddleware } from '../middleware/idempotency'; // Import idempotencyMiddleware

const router = Router();
const creditsService = new CreditsService(env.CREDITS_DEFAULT_CURRENCY);
const escrowService = new EscrowService(env.CREDITS_DEFAULT_CURRENCY);

// Middleware to ensure user is authenticated and has an organization ID
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  // Assuming req.user is already populated by a preceding auth middleware (e.g., requirePrivyAuth)
  if (!req.user || !req.user.orgId) { // Use req.user.orgId as it's expected to be set by authPrivy
    return res.status(401).json({ error: 'Unauthorized: User not authenticated or missing organization ID.' });
  }
  next();
};

// Zod schemas for validation
const amountSchema = z.string().refine(val => {
  try {
    BigInt(val);
    return true;
  } catch {
    return false;
  }
}, { message: 'Amount must be a valid BigInt string.' });

const currencySchema = z.string().optional();
const userIdSchema = z.string().uuid();
const holdIdSchema = z.string().uuid();
const escrowIdSchema = z.string().uuid();

const creditBodySchema = z.object({
  amount: amountSchema,
  currency: currencySchema,
  txRef: z.string().optional(), // Add txRef for idempotency
});

const holdBodySchema = z.object({
  payeeId: userIdSchema,
  amount: amountSchema,
  reason: z.string().optional(),
  currency: currencySchema,
});

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreditsService } from '../services/creditsService';
import { EscrowService } from '../services/escrowService';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { rateLimit } from '../middleware/rateLimit';
import { parseRateLimit } from '../utils/rateLimitParser';

const router = Router();
const creditsService = new CreditsService(env.CREDITS_DEFAULT_CURRENCY);
const escrowService = new EscrowService(env.CREDITS_DEFAULT_CURRENCY);

// Extend Request to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      orgId: string;
    };
  }
}

// Middleware to ensure user is authenticated and has an organization ID
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for actual authentication logic
  req.user = { id: 'mockUserId', orgId: 'mockOrgId' }; // Mock user
  if (!req.user || !req.user.orgId) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated or missing organization ID.' });
  }
  next();
};

// Zod schemas for validation
const amountSchema = z.string().refine(val => {
  try {
    BigInt(val);
    return true;
  } catch {
    return false;
  }
}, { message: 'Amount must be a valid BigInt string.' });

const currencySchema = z.string().optional();
const userIdSchema = z.string().uuid();
const holdIdSchema = z.string().uuid();
const escrowIdSchema = z.string().uuid();

const creditBodySchema = z.object({
  amount: amountSchema,
  currency: currencySchema,
  txRef: z.string().optional(), // Add txRef for idempotency
});

const holdBodySchema = z.object({
  payeeId: userIdSchema,
  amount: amountSchema,
  reason: z.string().optional(),
  currency: currencySchema,
});

const escrowBodySchema = z.object({
  payeeId: userIdSchema,
  amount: amountSchema,
  currency: currencySchema,
  contentId: z.string().uuid().optional(),
});

// GET /api/billing/balance?currency
router.get('/balance', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.orgId;
    const currency = req.query.currency as string || env.CREDITS_DEFAULT_CURRENCY;
    const balance = await creditsService.getBalance(userId, currency);
    res.json({ userId, currency, balance: balance.toString() });
  } catch (error: any) {
    logger.error('Error fetching balance:', error);
    res.status(500).json({ error: 'failed_to_fetch_balance' });
  }
});

// POST /api/billing/credit { amount, currency?, txRef? }
router.post('/credit', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const { amount, currency, txRef } = creditBodySchema.parse(req.body);
    const userId = req.user!.orgId;

    await creditsService.addCredit(userId, BigInt(amount), currency, txRef);
    res.status(200).json({ message: 'Credit added successfully.' });
  } catch (error: any) {
    logger.error('Error adding credit:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    res.status(500).json({ error: 'failed_to_add_credit' });
  }
});

// POST /api/billing/hold { payeeId, amount, reason? }
router.post('/hold', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const { payeeId, amount, reason, currency } = holdBodySchema.parse(req.body);
    const payerId = req.user!.orgId;

    const { holdId } = await creditsService.transferWithHold(payerId, payeeId, BigInt(amount), currency, reason);
    res.status(201).json({ message: 'Hold created successfully.', holdId });
  } catch (error: any) {
    logger.error('Error creating hold:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    if (error.message === 'Insufficient funds for hold.') {
      return res.status(400).json({ error: 'insufficient_funds', message: error.message });
    }
    res.status(500).json({ error: 'failed_to_create_hold' });
  }
});

// POST /api/billing/hold/:id/release
router.post('/hold/:id/release', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const holdId = holdIdSchema.parse(req.params.id);
    // In a real app, you'd verify req.user.orgId is related to this hold
    await creditsService.releaseHold(holdId);
    res.status(200).json({ message: 'Hold released successfully.' });
  } catch (error: any) {
    logger.error(`Error releasing hold ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    if (error.message.includes('Hold not found')) {
      return res.status(404).json({ error: 'hold_not_found', message: error.message });
    }
    if (error.message.includes('not in \'pending\' status')) {
      return res.status(400).json({ error: 'invalid_hold_status', message: error.message });
    }
    res.status(500).json({ error: 'failed_to_release_hold' });
  }
});

// POST /api/billing/hold/:id/void
router.post('/hold/:id/void', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const holdId = holdIdSchema.parse(req.params.id);
    // In a real app, you'd verify req.user.orgId is related to this hold
    await creditsService.voidHold(holdId);
    res.status(200).json({ message: 'Hold voided successfully, funds returned.' });
  } catch (error: any) {
    logger.error(`Error voiding hold ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    if (error.message.includes('Hold not found')) {
      return res.status(404).json({ error: 'hold_not_found', message: error.message });
    }
    if (error.message.includes('not in \'pending\' status')) {
      return res.status(400).json({ error: 'invalid_hold_status', message: error.message });
    }
    res.status(500).json({ error: 'failed_to_void_hold' });
  }
});

// POST /api/billing/escrow { payeeId, amount, contentId? }
router.post('/escrow', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const { payeeId, amount, currency, contentId } = escrowBodySchema.parse(req.body);
    const payerId = req.user!.orgId;

    const { escrowId } = await escrowService.open({
      payerId,
      payeeId,
      amount: BigInt(amount),
      currency,
      contentId,
    });
    res.status(201).json({ message: 'Escrow opened successfully.', escrowId });
  } catch (error: any) {
    logger.error('Error opening escrow:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    res.status(500).json({ error: 'failed_to_open_escrow' });
  }
});

// POST /api/billing/escrow/:id/release
router.post('/escrow/:id/release', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const escrowId = escrowIdSchema.parse(req.params.id);
    // In a real app, you'd verify req.user.orgId is related to this escrow (e.g., is payee)
    await escrowService.release(escrowId);
    res.status(200).json({ message: 'Escrow released successfully.' });
  } catch (error: any) {
    logger.error(`Error releasing escrow ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    if (error.message.includes('Escrow not found')) {
      return res.status(404).json({ error: 'escrow_not_found', message: error.message });
    }
    if (error.message.includes('not in \'open\' status')) {
      return res.status(400).json({ error: 'invalid_escrow_status', message: error.message });
    }
    res.status(500).json({ error: 'failed_to_release_escrow' });
  }
});

// POST /api/billing/escrow/:id/refund
router.post('/escrow/:id/refund', authenticateUser, rateLimit(parseRateLimit(env.RATE_LIMIT_BILLING)), async (req: Request, res: Response) => {
  try {
    const escrowId = escrowIdSchema.parse(req.params.id);
    // In a real app, you'd verify req.user.orgId is related to this escrow (e.g., is payer)
    await escrowService.refund(escrowId);
    res.status(200).json({ message: 'Escrow refunded successfully.' });
  } catch (error: any) {
    logger.error(`Error refunding escrow ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', details: error.errors });
    }
    if (error.message.includes('Escrow not found')) {
      return res.status(404).json({ error: 'escrow_not_found', message: error.message });
    }
    if (error.message.includes('not in \'open\' status')) {
      return res.status(400).json({ error: 'invalid_escrow_status', message: error.message });
    }
    res.status(500).json({ error: 'failed_to_refund_escrow' });
  }
});

export default router;