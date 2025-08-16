import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONTENT, TEST_PAYMENTS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Gasless Payment Flow (USDC + Paymaster)', () => {
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

  test('should complete gasless USDC payment with permit', async ({ page }) => {
    test.setTimeout(TIMEOUTS.payment + 30000);

    // Step 1: Connect wallet with USDC balance
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Mock USDC balance
    await page.evaluate(() => {
      window.mockUSDCBalance = 100000000; // 100 USDC
    });
    
    // Step 2: Navigate to content
    await page.goto('/explore');
    await page.waitForSelector(SELECTORS.contentCard);
    await page.click(`${SELECTORS.contentCard}:first-child`);
    
    // Step 3: Start payment flow
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    
    // Step 4: Select USDC payment
    await page.click(SELECTORS.usdcPayment);
    
    // Verify USDC balance is displayed
    await page.waitForSelector('[data-testid="usdc-balance"]');
    const balance = await page.textContent('[data-testid="usdc-balance"]');
    expect(balance).toContain('100.00 USDC');
    
    // Step 5: Verify gasless transaction details
    await page.waitForSelector('[data-testid="gasless-info"]');
    expect(await page.isVisible('[data-testid="gasless-info"]')).toBe(true);
    expect(await page.textContent('[data-testid="gasless-info"]')).toContain('No gas fees');
    
    // Step 6: Approve USDC permit
    await page.click('[data-testid="approve-permit"]');
    
    // Mock permit signature
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('permit-signed', {
          detail: {
            signature: '0x' + 'a'.repeat(130),
            deadline: Math.floor(Date.now() / 1000) + 3600
          }
        }));
      }, 2000);
    });
    
    // Step 7: Execute gasless transaction
    await page.waitForSelector('[data-testid="execute-transaction"]');
    await page.click('[data-testid="execute-transaction"]');
    
    // Mock paymaster transaction
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('transaction-success', {
          detail: {
            hash: '0x' + Math.random().toString(16).substr(2, 64),
            gasUsed: '0', // Gasless
            status: 'success'
          }
        }));
      }, 3000);
    });
    
    // Step 8: Verify payment success
    await page.waitForSelector(SELECTORS.paymentSuccess, { timeout: TIMEOUTS.payment });
    
    // Step 9: Verify content access
    await page.waitForSelector('[data-testid="content-unlocked"]');
    expect(await page.isVisible(SELECTORS.videoPlayer)).toBe(true);
    
    // Step 10: Verify transaction was gasless
    const txDetails = await page.textContent('[data-testid="transaction-details"]');
    expect(txDetails).toContain('Gas fees: $0.00');
    
    await helpers.takeTimestampedScreenshot('gasless-payment-success');
  });

  test('should handle insufficient USDC balance', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Mock insufficient USDC balance
    await page.evaluate(() => {
      window.mockUSDCBalance = 5000000; // 5 USDC (less than content price)
    });
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.usdcPayment);
    
    // Verify insufficient balance warning
    await page.waitForSelector('[data-testid="insufficient-balance"]');
    expect(await page.isVisible('[data-testid="insufficient-balance"]')).toBe(true);
    
    // Verify purchase button is disabled
    expect(await page.isDisabled('[data-testid="approve-permit"]')).toBe(true);
    
    // Verify buy USDC option is available
    expect(await page.isVisible('[data-testid="buy-usdc"]')).toBe(true);
  });

  test('should handle permit signature rejection', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    await page.evaluate(() => {
      window.mockUSDCBalance = 100000000; // 100 USDC
    });
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.usdcPayment);
    await page.click('[data-testid="approve-permit"]');
    
    // Mock permit rejection
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('permit-rejected', {
          detail: { error: 'User rejected signature' }
        }));
      }, 1000);
    });
    
    // Verify error handling
    await page.waitForSelector('[data-testid="permit-error"]');
    expect(await page.textContent('[data-testid="permit-error"]')).toContain('signature');
    
    // Verify user can retry
    expect(await page.isVisible('[data-testid="retry-permit"]')).toBe(true);
  });

  test('should handle paymaster failure gracefully', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    await page.evaluate(() => {
      window.mockUSDCBalance = 100000000;
    });
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.usdcPayment);
    await page.click('[data-testid="approve-permit"]');
    
    // Mock permit success
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('permit-signed', {
          detail: { signature: '0x' + 'a'.repeat(130) }
        }));
      }, 1000);
    });
    
    await page.waitForSelector('[data-testid="execute-transaction"]');
    await page.click('[data-testid="execute-transaction"]');
    
    // Mock paymaster failure
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('transaction-failed', {
          detail: { error: 'Paymaster rejected transaction' }
        }));
      }, 2000);
    });
    
    // Verify fallback to regular transaction
    await page.waitForSelector('[data-testid="paymaster-fallback"]');
    expect(await page.textContent('[data-testid="paymaster-fallback"]')).toContain('fallback');
    
    // Verify option to pay gas fees
    expect(await page.isVisible('[data-testid="pay-gas-fees"]')).toBe(true);
  });

  test('should display accurate gas savings', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Mock gas price data
    await page.evaluate(() => {
      window.mockGasPrice = 30; // 30 gwei
      window.mockUSDCBalance = 100000000;
    });
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.usdcPayment);
    
    // Verify gas savings display
    await page.waitForSelector('[data-testid="gas-savings"]');
    const savings = await page.textContent('[data-testid="gas-savings"]');
    expect(savings).toMatch(/\$\d+\.\d+/); // Should show dollar amount saved
    expect(savings).toContain('saved');
  });

  test('should support subscription payments with USDC', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    await page.evaluate(() => {
      window.mockUSDCBalance = 100000000;
    });
    
    // Navigate to subscription content
    await page.goto('/creator/test-creator');
    await page.click('[data-testid="subscribe-button"]');
    
    // Select monthly subscription
    await page.waitForSelector('[data-testid="subscription-modal"]');
    await page.click('[data-testid="monthly-plan"]');
    
    // Select USDC payment
    await page.click(SELECTORS.usdcPayment);
    
    // Verify subscription details
    await page.waitForSelector('[data-testid="subscription-details"]');
    const details = await page.textContent('[data-testid="subscription-details"]');
    expect(details).toContain('Monthly');
    expect(details).toContain('USDC');
    
    // Complete subscription payment
    await page.click('[data-testid="approve-permit"]');
    
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('permit-signed', {
          detail: { signature: '0x' + 'a'.repeat(130) }
        }));
      }, 1000);
    });
    
    await page.waitForSelector('[data-testid="execute-transaction"]');
    await page.click('[data-testid="execute-transaction"]');
    
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('transaction-success', {
          detail: { hash: '0x' + Math.random().toString(16).substr(2, 64) }
        }));
      }, 2000);
    });
    
    // Verify subscription activation
    await page.waitForSelector('[data-testid="subscription-active"]');
    expect(await page.isVisible('[data-testid="subscription-active"]')).toBe(true);
  });

  test('should handle network congestion with dynamic gas pricing', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Mock high gas prices (network congestion)
    await page.evaluate(() => {
      window.mockGasPrice = 150; // 150 gwei (high)
      window.mockUSDCBalance = 100000000;
    });
    
    await page.goto('/explore');
    await page.click(`${SELECTORS.contentCard}:first-child`);
    await page.click(SELECTORS.purchaseButton);
    await page.waitForSelector(SELECTORS.paymentModal);
    await page.click(SELECTORS.usdcPayment);
    
    // Verify high gas warning
    await page.waitForSelector('[data-testid="high-gas-warning"]');
    expect(await page.isVisible('[data-testid="high-gas-warning"]')).toBe(true);
    
    // Verify gasless benefit is highlighted
    const gaslessInfo = await page.textContent('[data-testid="gasless-info"]');
    expect(gaslessInfo).toContain('Save');
    expect(gaslessInfo).toMatch(/\$\d+/); // Should show significant savings
  });
});