import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONSENT, TEST_USERS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Consent Management and Multi-Participant Signature Flow', () => {
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

  test('should create multi-participant consent document', async ({ page }) => {
    test.setTimeout(TIMEOUTS.long);

    // Step 1: Connect as content creator
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Step 2: Navigate to consent creation
    await page.goto('/studio/consent');
    await page.waitForSelector('[data-testid="consent-dashboard"]');
    
    // Step 3: Start new consent document
    await page.click('[data-testid="create-consent"]');
    await page.waitForSelector(SELECTORS.consentForm);
    
    // Step 4: Fill basic consent information
    await page.fill('[data-testid="content-title"]', 'Test Multi-Participant Content');
    await page.fill('[data-testid="content-description"]', 'Test content requiring multi-participant consent');
    
    // Step 5: Add participants
    for (const participant of TEST_CONSENT.multiParticipant.participants) {
      await page.click('[data-testid="add-participant"]');
      
      const participantRow = page.locator('[data-testid="participant-row"]').last();
      await participantRow.locator('[data-testid="participant-name"]').fill(participant.name);
      await participantRow.locator('[data-testid="participant-email"]').fill(participant.email);
      await participantRow.locator('[data-testid="participant-wallet"]').fill(participant.walletAddress);
    }
    
    // Step 6: Set consent terms
    await page.fill('[data-testid="consent-terms"]', TEST_CONSENT.multiParticipant.consentTerms);
    
    // Step 7: Configure consent requirements
    await page.check('[data-testid="require-all-signatures"]');
    await page.check('[data-testid="require-identity-verification"]');
    await page.selectOption('[data-testid="consent-duration"]', '365'); // 1 year
    
    // Step 8: Create consent document
    await page.click('[data-testid="create-consent-doc"]');
    
    // Step 9: Wait for consent document creation
    await page.waitForSelector('[data-testid="consent-created"]', { timeout: TIMEOUTS.medium });
    
    // Step 10: Verify consent document details
    const consentId = await page.textContent('[data-testid="consent-id"]');
    expect(consentId).toMatch(/^consent_[a-zA-Z0-9]+$/);
    
    // Step 11: Verify participant list
    const participantCount = await page.locator('[data-testid="participant-item"]').count();
    expect(participantCount).toBe(TEST_CONSENT.multiParticipant.participants.length);
    
    // Step 12: Verify signature status
    expect(await page.isVisible('[data-testid="pending-signatures"]')).toBe(true);
    
    await helpers.takeTimestampedScreenshot('consent-document-created');
  });

  test('should handle participant signature collection', async ({ page }) => {
    // Step 1: Create consent document as creator
    await helpers.connectAndAuthenticateWallet('creator');
    await helpers.createMultiParticipantConsent([
      TEST_CONSENT.multiParticipant.participants[0].email,
      TEST_CONSENT.multiParticipant.participants[1].email
    ]);
    
    // Get consent ID from URL or storage
    const consentId = await page.evaluate(() => {
      return localStorage.getItem('test-consent-id') || 'test-consent-123';
    });
    
    // Step 2: Simulate first participant signing
    await page.goto(`/consent/sign/${consentId}`);
    
    // Mock participant 1 wallet connection
    await page.evaluate((address) => {
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, TEST_CONSENT.multiParticipant.participants[0].walletAddress);
    
    // Step 3: Review consent terms
    await page.waitForSelector('[data-testid="consent-review"]');
    expect(await page.textContent('[data-testid="consent-terms-display"]')).toContain(TEST_CONSENT.multiParticipant.consentTerms);
    
    // Step 4: Verify identity (mock)
    await page.click('[data-testid="verify-identity"]');
    await page.waitForSelector('[data-testid="identity-verified"]');
    
    // Step 5: Sign consent
    await page.click('[data-testid="sign-consent"]');
    
    // Mock signature process
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('signature-complete', {
          detail: {
            signature: '0x' + 'a'.repeat(130),
            timestamp: Date.now()
          }
        }));
      }, 2000);
    });
    
    // Step 6: Wait for signature confirmation
    await page.waitForSelector('[data-testid="signature-confirmed"]', { timeout: TIMEOUTS.medium });
    
    // Step 7: Verify signature recorded
    expect(await page.textContent('[data-testid="signature-status"]')).toContain('signed');
    
    // Step 8: Simulate second participant signing
    await page.goto(`/consent/sign/${consentId}`);
    
    // Mock participant 2 wallet connection
    await page.evaluate((address) => {
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, TEST_CONSENT.multiParticipant.participants[1].walletAddress);
    
    await page.waitForSelector('[data-testid="consent-review"]');
    await page.click('[data-testid="verify-identity"]');
    await page.waitForSelector('[data-testid="identity-verified"]');
    await page.click('[data-testid="sign-consent"]');
    
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('signature-complete', {
          detail: {
            signature: '0x' + 'b'.repeat(130),
            timestamp: Date.now()
          }
        }));
      }, 2000);
    });
    
    // Step 9: Wait for all signatures complete
    await page.waitForSelector('[data-testid="all-signatures-complete"]', { timeout: TIMEOUTS.medium });
    
    // Step 10: Verify consent is fully executed
    expect(await page.textContent('[data-testid="consent-status"]')).toContain('executed');
  });

  test('should handle signature rejection and re-signing', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    await helpers.createMultiParticipantConsent([TEST_USERS.consumer.email]);
    
    const consentId = 'test-consent-rejection';
    await page.goto(`/consent/sign/${consentId}`);
    
    // Connect participant wallet
    await page.evaluate((address) => {
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, TEST_USERS.consumer.walletAddress);
    
    await page.waitForSelector('[data-testid="consent-review"]');
    await page.click('[data-testid="verify-identity"]');
    await page.waitForSelector('[data-testid="identity-verified"]');
    
    // Reject consent
    await page.click('[data-testid="reject-consent"]');
    
    // Provide rejection reason
    await page.waitForSelector('[data-testid="rejection-reason"]');
    await page.fill('[data-testid="rejection-reason"]', 'Terms are not acceptable');
    await page.click('[data-testid="confirm-rejection"]');
    
    // Verify rejection recorded
    await page.waitForSelector('[data-testid="consent-rejected"]');
    expect(await page.textContent('[data-testid="rejection-status"]')).toContain('rejected');
    
    // Test re-signing after terms update
    await page.goto(`/consent/sign/${consentId}?updated=true`);
    
    await page.waitForSelector('[data-testid="consent-updated"]');
    expect(await page.isVisible('[data-testid="changes-highlighted"]')).toBe(true);
    
    // Sign updated consent
    await page.click('[data-testid="sign-consent"]');
    
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('signature-complete', {
          detail: { signature: '0x' + 'c'.repeat(130) }
        }));
      }, 1500);
    });
    
    await page.waitForSelector('[data-testid="signature-confirmed"]');
    expect(await page.textContent('[data-testid="signature-status"]')).toContain('signed');
  });

  test('should enforce identity verification requirements', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    await helpers.createMultiParticipantConsent([TEST_USERS.consumer.email]);
    
    const consentId = 'test-consent-verification';
    await page.goto(`/consent/sign/${consentId}`);
    
    // Connect wallet
    await page.evaluate((address) => {
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, TEST_USERS.consumer.walletAddress);
    
    await page.waitForSelector('[data-testid="consent-review"]');
    
    // Try to sign without identity verification
    await page.click('[data-testid="sign-consent"]');
    
    // Verify identity verification is required
    await page.waitForSelector('[data-testid="identity-required"]');
    expect(await page.textContent('[data-testid="identity-required"]')).toContain('identity verification');
    
    // Complete identity verification
    await page.click('[data-testid="verify-identity"]');
    
    // Mock identity verification process
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('identity-verified', {
          detail: {
            verified: true,
            method: 'government_id',
            timestamp: Date.now()
          }
        }));
      }, 3000);
    });
    
    await page.waitForSelector('[data-testid="identity-verified"]');
    
    // Now signing should be allowed
    await page.click('[data-testid="sign-consent"]');
    
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('signature-complete', {
          detail: { signature: '0x' + 'd'.repeat(130) }
        }));
      }, 1500);
    });
    
    await page.waitForSelector('[data-testid="signature-confirmed"]');
  });

  test('should handle consent document expiration', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Create consent with short expiration for testing
    await page.goto('/studio/consent');
    await page.click('[data-testid="create-consent"]');
    await page.waitForSelector(SELECTORS.consentForm);
    
    await page.fill('[data-testid="content-title"]', 'Expiring Consent Test');
    await page.click('[data-testid="add-participant"]');
    await page.fill('[data-testid="participant-email"]', TEST_USERS.consumer.email);
    await page.fill('[data-testid="consent-terms"]', 'Test consent with expiration');
    
    // Set short expiration (1 minute for testing)
    await page.selectOption('[data-testid="consent-duration"]', '1'); // 1 minute
    
    await page.click('[data-testid="create-consent-doc"]');
    await page.waitForSelector('[data-testid="consent-created"]');
    
    const consentId = await page.textContent('[data-testid="consent-id"]');
    
    // Mock time passing (simulate expiration)
    await page.evaluate(() => {
      // Fast-forward time
      const originalNow = Date.now;
      Date.now = () => originalNow() + 2 * 60 * 1000; // 2 minutes later
    });
    
    // Try to sign expired consent
    await page.goto(`/consent/sign/${consentId}`);
    
    // Verify expiration message
    await page.waitForSelector('[data-testid="consent-expired"]');
    expect(await page.textContent('[data-testid="consent-expired"]')).toContain('expired');
    
    // Verify signing is disabled
    expect(await page.isDisabled('[data-testid="sign-consent"]')).toBe(true);
  });

  test('should support consent document amendments', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    await helpers.createMultiParticipantConsent([TEST_USERS.consumer.email]);
    
    // Navigate to consent management
    await page.goto('/studio/consent');
    await page.waitForSelector('[data-testid="consent-list"]');
    
    // Select consent document to amend
    await page.click('[data-testid="consent-item"]:first-child');
    await page.waitForSelector('[data-testid="consent-details"]');
    
    // Create amendment
    await page.click('[data-testid="create-amendment"]');
    await page.waitForSelector('[data-testid="amendment-form"]');
    
    // Add amendment details
    await page.fill('[data-testid="amendment-reason"]', 'Updated terms for clarity');
    await page.fill('[data-testid="amended-terms"]', 'Updated consent terms with additional clarity');
    
    // Submit amendment
    await page.click('[data-testid="submit-amendment"]');
    
    // Verify amendment created
    await page.waitForSelector('[data-testid="amendment-created"]');
    
    // Verify participants are notified
    expect(await page.isVisible('[data-testid="participants-notified"]')).toBe(true);
    
    // Verify new signature round is required
    expect(await page.textContent('[data-testid="signature-status"]')).toContain('pending');
  });

  test('should generate consent compliance reports', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    
    // Navigate to consent reporting
    await page.goto('/studio/consent/reports');
    await page.waitForSelector('[data-testid="consent-reports"]');
    
    // Generate compliance report
    await page.click('[data-testid="generate-report"]');
    
    // Select report parameters
    await page.selectOption('[data-testid="report-type"]', 'compliance');
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-12-31');
    
    await page.click('[data-testid="create-report"]');
    
    // Wait for report generation
    await page.waitForSelector('[data-testid="report-generated"]', { timeout: TIMEOUTS.medium });
    
    // Verify report contents
    expect(await page.isVisible('[data-testid="consent-summary"]')).toBe(true);
    expect(await page.isVisible('[data-testid="signature-statistics"]')).toBe(true);
    expect(await page.isVisible('[data-testid="compliance-status"]')).toBe(true);
    
    // Test report export
    await page.click('[data-testid="export-report"]');
    
    // Verify download initiated
    const downloadPromise = page.waitForEvent('download');
    await downloadPromise;
  });

  test('should handle blockchain anchoring of consent signatures', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('creator');
    await helpers.createMultiParticipantConsent([TEST_USERS.consumer.email]);
    
    const consentId = 'test-consent-blockchain';
    await page.goto(`/consent/sign/${consentId}`);
    
    // Connect and sign
    await page.evaluate((address) => {
      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: { address }
      }));
    }, TEST_USERS.consumer.walletAddress);
    
    await page.waitForSelector('[data-testid="consent-review"]');
    await page.click('[data-testid="verify-identity"]');
    await page.waitForSelector('[data-testid="identity-verified"]');
    await page.click('[data-testid="sign-consent"]');
    
    // Mock signature and blockchain anchoring
    await page.evaluate(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('signature-complete', {
          detail: { signature: '0x' + 'e'.repeat(130) }
        }));
      }, 1500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('blockchain-anchored', {
          detail: {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            blockNumber: 12345678,
            merkleRoot: '0x' + 'f'.repeat(64)
          }
        }));
      }, 5000);
    });
    
    await page.waitForSelector('[data-testid="signature-confirmed"]');
    
    // Wait for blockchain anchoring
    await page.waitForSelector('[data-testid="blockchain-anchored"]', { timeout: TIMEOUTS.medium });
    
    // Verify blockchain proof
    expect(await page.isVisible('[data-testid="blockchain-proof"]')).toBe(true);
    
    const txHash = await page.textContent('[data-testid="tx-hash"]');
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    
    // Verify Merkle proof availability
    expect(await page.isVisible('[data-testid="merkle-proof"]')).toBe(true);
  });
});