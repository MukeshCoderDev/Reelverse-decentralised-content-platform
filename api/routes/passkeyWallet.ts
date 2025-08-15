import express from 'express';
import { PasskeyWalletService } from '../../services/passkeyWalletService';

const router = express.Router();

// Middleware for authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Create passkey wallet
 * POST /api/passkey-wallet/create
 */
router.post('/create', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const result = await passkeyService.createPasskeyWallet(email);

    if (result.success) {
      res.json({
        success: true,
        walletAddress: result.walletAddress,
        credentialId: result.credentialId,
        creationTime: result.creationTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error creating passkey wallet:', error);
    res.status(500).json({ 
      error: 'Failed to create passkey wallet',
      details: error.message 
    });
  }
});

/**
 * Authenticate with passkey
 * POST /api/passkey-wallet/authenticate
 */
router.post('/authenticate', async (req, res) => {
  try {
    const { email, challenge } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const result = await passkeyService.authenticateWithPasskey(email, challenge);

    if (result.success) {
      res.json({
        success: true,
        walletAddress: result.walletAddress,
        signature: result.signature
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error authenticating with passkey:', error);
    res.status(500).json({ 
      error: 'Failed to authenticate with passkey',
      details: error.message 
    });
  }
});

/**
 * Sign transaction with passkey
 * POST /api/passkey-wallet/sign-transaction
 */
router.post('/sign-transaction', requireAuth, async (req, res) => {
  try {
    const { email, transaction } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    if (!transaction) {
      return res.status(400).json({ error: 'Transaction data is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const result = await passkeyService.signTransactionWithPasskey(email, transaction);

    if (result.success) {
      res.json({
        success: true,
        signature: result.signature
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error signing transaction with passkey:', error);
    res.status(500).json({ 
      error: 'Failed to sign transaction with passkey',
      details: error.message 
    });
  }
});

/**
 * List user credentials
 * GET /api/passkey-wallet/credentials/:email
 */
router.get('/credentials/:email', requireAuth, async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const credentials = await passkeyService.listUserCredentials(email);

    res.json({
      success: true,
      credentials
    });

  } catch (error) {
    console.error('Error listing user credentials:', error);
    res.status(500).json({ 
      error: 'Failed to list user credentials',
      details: error.message 
    });
  }
});

/**
 * Delete passkey credential
 * DELETE /api/passkey-wallet/credentials/:email
 */
router.delete('/credentials/:email', requireAuth, async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const deleted = await passkeyService.deletePasskeyCredential(email);

    if (deleted) {
      res.json({
        success: true,
        message: 'Passkey credential deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to delete passkey credential'
      });
    }

  } catch (error) {
    console.error('Error deleting passkey credential:', error);
    res.status(500).json({ 
      error: 'Failed to delete passkey credential',
      details: error.message 
    });
  }
});

/**
 * Get wallet statistics (admin only)
 * GET /api/passkey-wallet/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const stats = await passkeyService.getWalletStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting wallet stats:', error);
    res.status(500).json({ 
      error: 'Failed to get wallet stats',
      details: error.message 
    });
  }
});

/**
 * Check passkey support
 * GET /api/passkey-wallet/support-check
 */
router.get('/support-check', async (req, res) => {
  try {
    // This endpoint returns information about passkey support
    // The actual check happens on the client side
    
    res.json({
      success: true,
      supported: true, // Server can't check this, client must verify
      requirements: {
        webauthn: 'WebAuthn API support required',
        platform: 'Platform authenticator (Face ID, Touch ID, Windows Hello)',
        browser: 'Modern browser (Chrome 67+, Safari 14+, Firefox 60+)',
        https: 'HTTPS connection required'
      },
      benefits: [
        'No seed phrases to remember',
        'Biometric security',
        'Faster authentication',
        'Gasless transactions',
        'Cross-device sync (with platform support)'
      ]
    });

  } catch (error) {
    console.error('Error checking passkey support:', error);
    res.status(500).json({ 
      error: 'Failed to check passkey support',
      details: error.message 
    });
  }
});

/**
 * Generate authentication challenge
 * POST /api/passkey-wallet/challenge
 */
router.post('/challenge', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Generate a random challenge for authentication
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // In production, store this challenge temporarily with expiration
    // For now, just return it
    
    res.json({
      success: true,
      challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    });

  } catch (error) {
    console.error('Error generating authentication challenge:', error);
    res.status(500).json({ 
      error: 'Failed to generate authentication challenge',
      details: error.message 
    });
  }
});

/**
 * Validate wallet address
 * POST /api/passkey-wallet/validate-address
 */
router.post('/validate-address', async (req, res) => {
  try {
    const { email, walletAddress } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid wallet address is required' });
    }

    const passkeyService: PasskeyWalletService = req.app.get('passkeyWalletService');
    
    const credentials = await passkeyService.listUserCredentials(email);
    const isValid = credentials.some(cred => cred.walletAddress === walletAddress);

    res.json({
      success: true,
      isValid,
      message: isValid ? 'Wallet address is valid for this email' : 'Wallet address not found for this email'
    });

  } catch (error) {
    console.error('Error validating wallet address:', error);
    res.status(500).json({ 
      error: 'Failed to validate wallet address',
      details: error.message 
    });
  }
});

/**
 * Health check for passkey service
 * GET /api/passkey-wallet/health
 */
router.get('/health', async (req, res) => {
  try {
    // Basic health check - in production this might check database connectivity
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        creation: true,
        authentication: true,
        signing: true,
        deletion: true
      }
    };

    res.json({
      success: true,
      health
    });

  } catch (error) {
    console.error('Passkey service health check failed:', error);
    res.status(503).json({ 
      success: false,
      error: 'Service unhealthy',
      details: error.message 
    });
  }
});

export default router;