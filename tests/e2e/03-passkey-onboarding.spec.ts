import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_USERS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Passkey Onboarding Flow', () => {
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

  test('should create passkey wallet under 15 seconds', async ({ page }) => {
    test.setTimeout(TIMEOUTS.long);
    
    const startTime = Date.now();
    
    // Step 1: Navigate to wallet creation
    await page.goto('/wallet');
    await page.waitForSelector('[data-testid="wallet-options"]');
    
    // Step 2: Select passkey wallet option
    await page.click('[data-testid="create-passkey-wallet"]');
    
    // Step 3: Enter email
    await page.waitForSelector('[data-testid="email-input"]');
    await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
    
    // Step 4: Mock WebAuthn support check
    await page.evaluate(() => {
      // Mock WebAuthn availability
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async (options) => {
            // Simulate realistic creation time (2-3 seconds)
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            return {
              id: 'test-credential-' + Date.now(),
              rawId: new ArrayBuffer(32),
              response: {
                attestationObject: new ArrayBuffer(64),
                clientDataJSON: new ArrayBuffer(32)
              },
              type: 'public-key'
            };
          }
        }
      });
    });
    
    // Step 5: Create passkey
    await page.click('[data-testid="create-passkey"]');
    
    // Step 6: Wait for passkey creation UI
    await page.waitForSelector('[data-testid="passkey-creation-progress"]');
    
    // Step 7: Wait for wallet creation completion
    await page.waitForSelector('[data-testid="wallet-created"]', { timeout: 20000 });
    
    const creationTime = Date.now() - startTime;
    console.log(`Passkey wallet created in ${creationTime}ms`);
    
    // Step 8: Verify creation time is under 15 seconds
    expect(creationTime).toBeLessThan(15000);
    
    // Step 9: Verify wallet address is displayed
    await page.waitForSelector('[data-testid="wallet-address"]');
    const walletAddress = await page.textContent('[data-testid="wallet-address"]');
    expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    
    // Step 10: Verify backup options are presented
    expect(await page.isVisible('[data-testid="backup-options"]')).toBe(true);
    expect(await page.isVisible('[data-testid="recovery-email"]')).toBe(true);
    
    await helpers.takeTimestampedScreenshot('passkey-wallet-created');
  });

  test('should handle WebAuthn not supported gracefully', async ({ page }) => {
    // Mock WebAuthn not supported
    await page.evaluate(() => {
      delete (navigator as any).credentials;
    });
    
    await page.goto('/wallet');
    await page.click('[data-testid="create-passkey-wallet"]');
    
    // Verify fallback message
    await page.waitForSelector('[data-testid="webauthn-not-supported"]');
    expect(await page.textContent('[data-testid="webauthn-not-supported"]')).toContain('not supported');
    
    // Verify alternative options are shown
    expect(await page.isVisible('[data-testid="alternative-wallet-options"]')).toBe(true);
  });

  test('should authenticate with existing passkey', async ({ page }) => {
    // Step 1: Create passkey wallet first
    await helpers.createPasskeyWallet(TEST_USERS.creator.email);
    
    // Step 2: Navigate away and back
    await page.goto('/');
    await page.goto('/wallet');
    
    // Step 3: Click sign in with passkey
    await page.click('[data-testid="signin-passkey"]');
    
    // Step 4: Enter email
    await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
    
    // Step 5: Mock WebAuthn authentication
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'credentials', {
        value: {
          get: async (options) => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return {
              id: 'test-credential-123',
              rawId: new ArrayBuffer(32),
              response: {
                authenticatorData: new ArrayBuffer(32),
                clientDataJSON: new ArrayBuffer(32),
                signature: new ArrayBuffer(64)
              },
              type: 'public-key'
            };
          }
        }
      });
    });
    
    // Step 6: Authenticate
    await page.click('[data-testid="authenticate-passkey"]');
    
    // Step 7: Wait for authentication success
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: TIMEOUTS.medium });
    
    // Step 8: Verify wallet access
    expect(await page.isVisible('[data-testid="wallet-dashboard"]')).toBe(true);
    expect(await page.isVisible('[data-testid="wallet-address"]')).toBe(true);
  });

  test('should handle passkey authentication failure', async ({ page }) => {
    await page.goto('/wallet');
    await page.click('[data-testid="signin-passkey"]');
    await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
    
    // Mock authentication failure
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'credentials', {
        value: {
          get: async () => {
            throw new Error('Authentication failed');
          }
        }
      });
    });
    
    await page.click('[data-testid="authenticate-passkey"]');
    
    // Verify error handling
    await page.waitForSelector('[data-testid="auth-error"]');
    expect(await page.textContent('[data-testid="auth-error"]')).toContain('failed');
    
    // Verify retry option
    expect(await page.isVisible('[data-testid="retry-auth"]')).toBe(true);
  });

  test('should support device management and passkey listing', async ({ page }) => {
    // Create passkey wallet
    await helpers.createPasskeyWallet(TEST_USERS.creator.email);
    
    // Navigate to device management
    await page.goto('/settings/devices');
    
    // Verify passkey is listed
    await page.waitForSelector('[data-testid="passkey-list"]');
    expect(await page.isVisible('[data-testid="passkey-item"]')).toBe(true);
    
    // Verify device info is shown
    const deviceInfo = await page.textContent('[data-testid="device-info"]');
    expect(deviceInfo).toContain('Created');
    expect(deviceInfo).toContain('Last used');
    
    // Test passkey revocation
    await page.click('[data-testid="revoke-passkey"]');
    await page.waitForSelector('[data-testid="confirm-revoke"]');
    await page.click('[data-testid="confirm-revoke"]');
    
    // Verify passkey is removed
    await page.waitForSelector('[data-testid="passkey-revoked"]');
    expect(await page.isVisible('[data-testid="passkey-item"]')).toBe(false);
  });

  test('should handle passkey recovery flow', async ({ page }) => {
    // Create passkey wallet with recovery email
    await helpers.createPasskeyWallet(TEST_USERS.creator.email);
    
    // Navigate to recovery
    await page.goto('/wallet/recovery');
    
    // Enter recovery email
    await page.fill('[data-testid="recovery-email"]', TEST_USERS.creator.email);
    await page.click('[data-testid="send-recovery"]');
    
    // Mock recovery email sent
    await page.waitForSelector('[data-testid="recovery-sent"]');
    
    // Mock recovery link click (simulate email link)
    await page.goto('/wallet/recovery/verify?token=test-recovery-token');
    
    // Verify recovery options
    await page.waitForSelector('[data-testid="recovery-options"]');
    expect(await page.isVisible('[data-testid="create-new-passkey"]')).toBe(true);
    expect(await page.isVisible('[data-testid="backup-wallet-access"]')).toBe(true);
    
    // Test creating new passkey
    await page.click('[data-testid="create-new-passkey"]');
    
    // Mock new passkey creation
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async () => ({
            id: 'new-recovery-credential',
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
    
    await page.click('[data-testid="confirm-new-passkey"]');
    
    // Verify recovery success
    await page.waitForSelector('[data-testid="recovery-complete"]');
    expect(await page.isVisible('[data-testid="wallet-dashboard"]')).toBe(true);
  });

  test('should measure and report passkey creation performance', async ({ page }) => {
    // Enable performance monitoring
    await page.evaluate(() => {
      window.passkeyMetrics = {
        startTime: 0,
        endTime: 0,
        steps: []
      };
    });
    
    await page.goto('/wallet');
    await page.click('[data-testid="create-passkey-wallet"]');
    await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
    
    // Mock performance tracking
    await page.evaluate(() => {
      window.passkeyMetrics.startTime = performance.now();
    });
    
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async () => {
            const start = performance.now();
            await new Promise(resolve => setTimeout(resolve, 3000));
            const end = performance.now();
            
            window.passkeyMetrics.steps.push({
              step: 'webauthn_create',
              duration: end - start
            });
            
            return {
              id: 'perf-test-credential',
              rawId: new ArrayBuffer(32),
              response: {
                attestationObject: new ArrayBuffer(64),
                clientDataJSON: new ArrayBuffer(32)
              },
              type: 'public-key'
            };
          }
        }
      });
    });
    
    await page.click('[data-testid="create-passkey"]');
    await page.waitForSelector('[data-testid="wallet-created"]');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      window.passkeyMetrics.endTime = performance.now();
      return window.passkeyMetrics;
    });
    
    const totalTime = metrics.endTime - metrics.startTime;
    console.log(`Total passkey creation time: ${totalTime}ms`);
    console.log('Performance breakdown:', metrics.steps);
    
    // Verify performance meets SLA
    expect(totalTime).toBeLessThan(15000); // 15 second SLA
    
    // Verify WebAuthn step is reasonable
    const webauthnStep = metrics.steps.find(s => s.step === 'webauthn_create');
    expect(webauthnStep?.duration).toBeLessThan(10000); // WebAuthn should be under 10s
  });

  test('should support multiple device registration', async ({ page }) => {
    // Create initial passkey
    await helpers.createPasskeyWallet(TEST_USERS.creator.email);
    
    // Navigate to device management
    await page.goto('/settings/devices');
    
    // Add second device
    await page.click('[data-testid="add-device"]');
    
    // Mock second device passkey creation
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async () => ({
            id: 'second-device-credential',
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
    
    await page.click('[data-testid="create-device-passkey"]');
    
    // Verify second device is added
    await page.waitForSelector('[data-testid="device-added"]');
    
    // Verify both devices are listed
    const deviceCount = await page.locator('[data-testid="passkey-item"]').count();
    expect(deviceCount).toBe(2);
  });
});