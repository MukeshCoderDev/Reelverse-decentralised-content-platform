import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_PAYOUTS, TEST_USERS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Payout Processing and Revenue Split Flow', () => {
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

  test('should process creator payout request within 48-hour SLA', async ({ page }) => {
    test.setTimeout(TIMEOUTS.long);

    // Step 1: Connect as creator with earnings
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Mock creator earnings
    await page.evaluate(() => {
      window.mockEarnings = {
        totalEarnings: 150.75,
        availableForPayout: 125.50,
        pendingPayouts: 25.25,
        lastPayoutDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      };
    });
    
    // Step 2: Navigate to earnings dashboard
    await page.goto('/earnings');
    await page.waitForSelector(SELECTORS.payoutDashboard);
    
    // Step 3: Verify earnings display
    const availableAmount = await page.textContent('[data-testid="available-payout"]');
    expect(availableAmount).toContain('$125.50');
    
    // Step 4: Request payout
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Step 5: Configure payout details
    await page.fill('[data-testid="payout-amount"]', '100.00');
    await page.selectOption('[data-testid="payout-method"]', 'crypto');
    await page.selectOption('[data-testid="payout-currency"]', 'USDC');
    
    // Step 6: Verify payout address
    const payoutAddress = await page.inputValue('[data-testid="payout-address"]');
    expect(payoutAddress).toBe(TEST_USERS.creator.walletAddress);
    
    // Step 7: Review payout details
    expect(await page.textContent('[data-testid="payout-summary"]')).toContain('$100.00');
    expect(await page.textContent('[data-testid="estimated-fees"]')).toMatch(/\$\d+\.\d+/);
    
    // Step 8: Submit payout request
    await page.click('[data-testid="submit-payout"]');
    
    // Step 9: Wait for payout confirmation
    await page.waitForSelector('[data-testid="payout-requested"]', { timeout: TIMEOUTS.medium });
    
    // Step 10: Verify payout ID and SLA
    const payoutId = await page.textContent('[data-testid="payout-id"]');
    expect(payoutId).toMatch(/^PO-\d{4}-\d{6}$/);
    
    const slaMessage = await page.textContent('[data-testid="payout-sla"]');
    expect(slaMessage).toContain('48 hours');
    
    // Step 11: Mock payout processing (admin side)
    await page.goto('/admin/payouts');
    await page.waitForSelector('[data-testid="payout-queue"]');
    
    // Step 12: Process payout
    await page.click('[data-testid="process-payout"]:first-child');
    await page.waitForSelector('[data-testid="payout-processing"]');
    
    // Mock blockchain transaction
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payout-completed', {
          detail: {
            payoutId: 'PO-2024-000001',
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            amount: 100.00,
            currency: 'USDC',
            completedAt: new Date().toISOString()
          }
        }));
      }, 3000);
    });
    
    // Step 13: Verify payout completion
    await page.waitForSelector('[data-testid="payout-completed"]', { timeout: TIMEOUTS.medium });
    
    const txHash = await page.textContent('[data-testid="transaction-hash"]');
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    
    await helpers.takeTimestampedScreenshot('payout-completed');
  });

  test('should handle revenue splits for collaborative content', async ({ page }) => {
    // Step 1: Connect as primary creator
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Step 2: Navigate to revenue splits setup
    await page.goto('/studio/splits');
    await page.waitForSelector('[data-testid="splits-dashboard"]');
    
    // Step 3: Create new revenue split
    await page.click('[data-testid="create-split"]');
    await page.waitForSelector('[data-testid="split-form"]');
    
    // Step 4: Configure split details
    await page.fill('[data-testid="split-name"]', 'Collaborative Video Split');
    await page.fill('[data-testid="content-id"]', 'collab-video-1');
    
    // Step 5: Add split recipients
    for (const split of TEST_PAYOUTS.splits) {
      await page.click('[data-testid="add-recipient"]');
      
      const recipientRow = page.locator('[data-testid="recipient-row"]').last();
      await recipientRow.locator('[data-testid="recipient-address"]').fill(split.walletAddress);
      await recipientRow.locator('[data-testid="recipient-percentage"]').fill(split.percentage.toString());
    }
    
    // Step 6: Verify split totals 100%
    const totalPercentage = await page.textContent('[data-testid="total-percentage"]');
    expect(totalPercentage).toBe('100%');
    
    // Step 7: Create split contract
    await page.click('[data-testid="create-split-contract"]');
    
    // Mock smart contract deployment
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('split-contract-deployed', {
          detail: {
            contractAddress: '0x' + Math.random().toString(16).substr(2, 40),
            txHash: '0x' + Math.random().toString(16).substr(2, 64)
          }
        }));
      }, 5000);
    });
    
    // Step 8: Wait for contract deployment
    await page.waitForSelector('[data-testid="split-contract-deployed"]', { timeout: TIMEOUTS.medium });
    
    const contractAddress = await page.textContent('[data-testid="contract-address"]');
    expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    
    // Step 9: Test revenue distribution
    await page.click('[data-testid="test-distribution"]');
    
    // Mock revenue distribution
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('revenue-distributed', {
          detail: {
            totalAmount: 50.00,
            distributions: [
              { address: '0x1234567890123456789012345678901234567890', amount: 35.00 },
              { address: '0x2345678901234567890123456789012345678901', amount: 15.00 }
            ]
          }
        }));
      }, 3000);
    });
    
    // Step 10: Verify distribution
    await page.waitForSelector('[data-testid="distribution-complete"]');
    
    const distributionCount = await page.locator('[data-testid="distribution-item"]').count();
    expect(distributionCount).toBe(2);
  });

  test('should handle payout failures and retries', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Mock earnings
    await page.evaluate(() => {
      window.mockEarnings = { availableForPayout: 75.25 };
    });
    
    await page.goto('/earnings');
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Configure payout
    await page.fill('[data-testid="payout-amount"]', '50.00');
    await page.selectOption('[data-testid="payout-method"]', 'crypto');
    await page.click('[data-testid="submit-payout"]');
    
    await page.waitForSelector('[data-testid="payout-requested"]');
    
    // Mock payout failure (admin side)
    await page.goto('/admin/payouts');
    await page.click('[data-testid="process-payout"]:first-child');
    
    // Simulate blockchain failure
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payout-failed', {
          detail: {
            error: 'Insufficient gas for transaction',
            retryable: true
          }
        }));
      }, 2000);
    });
    
    // Verify failure handling
    await page.waitForSelector('[data-testid="payout-failed"]');
    expect(await page.textContent('[data-testid="failure-reason"]')).toContain('gas');
    
    // Verify retry option
    expect(await page.isVisible('[data-testid="retry-payout"]')).toBe(true);
    
    // Test retry
    await page.click('[data-testid="retry-payout"]');
    
    // Mock successful retry
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('payout-completed', {
          detail: {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            amount: 50.00
          }
        }));
      }, 3000);
    });
    
    await page.waitForSelector('[data-testid="payout-completed"]');
    expect(await page.textContent('[data-testid="retry-success"]')).toContain('successful');
  });

  test('should enforce minimum payout thresholds', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Mock low earnings
    await page.evaluate(() => {
      window.mockEarnings = { availableForPayout: 15.50 };
    });
    
    await page.goto('/earnings');
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Try to request payout below minimum
    await page.fill('[data-testid="payout-amount"]', '5.00');
    
    // Verify minimum threshold warning
    await page.waitForSelector('[data-testid="minimum-threshold-warning"]');
    expect(await page.textContent('[data-testid="minimum-threshold-warning"]')).toContain('minimum');
    
    // Verify submit button is disabled
    expect(await page.isDisabled('[data-testid="submit-payout"]')).toBe(true);
    
    // Set amount above minimum
    await page.fill('[data-testid="payout-amount"]', '15.50');
    
    // Verify submit is now enabled
    expect(await page.isDisabled('[data-testid="submit-payout"]')).toBe(false);
  });

  test('should support multiple payout methods and currencies', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    await page.evaluate(() => {
      window.mockEarnings = { availableForPayout: 200.00 };
    });
    
    await page.goto('/earnings');
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Test crypto payout options
    await page.selectOption('[data-testid="payout-method"]', 'crypto');
    
    const cryptoOptions = await page.locator('[data-testid="payout-currency"] option').allTextContents();
    expect(cryptoOptions).toContain('USDC');
    expect(cryptoOptions).toContain('ETH');
    expect(cryptoOptions).toContain('MATIC');
    
    // Test bank transfer option
    await page.selectOption('[data-testid="payout-method"]', 'bank');
    
    await page.waitForSelector('[data-testid="bank-details"]');
    expect(await page.isVisible('[data-testid="routing-number"]')).toBe(true);
    expect(await page.isVisible('[data-testid="account-number"]')).toBe(true);
    
    // Test PayPal option
    await page.selectOption('[data-testid="payout-method"]', 'paypal');
    
    await page.waitForSelector('[data-testid="paypal-email"]');
    expect(await page.isVisible('[data-testid="paypal-email"]')).toBe(true);
    
    // Verify fee differences
    await page.selectOption('[data-testid="payout-method"]', 'crypto');
    const cryptoFee = await page.textContent('[data-testid="estimated-fees"]');
    
    await page.selectOption('[data-testid="payout-method"]', 'bank');
    const bankFee = await page.textContent('[data-testid="estimated-fees"]');
    
    // Crypto should have lower fees
    const cryptoFeeAmount = parseFloat(cryptoFee!.replace(/[^0-9.]/g, ''));
    const bankFeeAmount = parseFloat(bankFee!.replace(/[^0-9.]/g, ''));
    expect(cryptoFeeAmount).toBeLessThan(bankFeeAmount);
  });

  test('should track payout history and generate tax documents', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    await page.goto('/earnings');
    await page.waitForSelector(SELECTORS.payoutHistory);
    
    // Mock payout history
    await page.evaluate(() => {
      window.mockPayoutHistory = [
        {
          id: 'PO-2024-000001',
          amount: 150.00,
          currency: 'USD',
          method: 'crypto',
          status: 'completed',
          date: '2024-01-15',
          txHash: '0x' + 'a'.repeat(64)
        },
        {
          id: 'PO-2024-000002',
          amount: 200.00,
          currency: 'USD',
          method: 'bank',
          status: 'completed',
          date: '2024-02-15'
        }
      ];
    });
    
    // View payout history
    await page.click('[data-testid="view-history"]');
    await page.waitForSelector('[data-testid="payout-history-table"]');
    
    // Verify history entries
    const historyRows = await page.locator('[data-testid="history-row"]').count();
    expect(historyRows).toBe(2);
    
    // Test filtering
    await page.selectOption('[data-testid="filter-method"]', 'crypto');
    
    const filteredRows = await page.locator('[data-testid="history-row"]:visible').count();
    expect(filteredRows).toBe(1);
    
    // Generate tax document
    await page.click('[data-testid="generate-1099"]');
    await page.selectOption('[data-testid="tax-year"]', '2024');
    await page.click('[data-testid="create-1099"]');
    
    // Wait for document generation
    await page.waitForSelector('[data-testid="1099-generated"]', { timeout: TIMEOUTS.medium });
    
    // Verify document details
    expect(await page.isVisible('[data-testid="total-earnings"]')).toBe(true);
    expect(await page.isVisible('[data-testid="tax-withheld"]')).toBe(true);
    
    // Download document
    await page.click('[data-testid="download-1099"]');
    const downloadPromise = page.waitForEvent('download');
    await downloadPromise;
  });

  test('should handle international payouts with currency conversion', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Mock international creator
    await page.evaluate(() => {
      window.mockCreatorProfile = {
        country: 'GB',
        currency: 'GBP',
        taxId: 'GB123456789'
      };
      window.mockEarnings = { availableForPayout: 250.00 };
    });
    
    await page.goto('/earnings');
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Verify currency options for UK creator
    const currencyOptions = await page.locator('[data-testid="payout-currency"] option').allTextContents();
    expect(currencyOptions).toContain('GBP');
    expect(currencyOptions).toContain('EUR');
    expect(currencyOptions).toContain('USD');
    
    // Select GBP payout
    await page.selectOption('[data-testid="payout-currency"]', 'GBP');
    
    // Verify exchange rate display
    await page.waitForSelector('[data-testid="exchange-rate"]');
    const exchangeRate = await page.textContent('[data-testid="exchange-rate"]');
    expect(exchangeRate).toMatch(/1 USD = \d+\.\d+ GBP/);
    
    // Verify converted amount
    const convertedAmount = await page.textContent('[data-testid="converted-amount"]');
    expect(convertedAmount).toContain('GBP');
    
    // Configure payout
    await page.fill('[data-testid="payout-amount"]', '200.00');
    await page.selectOption('[data-testid="payout-method"]', 'bank');
    
    // Fill international bank details
    await page.fill('[data-testid="swift-code"]', 'BARCGB22');
    await page.fill('[data-testid="iban"]', 'GB82WEST12345698765432');
    
    // Submit payout
    await page.click('[data-testid="submit-payout"]');
    
    // Verify international payout confirmation
    await page.waitForSelector('[data-testid="international-payout-requested"]');
    expect(await page.textContent('[data-testid="processing-time"]')).toContain('3-5 business days');
  });

  test('should handle payout compliance and KYC requirements', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Mock high-value payout requiring KYC
    await page.evaluate(() => {
      window.mockEarnings = { availableForPayout: 5000.00 };
      window.mockKYCStatus = { verified: false, required: true };
    });
    
    await page.goto('/earnings');
    await page.click(SELECTORS.payoutRequest);
    await page.waitForSelector('[data-testid="payout-modal"]');
    
    // Try to request large payout
    await page.fill('[data-testid="payout-amount"]', '3000.00');
    
    // Verify KYC requirement
    await page.waitForSelector('[data-testid="kyc-required"]');
    expect(await page.textContent('[data-testid="kyc-required"]')).toContain('verification required');
    
    // Verify payout is blocked
    expect(await page.isDisabled('[data-testid="submit-payout"]')).toBe(true);
    
    // Start KYC process
    await page.click('[data-testid="start-kyc"]');
    await page.waitForSelector('[data-testid="kyc-form"]');
    
    // Fill KYC information
    await page.fill('[data-testid="full-name"]', 'Test Creator');
    await page.fill('[data-testid="date-of-birth"]', '1990-01-01');
    await page.fill('[data-testid="ssn"]', '123-45-6789');
    await page.fill('[data-testid="address"]', '123 Creator St, City, ST 12345');
    
    // Upload documents
    await page.setInputFiles('[data-testid="id-document"]', {
      name: 'drivers-license.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('Mock ID document')
    });
    
    // Submit KYC
    await page.click('[data-testid="submit-kyc"]');
    
    // Mock KYC approval
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('kyc-approved', {
          detail: { verified: true }
        }));
      }, 3000);
    });
    
    // Verify KYC completion
    await page.waitForSelector('[data-testid="kyc-approved"]', { timeout: TIMEOUTS.medium });
    
    // Verify payout is now enabled
    expect(await page.isDisabled('[data-testid="submit-payout"]')).toBe(false);
  });
});