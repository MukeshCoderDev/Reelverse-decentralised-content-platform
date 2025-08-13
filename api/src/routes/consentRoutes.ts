import { Router, Request, Response } from 'express';
import { consentService, ConsentData, SceneParticipant } from '../services/consentService';
import { authenticateWallet } from '../middleware/auth';

const router = Router();

/**
 * Create scene with participants
 * POST /api/consent/scene
 */
router.post('/scene', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { title, description, participants, createdAt } = req.body;
    const creatorWallet = (req as any).walletAddress;

    if (!title || !description || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        code: 'CONSENT_001',
        message: 'Missing required fields: title, description, participants',
        timestamp: Date.now()
      });
    }

    const sceneHash = consentService.generateSceneHash({
      title,
      description,
      participants,
      createdAt: createdAt || Date.now()
    });

    // Create scene in database
    await consentService.createScene(
      sceneHash,
      title,
      description,
      creatorWallet,
      participants
    );

    res.json({
      sceneHash,
      participants: participants.map((p: any) => ({
        wallet: p.wallet,
        role: p.role,
        consented: false
      }))
    });
  } catch (error) {
    console.error('Scene creation error:', error);
    res.status(500).json({
      code: 'CONSENT_002',
      message: 'Failed to create scene',
      timestamp: Date.now()
    });
  }
});

/**
 * Generate scene hash for content (legacy endpoint)
 * POST /api/consent/scene-hash
 */
router.post('/scene-hash', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { title, description, participants, createdAt } = req.body;

    if (!title || !description || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        code: 'CONSENT_001',
        message: 'Missing required fields: title, description, participants',
        timestamp: Date.now()
      });
    }

    const sceneHash = consentService.generateSceneHash({
      title,
      description,
      participants,
      createdAt: createdAt || Date.now()
    });

    res.json({
      sceneHash,
      participants: participants.map((p: any) => ({
        wallet: p.wallet,
        role: p.role,
        consented: false
      }))
    });
  } catch (error) {
    console.error('Scene hash generation error:', error);
    res.status(500).json({
      code: 'CONSENT_002',
      message: 'Failed to generate scene hash',
      timestamp: Date.now()
    });
  }
});

/**
 * Create consent message for EIP-712 signing
 * POST /api/consent/message
 */
router.post('/message', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { sceneHash, role, documentHashes } = req.body;
    const participantWallet = (req as any).walletAddress;

    if (!sceneHash || !role || !participantWallet) {
      return res.status(400).json({
        code: 'CONSENT_003',
        message: 'Missing required fields: sceneHash, role',
        timestamp: Date.now()
      });
    }

    const consentData: ConsentData = {
      sceneHash,
      participant: participantWallet,
      role,
      consentDate: Math.floor(Date.now() / 1000),
      termsVersion: '1.0',
      documentHashes: documentHashes || []
    };

    const message = consentService.createConsentMessage(consentData);

    res.json({
      message,
      consentData
    });
  } catch (error) {
    console.error('Consent message creation error:', error);
    res.status(500).json({
      code: 'CONSENT_004',
      message: 'Failed to create consent message',
      timestamp: Date.now()
    });
  }
});

/**
 * Submit signed consent
 * POST /api/consent/submit
 */
router.post('/submit', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { consentData, signature } = req.body;
    const participantWallet = (req as any).walletAddress;

    if (!consentData || !signature) {
      return res.status(400).json({
        code: 'CONSENT_005',
        message: 'Missing required fields: consentData, signature',
        timestamp: Date.now()
      });
    }

    // Verify the participant matches the authenticated wallet
    if (consentData.participant.toLowerCase() !== participantWallet.toLowerCase()) {
      return res.status(403).json({
        code: 'CONSENT_006',
        message: 'Participant wallet does not match authenticated wallet',
        timestamp: Date.now()
      });
    }

    const storedConsent = await consentService.storeConsentSignature(
      consentData.sceneHash,
      consentData,
      signature
    );

    res.json({
      success: true,
      consentId: `${consentData.sceneHash}:${participantWallet}`,
      timestamp: storedConsent.timestamp
    });
  } catch (error) {
    console.error('Consent submission error:', error);
    
    if (error instanceof Error && error.message === 'Invalid consent signature') {
      return res.status(400).json({
        code: 'CONSENT_007',
        message: 'Invalid consent signature',
        timestamp: Date.now()
      });
    }

    res.status(500).json({
      code: 'CONSENT_008',
      message: 'Failed to store consent',
      timestamp: Date.now()
    });
  }
});

/**
 * Check consent status for a scene
 * GET /api/consent/status/:sceneHash
 */
router.get('/status/:sceneHash', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { sceneHash } = req.params;
    const { participants } = req.query;

    if (!participants) {
      return res.status(400).json({
        code: 'CONSENT_009',
        message: 'Missing participants query parameter',
        timestamp: Date.now()
      });
    }

    const requiredParticipants: SceneParticipant[] = JSON.parse(participants as string);
    const validation = await consentService.validateSceneConsent(sceneHash, requiredParticipants);

    res.json({
      sceneHash,
      complete: validation.complete,
      totalRequired: requiredParticipants.length,
      totalConsented: validation.consents.length,
      missing: validation.missing,
      completionRate: validation.consents.length / requiredParticipants.length
    });
  } catch (error) {
    console.error('Consent status check error:', error);
    res.status(500).json({
      code: 'CONSENT_010',
      message: 'Failed to check consent status',
      timestamp: Date.now()
    });
  }
});

/**
 * Generate consent report for legal compliance
 * GET /api/consent/report/:sceneHash
 */
router.get('/report/:sceneHash', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { sceneHash } = req.params;
    const report = await consentService.generateConsentReport(sceneHash);

    res.json(report);
  } catch (error) {
    console.error('Consent report generation error:', error);
    res.status(500).json({
      code: 'CONSENT_011',
      message: 'Failed to generate consent report',
      timestamp: Date.now()
    });
  }
});

/**
 * Revoke consent (for compliance)
 * POST /api/consent/revoke
 */
router.post('/revoke', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { sceneHash, reason } = req.body;
    const participantWallet = (req as any).walletAddress;

    if (!sceneHash) {
      return res.status(400).json({
        code: 'CONSENT_012',
        message: 'Missing required field: sceneHash',
        timestamp: Date.now()
      });
    }

    await consentService.revokeConsent(
      sceneHash,
      participantWallet,
      reason || 'Consent withdrawn by participant',
      participantWallet
    );
    
    res.json({
      success: true,
      message: 'Consent revoked successfully',
      sceneHash,
      participant: participantWallet,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Consent revocation error:', error);
    res.status(500).json({
      code: 'CONSENT_013',
      message: 'Failed to revoke consent',
      timestamp: Date.now()
    });
  }
});

export default router;