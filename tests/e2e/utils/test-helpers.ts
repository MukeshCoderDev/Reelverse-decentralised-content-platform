import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS, TEST_USERS, MOCK_RESPONSES } from '../fixtures/test-data';

/**
 * Test helper utilities for E2E tests
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for application to be fully loaded
   */
  async waitForAppReady(): Promise<void> {
    await this.page.waitForSelector(SELECTORS.appLoaded, { timeout: TIMEOUTS.long });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Mock API responses for testing
   */
  async setupApiMocks(): Promise<void> {
    // Mock SIWE nonce generation
    await this.page.route('**/api/v1/auth/siwe/nonce', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RESPONSES.siweNonce)
      });
    });

    // Mock SIWE verification
    await this.page.route('**/api/v1/auth/siwe/verify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RESPONSES.siweVerify)
      });
    });

    // Mock payment processing
    await this.page.route('**/api/v1/payments/**', async route => {
      const url = route.request().url();
      
      if (url.includes('/prepare')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              hostedUrl: 'https://checkout.test.com/session/test',
              sessionId: 'test-session-123',
              provider: 'ccbill'
            }
          })
        });
      } else if (url.includes('/confirm')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              entitlementId: 'ent_test_123',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          })
        });
      }
    });

    // Mock content API
    await this.page.route('**/api/v1/content/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'test-content-1',
            title: 'Test Content',
            price: 9.99,
            hasAccess: false
          }
        })
      });
    });
  }

  /**
   * Connect wallet and authenticate
   */
  async connectAndAuthenticateWallet(userType: 'creator' | 'consumer' | 'agency' = 'creator'): Promise<void> {
    const user = TEST_USERS[userType];
    
    // Click wallet button
    await this.page.click(SELECTORS.walletButton);
    
    // Wait for wallet connection modal
    await this.page.waitForSelector(SELECTORS.connectWallet);
    
    // Mock wallet connection
    await this.page.evaluate((address) => {
      // Simulate wallet connection
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, user.walletAddress);
    
    // Wait for SIWE button to appear
    await this.page.waitForSelector(SELECTORS.siweButton);
    
    // Click SIWE authentication
    await this.page.click(SELECTORS.siweButton);
    
    // Wait for authentication to complete
    await this.page.waitForSelector('[data-testid="authenticated"]', { timeout: TIMEOUTS.medium });
  }

  /**
   * Create passkey wallet
   */
  async createPasskeyWallet(email: string): Promise<void> {
    // Navigate to wallet creation
    await this.page.goto('/wallet');
    
    // Click create passkey wallet
    await this.page.click(SELECTORS.passkeyButton);
    
    // Fill email
    await this.page.fill('[data-testid="email-input"]', email);
    
    // Mock WebAuthn credential creation
    await this.page.evaluate(() => {
      // Mock navigator.credentials.create
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async () => ({
            id: 'test-credential-id',
            rawId: new ArrayBuffer(32),
            response: {
              attestationObject: new ArrayBuffer(64),
              clientDataJSON: new ArrayBuffer(32)
            },
            type: 'public-key'
          })
        }
      });
    });
    
    // Click create wallet
    await this.page.click('[data-testid="create-wallet"]');
    
    // Wait for wallet creation to complete
    await this.page.waitForSelector('[data-testid="wallet-created"]', { timeout: TIMEOUTS.medium });
  }

  /**
   * Purchase content with fiat payment
   */
  async purchaseContentWithFiat(contentId: string): Promise<void> {
    // Navigate to content
    await this.page.goto(`/content/${contentId}`);
    
    // Click purchase button
    await this.page.click(SELECTORS.purchaseButton);
    
    // Wait for payment modal
    await this.page.waitForSelector(SELECTORS.paymentModal);
    
    // Select fiat payment
    await this.page.click(SELECTORS.fiatPayment);
    
    // Mock hosted checkout completion
    await this.page.evaluate(() => {
      // Simulate successful payment
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payment-success', {
          detail: { transactionId: 'test-tx-123' }
        }));
      }, 2000);
    });
    
    // Wait for payment success
    await this.page.waitForSelector(SELECTORS.paymentSuccess, { timeout: TIMEOUTS.payment });
  }

  /**
   * Purchase content with USDC payment
   */
  async purchaseContentWithUSDC(contentId: string): Promise<void> {
    // Navigate to content
    await this.page.goto(`/content/${contentId}`);
    
    // Click purchase button
    await this.page.click(SELECTORS.purchaseButton);
    
    // Wait for payment modal
    await this.page.waitForSelector(SELECTORS.paymentModal);
    
    // Select USDC payment
    await this.page.click(SELECTORS.usdcPayment);
    
    // Mock blockchain transaction
    await this.page.evaluate(() => {
      // Simulate successful USDC transaction
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('transaction-success', {
          detail: { 
            hash: '0x' + Math.random().toString(16).substr(2, 64),
            status: 'success'
          }
        }));
      }, 3000);
    });
    
    // Wait for payment success
    await this.page.waitForSelector(SELECTORS.paymentSuccess, { timeout: TIMEOUTS.payment });
  }

  /**
   * Test video playback
   */
  async testVideoPlayback(contentId: string): Promise<void> {
    // Navigate to content
    await this.page.goto(`/content/${contentId}`);
    
    // Wait for video player to load
    await this.page.waitForSelector(SELECTORS.videoPlayer, { timeout: TIMEOUTS.video });
    
    // Click play button
    await this.page.click('[data-testid="play-button"]');
    
    // Wait for video to start playing
    await this.page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && !video.paused && video.currentTime > 0;
    }, { timeout: TIMEOUTS.video });
    
    // Verify video is playing
    const isPlaying = await this.page.evaluate(() => {
      const video = document.querySelector('video');
      return video && !video.paused && video.currentTime > 0;
    });
    
    expect(isPlaying).toBe(true);
  }

  /**
   * Submit DMCA takedown request
   */
  async submitDMCATakedown(contentId: string, complainant: string): Promise<void> {
    // Navigate to DMCA form
    await this.page.goto(`/dmca/takedown/${contentId}`);
    
    // Wait for form to load
    await this.page.waitForSelector(SELECTORS.dmcaForm);
    
    // Fill out takedown form
    await this.page.fill('[data-testid="complainant-name"]', complainant);
    await this.page.fill('[data-testid="complainant-email"]', 'copyright@test.com');
    await this.page.fill('[data-testid="copyright-description"]', 'This content infringes my copyright');
    await this.page.fill('[data-testid="infringement-claim"]', 'Unauthorized use of my copyrighted material');
    
    // Submit takedown request
    await this.page.click(SELECTORS.takedownButton);
    
    // Wait for submission confirmation
    await this.page.waitForSelector('[data-testid="takedown-submitted"]', { timeout: TIMEOUTS.medium });
  }

  /**
   * Create multi-participant consent
   */
  async createMultiParticipantConsent(participants: string[]): Promise<void> {
    // Navigate to consent form
    await this.page.goto('/consent/create');
    
    // Wait for form to load
    await this.page.waitForSelector(SELECTORS.consentForm);
    
    // Add participants
    for (const participant of participants) {
      await this.page.click('[data-testid="add-participant"]');
      await this.page.fill('[data-testid="participant-email"]:last-of-type', participant);
    }
    
    // Fill consent terms
    await this.page.fill('[data-testid="consent-terms"]', 'All participants consent to content creation and distribution');
    
    // Submit consent form
    await this.page.click('[data-testid="create-consent"]');
    
    // Wait for consent creation
    await this.page.waitForSelector('[data-testid="consent-created"]', { timeout: TIMEOUTS.medium });
  }

  /**
   * Process payout request
   */
  async processPayoutRequest(amount: number): Promise<void> {
    // Navigate to earnings page
    await this.page.goto('/earnings');
    
    // Wait for payout dashboard
    await this.page.waitForSelector(SELECTORS.payoutDashboard);
    
    // Click request payout
    await this.page.click(SELECTORS.payoutRequest);
    
    // Fill payout amount
    await this.page.fill('[data-testid="payout-amount"]', amount.toString());
    
    // Select payout method
    await this.page.selectOption('[data-testid="payout-method"]', 'crypto');
    
    // Submit payout request
    await this.page.click('[data-testid="submit-payout"]');
    
    // Wait for payout confirmation
    await this.page.waitForSelector('[data-testid="payout-requested"]', { timeout: TIMEOUTS.medium });
  }

  /**
   * Take screenshot with timestamp
   */
  async takeTimestampedScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for element with retry
   */
  async waitForElementWithRetry(selector: string, maxRetries: number = 3): Promise<void> {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        await this.page.waitForSelector(selector, { timeout: TIMEOUTS.short });
        return;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Check for console errors
   */
  async checkForConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    return errors;
  }

  /**
   * Measure page load performance
   */
  async measurePageLoadPerformance(): Promise<any> {
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        totalLoadTime: navigation.loadEventEnd - navigation.navigationStart
      };
    });
    
    return performanceMetrics;
  }

  /**
   * Cleanup test data
   */
  async cleanup(): Promise<void> {
    // Clear localStorage
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Clear cookies
    await this.page.context().clearCookies();
  }
}