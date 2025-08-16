import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONTENT, TEST_USERS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Fiat Payment Flow (CCBill/Segpay)', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.setupApiMocks();
    await page.goto('/');
    await helpers.waitForAppReady();
  });

  test.afterEach(async ({ page }) => {
    await helpers.cleanup();
  });

  test('should complete fiat payment flow with CCBill', async ({ page }) => {
    test.setTimeout(TIMEOUTS.payment + 30000);

    // Step 1: Connect wallet and authenticate
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Step 2: Navigate to premium content
    await page.goto('/explore');
    await page.waitForSelector(SELECTORS.contentCard);
    
    // Click on first premium content
    await page.click(`${SELECTORS.contentCard}:first-child`);
    
    // Step 3: Attempt to access content (should show paywall)
    await page.waitForSelector('[data-testid="paywall"]');
    expect(await page.isVisible('[data-testid="paywall"]')).toBe(true);
    
    // Step 4: Click purchase button
    await page.click(SELECTORS.purchaseButton);
    
    // Step 5: Select fiat payment method
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.fiatPayment);
    
    // Step 6: Verify CCBill checkout opens
    await page.click('[data-testid="proceed-to-checkout"]');
    
    // Mock hosted checkout completion
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payment-completed', {
          detail: {
            success: true,
            transactionId: 'ccb_test_' + Date.now(),
            amount: 9.99,
            currency: 'USD'
          }
        }));
      }, 3000);
    });
    
    // Step 7: Wait for payment success
    await page.waitForSelector(SELECTORS.paymentSuccess, { timeout: TIMEOUTS.payment });
    
    // Step 8: Verify content access granted
    await page.waitForSelector('[data-testid="content-unlocked"]');
    expect(await page.isVisible('[data-testid="content-unlocked"]')).toBe(true);
    
    // Step 9: Verify video player is accessible
    await page.waitForSelector(SELECTORS.videoPlayer);
    expect(await page.isVisible(SELECTORS.videoPlayer)).toBe(true);
    
    // Step 10: Test video playback
    await helpers.testVideoPlayback(TEST_CONTENT.video.id);
    
    // Take screenshot for verification
    await helpers.takeTimestampedScreenshot('fiat-payment-success');
  });

  test('should handle fiat payment failure gracefully', async ({ page }) => {
    // Connect wallet
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Navigate to content
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    
    // Start payment flow
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.fiatPayment);
    
    // Mock payment failure
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payment-failed', {
          detail: {
            success: false,
            error: 'Payment declined by bank'
          }
        }));
      }, 2000);
    });
    
    // Verify error handling
    await page.waitForSelector('[data-testid="payment-error"]');
    expect(await page.textContent('[data-testid="payment-error"]')).toContain('Payment declined');
    
    // Verify user can retry
    expect(await page.isVisible('[data-testid="retry-payment"]')).toBe(true);
  });

  test('should support Segpay as alternative payment processor', async ({ page }) => {
    // Mock Segpay response
    await page.route('**/api/v1/payments/fiat/prepare', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hostedUrl: 'https://secure.segpay.com/billing/poset.cgi',
            sessionId: 'segpay-session-123',
            provider: 'segpay'
          }
        })
      });
    });

    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Navigate to content and start payment
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.fiatPayment);
    
    // Verify Segpay is selected as processor
    await page.waitForSelector('[data-testid="payment-processor"]');
    expect(await page.textContent('[data-testid="payment-processor"]')).toContain('Segpay');
    
    // Complete payment flow
    await page.click('[data-testid="proceed-to-checkout"]');
    
    // Mock successful Segpay payment
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payment-completed', {
          detail: {
            success: true,
            transactionId: 'seg_test_' + Date.now(),
            provider: 'segpay'
          }
        }));
      }, 2000);
    });
    
    await page.waitForSelector(SELECTORS.paymentSuccess);
    expect(await page.isVisible('[data-testid="content-unlocked"]')).toBe(true);
  });

  test('should handle 3DS/SCA authentication for EU payments', async ({ page }) => {
    // Mock 3DS challenge
    await page.route('**/api/v1/payments/fiat/prepare', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hostedUrl: 'https://checkout.test.com/3ds-challenge',
            sessionId: 'test-3ds-session',
            provider: 'ccbill',
            requires3DS: true
          }
        })
      });
    });

    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Start payment flow
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.fiatPayment);
    await page.click('[data-testid="proceed-to-checkout"]');
    
    // Verify 3DS challenge appears
    await page.waitForSelector('[data-testid="3ds-challenge"]');
    expect(await page.isVisible('[data-testid="3ds-challenge"]')).toBe(true);
    
    // Mock 3DS completion
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('3ds-completed', {
          detail: { success: true }
        }));
      }, 3000);
    });
    
    // Verify payment completes after 3DS
    await page.waitForSelector(SELECTORS.paymentSuccess);
    expect(await page.isVisible('[data-testid="content-unlocked"]')).toBe(true);
  });

  test('should apply VAT/GST correctly for different regions', async ({ page }) => {
    // Test EU VAT
    await page.evaluate(() => {
      // Mock geolocation to EU
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success) => {
            success({
              coords: {
                latitude: 52.5200, // Berlin
                longitude: 13.4050
              }
            });
          }
        }
      });
    });

    await helpers.connectAndAuthenticateWallet('consumer');
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    
    // Verify VAT is displayed
    await page.waitForSelector('[data-testid="tax-breakdown"]');
    const taxText = await page.textContent('[data-testid="tax-breakdown"]');
    expect(taxText).toContain('VAT');
    expect(taxText).toMatch(/\d+\.\d+/); // Should show tax amount
    
    // Verify total includes tax
    const totalElement = await page.textContent('[data-testid="total-amount"]');
    expect(parseFloat(totalElement!.replace(/[^0-9.]/g, ''))).toBeGreaterThan(TEST_CONTENT.video.price);
  });
});