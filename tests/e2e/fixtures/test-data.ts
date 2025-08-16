/**
 * Test data fixtures for E2E tests
 */

export const TEST_USERS = {
  creator: {
    email: 'creator@test.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  },
  consumer: {
    email: 'consumer@test.com',
    walletAddress: '0x2345678901234567890123456789012345678901',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  },
  agency: {
    email: 'agency@test.com',
    walletAddress: '0x3456789012345678901234567890123456789012',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
  }
};

export const TEST_CONTENT = {
  video: {
    id: 'test-video-1',
    title: 'Test Video Content',
    description: 'This is a test video for E2E testing',
    price: 9.99,
    duration: 300, // 5 minutes
    tags: ['test', 'e2e', 'video'],
    thumbnailUrl: 'https://via.placeholder.com/640x360',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  subscription: {
    id: 'test-sub-1',
    title: 'Test Subscription',
    description: 'Monthly subscription for testing',
    price: 29.99,
    duration: 30, // 30 days
    benefits: ['Access to all content', 'Early access', 'Exclusive content']
  }
};

export const TEST_PAYMENTS = {
  usdc: {
    amount: 10000000, // 10 USDC (6 decimals)
    currency: 'USDC',
    contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon
  },
  fiat: {
    amount: 9.99,
    currency: 'USD',
    provider: 'ccbill'
  }
};

export const TEST_DMCA = {
  takedownRequest: {
    contentId: 'test-video-1',
    complainant: 'Test Copyright Holder',
    email: 'copyright@test.com',
    description: 'This content infringes my copyright',
    copyrightedWork: 'Original Test Video',
    infringementClaim: 'Unauthorized use of my video content'
  },
  counterNotice: {
    contentId: 'test-video-1',
    creator: 'creator@test.com',
    statement: 'I have a good faith belief that the content was removed due to mistake or misidentification',
    contactInfo: 'creator@test.com, 123-456-7890'
  }
};

export const TEST_CONSENT = {
  multiParticipant: {
    participants: [
      {
        name: 'Participant 1',
        email: 'participant1@test.com',
        walletAddress: '0x4567890123456789012345678901234567890123'
      },
      {
        name: 'Participant 2', 
        email: 'participant2@test.com',
        walletAddress: '0x5678901234567890123456789012345678901234'
      }
    ],
    contentId: 'test-video-multi-1',
    consentTerms: 'All participants consent to the creation and distribution of this content'
  }
};

export const TEST_PAYOUTS = {
  creator: {
    walletAddress: '0x1234567890123456789012345678901234567890',
    amount: 50.00,
    currency: 'USD',
    method: 'crypto'
  },
  splits: [
    {
      walletAddress: '0x1234567890123456789012345678901234567890',
      percentage: 70,
      amount: 35.00
    },
    {
      walletAddress: '0x2345678901234567890123456789012345678901',
      percentage: 30,
      amount: 15.00
    }
  ]
};

export const MOCK_RESPONSES = {
  siweNonce: {
    nonce: 'test-nonce-' + Math.random().toString(36).substr(2, 9)
  },
  siweVerify: {
    success: true,
    address: TEST_USERS.creator.walletAddress,
    session: 'test-session-' + Math.random().toString(36).substr(2, 9)
  },
  paymentSuccess: {
    success: true,
    transactionId: '0x' + Math.random().toString(16).substr(2, 64),
    amount: '9.99',
    currency: 'USD',
    method: 'fiat',
    entitlementId: 'ent_' + Math.random().toString(36).substr(2, 9)
  }
};

export const SELECTORS = {
  // Navigation
  sidebar: '[data-testid="sidebar"]',
  header: '[data-testid="header"]',
  
  // Authentication
  walletButton: '[data-testid="wallet-button"]',
  connectWallet: '[data-testid="connect-wallet"]',
  siweButton: '[data-testid="siwe-button"]',
  passkeyButton: '[data-testid="passkey-button"]',
  
  // Content
  videoPlayer: '[data-testid="video-player"]',
  contentCard: '[data-testid="content-card"]',
  purchaseButton: '[data-testid="purchase-button"]',
  
  // Payments
  paymentModal: '[data-testid="payment-modal"]',
  usdcPayment: '[data-testid="usdc-payment"]',
  fiatPayment: '[data-testid="fiat-payment"]',
  paymentSuccess: '[data-testid="payment-success"]',
  
  // DMCA
  dmcaForm: '[data-testid="dmca-form"]',
  takedownButton: '[data-testid="takedown-button"]',
  counterNoticeForm: '[data-testid="counter-notice-form"]',
  
  // Consent
  consentForm: '[data-testid="consent-form"]',
  participantSignature: '[data-testid="participant-signature"]',
  consentComplete: '[data-testid="consent-complete"]',
  
  // Payouts
  payoutDashboard: '[data-testid="payout-dashboard"]',
  payoutRequest: '[data-testid="payout-request"]',
  payoutHistory: '[data-testid="payout-history"]',
  
  // Status indicators
  loading: '[data-testid="loading"]',
  error: '[data-testid="error"]',
  success: '[data-testid="success"]',
  
  // App state
  appLoaded: '[data-testid="app-loaded"]'
};

export const TIMEOUTS = {
  short: 5000,
  medium: 15000,
  long: 30000,
  payment: 60000,
  video: 45000
};

export const URLS = {
  home: '/',
  create: '/create',
  studio: '/studio',
  wallet: '/wallet',
  earnings: '/earnings',
  settings: '/settings',
  help: '/help',
  status: '/status'
};