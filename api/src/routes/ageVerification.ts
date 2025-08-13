import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AgeVerificationService } from '../services/ageVerificationService';
import Joi from 'joi';

const router = Router();
const ageVerificationService = AgeVerificationService.getInstance();

// Validation schemas
const startVerificationSchema = Joi.object({
  address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  referenceId: Joi.string().optional()
});

const statusSchema = Joi.object({
  address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

const sbtMintedSchema = Joi.object({
  address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  tokenId: Joi.string().required()
});

// Get age verification status for an address
router.get('/status/:address', asyncHandler(async (req, res) => {
  const { error, value } = statusSchema.validate({ address: req.params.address });
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid address format'
    });
  }

  const status = await ageVerificationService.getVerificationStatus(value.address);
  
  res.json({
    success: true,
    data: status
  });
}));

// Start age verification process
router.post('/start', asyncHandler(async (req, res) => {
  const { error, value } = startVerificationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  try {
    const result = await ageVerificationService.startVerification(
      value.address,
      value.referenceId
    );

    res.json({
      success: true,
      data: {
        inquiryId: result.inquiryId,
        verificationUrl: result.url,
        provider: 'persona'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start verification process'
    });
  }
}));

// Check if address is eligible for SBT minting
router.get('/sbt-eligible/:address', asyncHandler(async (req, res) => {
  const { error, value } = statusSchema.validate({ address: req.params.address });
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid address format'
    });
  }

  const isEligible = await ageVerificationService.isEligibleForSBT(value.address);
  
  res.json({
    success: true,
    data: {
      eligible: isEligible,
      address: value.address
    }
  });
}));

// Mark SBT as minted (called by smart contract service)
router.post('/sbt-minted', asyncHandler(async (req, res) => {
  const { error, value } = sbtMintedSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  await ageVerificationService.markSBTMinted(value.address, value.tokenId);
  
  res.json({
    success: true,
    message: 'SBT minting recorded successfully'
  });
}));

export default router;