import express from 'express';
import { FeatureFlag, FeatureFlagContext } from '../../src/lib/featureFlags';

const router = express.Router();

// In-memory storage for demo - in production, use database
let featureFlags: Map<string, FeatureFlag> = new Map();

// Middleware to check admin permissions
const requireAdmin = (req: any, res: any, next: any) => {
  // In production, implement proper admin authentication
  const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all feature flags (public endpoint for client)
router.get('/', async (req, res) => {
  try {
    const context: FeatureFlagContext = {
      userId: req.query.userId as string,
      walletAddress: req.query.walletAddress as string,
      organizationId: req.query.organizationId as string,
      country: req.query.country as string,
      userSegment: req.query.userSegment as string,
      isVerified: req.query.isVerified === 'true',
      isTalentVerified: req.query.isTalentVerified === 'true'
    };

    // Return only enabled flags with evaluated values
    const enabledFlags: Record<string, any> = {};
    
    for (const [key, flag] of featureFlags) {
      if (flag.enabled && evaluateFlag(flag, context)) {
        enabledFlags[key] = flag.value;
      }
    }

    res.json(enabledFlags);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific feature flag
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const flag = featureFlags.get(key);
    
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const context: FeatureFlagContext = {
      userId: req.query.userId as string,
      walletAddress: req.query.walletAddress as string,
      organizationId: req.query.organizationId as string,
      country: req.query.country as string,
      userSegment: req.query.userSegment as string,
      isVerified: req.query.isVerified === 'true',
      isTalentVerified: req.query.isTalentVerified === 'true'
    };

    const isEnabled = flag.enabled && evaluateFlag(flag, context);
    
    res.json({
      key: flag.key,
      enabled: isEnabled,
      value: isEnabled ? flag.value : null
    });
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints
router.get('/admin/flags', requireAdmin, async (req, res) => {
  try {
    const flags = Array.from(featureFlags.values());
    res.json(flags);
  } catch (error) {
    console.error('Error fetching admin flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/flags', requireAdmin, async (req, res) => {
  try {
    const flag: FeatureFlag = {
      ...req.body,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Validate flag
    if (!flag.key || !flag.name || !flag.description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (featureFlags.has(flag.key)) {
      return res.status(409).json({ error: 'Feature flag already exists' });
    }

    featureFlags.set(flag.key, flag);
    
    // In production, save to database
    await saveToDatabase();
    
    res.status(201).json(flag);
  } catch (error) {
    console.error('Error creating feature flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/flags/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const existingFlag = featureFlags.get(key);
    
    if (!existingFlag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...req.body,
      key, // Don't allow key changes
      updatedAt: Date.now()
    };

    featureFlags.set(key, updatedFlag);
    
    // In production, save to database
    await saveToDatabase();
    
    res.json(updatedFlag);
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/flags/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!featureFlags.has(key)) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    featureFlags.delete(key);
    
    // In production, save to database
    await saveToDatabase();
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle flag enabled status
router.patch('/admin/flags/:key/toggle', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const flag = featureFlags.get(key);
    
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const updatedFlag = {
      ...flag,
      enabled: !flag.enabled,
      updatedAt: Date.now()
    };

    featureFlags.set(key, updatedFlag);
    
    // In production, save to database
    await saveToDatabase();
    
    res.json(updatedFlag);
  } catch (error) {
    console.error('Error toggling feature flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility functions
function evaluateFlag(flag: FeatureFlag, context: FeatureFlagContext): boolean {
  // Check conditions
  if (flag.conditions && flag.conditions.length > 0) {
    const conditionsMet = flag.conditions.every(condition => 
      evaluateCondition(condition, context)
    );
    if (!conditionsMet) {
      return false;
    }
  }

  // Check geographic restrictions
  if (flag.geoRestrictions && flag.geoRestrictions.length > 0 && context.country) {
    if (!flag.geoRestrictions.includes(context.country)) {
      return false;
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined) {
    const hash = hashString(context.userId || context.walletAddress || 'anonymous');
    const percentage = (hash % 100) + 1;
    if (percentage > flag.rolloutPercentage) {
      return false;
    }
  }

  return true;
}

function evaluateCondition(condition: any, context: FeatureFlagContext): boolean {
  let value: any;
  
  switch (condition.type) {
    case 'user_segment':
      value = context.userSegment;
      break;
    case 'geo_location':
      value = context.country;
      break;
    case 'wallet_address':
      value = context.walletAddress;
      break;
    case 'organization':
      value = context.organizationId;
      break;
    case 'random_percentage':
      const hash = hashString(context.userId || context.walletAddress || 'anonymous');
      const percentage = (hash % 100) + 1;
      return percentage <= condition.value;
    default:
      return true;
  }

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'contains':
      return typeof value === 'string' && value.includes(condition.value);
    default:
      return true;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function saveToDatabase() {
  // In production, implement database persistence
  // await db.featureFlags.bulkUpsert(Array.from(featureFlags.values()));
}

// Initialize with default flags on startup
async function initializeFlags() {
  // In production, load from database
  // const savedFlags = await db.featureFlags.findAll();
  // savedFlags.forEach(flag => featureFlags.set(flag.key, flag));
}

// Call initialization
initializeFlags();

export default router;