import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_DMCA, TEST_USERS, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('DMCA Takedown and Content Moderation Flow', () => {
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

  test('should submit DMCA takedown request', async ({ page }) => {
    test.setTimeout(TIMEOUTS.long);

    // Step 1: Navigate to DMCA takedown form
    await page.goto('/dmca/takedown');
    await page.waitForSelector(SELECTORS.dmcaForm);
    
    // Step 2: Fill complainant information
    await page.fill('[data-testid="complainant-name"]', TEST_DMCA.takedownRequest.complainant);
    await page.fill('[data-testid="complainant-email"]', TEST_DMCA.takedownRequest.email);
    await page.fill('[data-testid="complainant-address"]', '123 Copyright St, Legal City, LC 12345');
    await page.fill('[data-testid="complainant-phone"]', '+1-555-123-4567');
    
    // Step 3: Identify infringing content
    await page.fill('[data-testid="content-url"]', `https://platform.com/content/${TEST_DMCA.takedownRequest.contentId}`);
    await page.fill('[data-testid="content-description"]', TEST_DMCA.takedownRequest.description);
    
    // Step 4: Describe copyrighted work
    await page.fill('[data-testid="copyrighted-work"]', TEST_DMCA.takedownRequest.copyrightedWork);
    await page.fill('[data-testid="infringement-claim"]', TEST_DMCA.takedownRequest.infringementClaim);
    
    // Step 5: Upload supporting evidence
    await page.setInputFiles('[data-testid="evidence-upload"]', {
      name: 'copyright-evidence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF evidence content')
    });
    
    // Step 6: Verify good faith statement
    await page.check('[data-testid="good-faith-statement"]');
    await page.check('[data-testid="accuracy-statement"]');
    await page.check('[data-testid="authority-statement"]');
    
    // Step 7: Add digital signature
    await page.fill('[data-testid="digital-signature"]', TEST_DMCA.takedownRequest.complainant);
    
    // Step 8: Submit takedown request
    await page.click(SELECTORS.takedownButton);
    
    // Step 9: Wait for submission confirmation
    await page.waitForSelector('[data-testid="takedown-submitted"]', { timeout: TIMEOUTS.medium });
    
    // Step 10: Verify takedown ID is generated
    const takedownId = await page.textContent('[data-testid="takedown-id"]');
    expect(takedownId).toMatch(/^DMCA-\d{4}-\d{6}$/);
    
    // Step 11: Verify confirmation email notice
    expect(await page.isVisible('[data-testid="confirmation-email-sent"]')).toBe(true);
    
    await helpers.takeTimestampedScreenshot('dmca-takedown-submitted');
  });

  test('should process DMCA takedown and notify content creator', async ({ page }) => {
    // Step 1: Submit takedown request (admin view)
    await page.goto('/admin/dmca');
    await page.waitForSelector('[data-testid="dmca-queue"]');
    
    // Mock pending takedown request
    await page.evaluate(() => {
      window.mockDMCARequest = {
        id: 'DMCA-2024-000001',
        status: 'pending',
        contentId: 'test-video-1',
        complainant: 'Test Copyright Holder',
        submittedAt: new Date().toISOString()
      };
    });
    
    // Step 2: Review takedown request
    await page.click('[data-testid="review-takedown"]:first-child');
    await page.waitForSelector('[data-testid="takedown-details"]');
    
    // Step 3: Verify request completeness
    expect(await page.isVisible('[data-testid="complainant-info"]')).toBe(true);
    expect(await page.isVisible('[data-testid="infringement-details"]')).toBe(true);
    expect(await page.isVisible('[data-testid="evidence-files"]')).toBe(true);
    
    // Step 4: Approve takedown
    await page.click('[data-testid="approve-takedown"]');
    await page.fill('[data-testid="takedown-reason"]', 'Valid copyright infringement claim');
    await page.click('[data-testid="confirm-takedown"]');
    
    // Step 5: Verify content is taken down
    await page.waitForSelector('[data-testid="content-removed"]');
    expect(await page.textContent('[data-testid="takedown-status"]')).toContain('approved');
    
    // Step 6: Verify creator notification
    expect(await page.isVisible('[data-testid="creator-notified"]')).toBe(true);
    
    // Step 7: Check content is inaccessible
    await page.goto('/content/test-video-1');
    await page.waitForSelector('[data-testid="content-unavailable"]');
    expect(await page.textContent('[data-testid="unavailable-reason"]')).toContain('DMCA');
  });

  test('should handle DMCA counter-notice submission', async ({ page }) => {
    // Step 1: Navigate to counter-notice form (as content creator)
    await helpers.connectAndAuthenticateWallet('creator');
    await page.goto('/dmca/counter-notice/DMCA-2024-000001');
    
    await page.waitForSelector(SELECTORS.counterNoticeForm);
    
    // Step 2: Review original takedown request
    expect(await page.isVisible('[data-testid="original-takedown"]')).toBe(true);
    
    // Step 3: Fill counter-notice information
    await page.fill('[data-testid="creator-name"]', 'Test Content Creator');
    await page.fill('[data-testid="creator-email"]', TEST_USERS.creator.email);
    await page.fill('[data-testid="creator-address"]', '456 Creator Ave, Content City, CC 67890');
    
    // Step 4: Provide counter-statement
    await page.fill('[data-testid="counter-statement"]', TEST_DMCA.counterNotice.statement);
    await page.fill('[data-testid="contact-info"]', TEST_DMCA.counterNotice.contactInfo);
    
    // Step 5: Upload supporting evidence
    await page.setInputFiles('[data-testid="counter-evidence"]', {
      name: 'fair-use-evidence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock counter-evidence content')
    });
    
    // Step 6: Legal statements
    await page.check('[data-testid="good-faith-counter"]');
    await page.check('[data-testid="jurisdiction-consent"]');
    await page.check('[data-testid="perjury-statement"]');
    
    // Step 7: Digital signature
    await page.fill('[data-testid="counter-signature"]', 'Test Content Creator');
    
    // Step 8: Submit counter-notice
    await page.click('[data-testid="submit-counter-notice"]');
    
    // Step 9: Wait for submission confirmation
    await page.waitForSelector('[data-testid="counter-notice-submitted"]', { timeout: TIMEOUTS.medium });
    
    // Step 10: Verify counter-notice ID
    const counterNoticeId = await page.textContent('[data-testid="counter-notice-id"]');
    expect(counterNoticeId).toMatch(/^CN-\d{4}-\d{6}$/);
    
    // Step 11: Verify 10-14 day restoration notice
    expect(await page.textContent('[data-testid="restoration-timeline"]')).toContain('10-14 business days');
  });

  test('should handle content restoration after counter-notice period', async ({ page }) => {
    // Step 1: Admin view of counter-notice
    await page.goto('/admin/dmca/counter-notices');
    await page.waitForSelector('[data-testid="counter-notice-queue"]');
    
    // Step 2: Review counter-notice
    await page.click('[data-testid="review-counter-notice"]:first-child');
    await page.waitForSelector('[data-testid="counter-notice-details"]');
    
    // Step 3: Verify counter-notice completeness
    expect(await page.isVisible('[data-testid="creator-info"]')).toBe(true);
    expect(await page.isVisible('[data-testid="counter-statement"]')).toBe(true);
    expect(await page.isVisible('[data-testid="legal-statements"]')).toBe(true);
    
    // Step 4: Forward to original complainant
    await page.click('[data-testid="forward-to-complainant"]');
    await page.waitForSelector('[data-testid="complainant-notified"]');
    
    // Step 5: Mock 14-day waiting period completion
    await page.evaluate(() => {
      // Fast-forward time by 14 days
      const originalNow = Date.now;
      Date.now = () => originalNow() + 14 * 24 * 60 * 60 * 1000;
    });
    
    // Step 6: Check for court action
    await page.goto('/admin/dmca/counter-notices/CN-2024-000001');
    await page.waitForSelector('[data-testid="waiting-period-complete"]');
    
    // Step 7: Restore content (no court action filed)
    await page.click('[data-testid="restore-content"]');
    await page.fill('[data-testid="restoration-reason"]', 'No court action filed within 14 days');
    await page.click('[data-testid="confirm-restoration"]');
    
    // Step 8: Verify content restoration
    await page.waitForSelector('[data-testid="content-restored"]');
    
    // Step 9: Check content is accessible again
    await page.goto('/content/test-video-1');
    await page.waitForSelector('[data-testid="video-player"]');
    expect(await page.isVisible('[data-testid="content-unavailable"]')).toBe(false);
  });

  test('should handle repeat infringer policy', async ({ page }) => {
    // Step 1: Admin view of user with multiple DMCA strikes
    await page.goto('/admin/users/repeat-infringers');
    await page.waitForSelector('[data-testid="repeat-infringer-list"]');
    
    // Step 2: Review user with 2 strikes
    await page.click('[data-testid="user-strikes"]:first-child');
    await page.waitForSelector('[data-testid="user-strike-history"]');
    
    // Step 3: Verify strike history
    const strikeCount = await page.locator('[data-testid="strike-item"]').count();
    expect(strikeCount).toBe(2);
    
    // Step 4: Add third strike (triggers account termination)
    await page.click('[data-testid="add-strike"]');
    await page.fill('[data-testid="strike-reason"]', 'Third DMCA violation - repeat infringer');
    await page.click('[data-testid="confirm-strike"]');
    
    // Step 5: Verify account termination
    await page.waitForSelector('[data-testid="account-terminated"]');
    expect(await page.textContent('[data-testid="termination-reason"]')).toContain('repeat infringer');
    
    // Step 6: Verify user notification
    expect(await page.isVisible('[data-testid="termination-notice-sent"]')).toBe(true);
    
    // Step 7: Test account access restriction
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'repeat-infringer@test.com');
    await page.click('[data-testid="login"]');
    
    await page.waitForSelector('[data-testid="account-terminated-message"]');
    expect(await page.textContent('[data-testid="account-terminated-message"]')).toContain('terminated');
  });

  test('should generate DMCA compliance reports', async ({ page }) => {
    // Step 1: Navigate to DMCA reporting
    await page.goto('/admin/dmca/reports');
    await page.waitForSelector('[data-testid="dmca-reports"]');
    
    // Step 2: Generate monthly report
    await page.click('[data-testid="generate-monthly-report"]');
    await page.selectOption('[data-testid="report-month"]', '2024-01');
    await page.click('[data-testid="create-report"]');
    
    // Step 3: Wait for report generation
    await page.waitForSelector('[data-testid="report-generated"]', { timeout: TIMEOUTS.medium });
    
    // Step 4: Verify report contents
    expect(await page.isVisible('[data-testid="takedown-statistics"]')).toBe(true);
    expect(await page.isVisible('[data-testid="counter-notice-statistics"]')).toBe(true);
    expect(await page.isVisible('[data-testid="restoration-statistics"]')).toBe(true);
    expect(await page.isVisible('[data-testid="repeat-infringer-statistics"]')).toBe(true);
    
    // Step 5: Verify compliance metrics
    const responseTime = await page.textContent('[data-testid="avg-response-time"]');
    expect(responseTime).toMatch(/\d+\.\d+ hours/);
    
    const complianceRate = await page.textContent('[data-testid="compliance-rate"]');
    expect(complianceRate).toMatch(/\d+\.\d+%/);
    
    // Step 6: Export report
    await page.click('[data-testid="export-report"]');
    const downloadPromise = page.waitForEvent('download');
    await downloadPromise;
  });

  test('should handle false DMCA claims and penalties', async ({ page }) => {
    // Step 1: Admin review of suspicious takedown
    await page.goto('/admin/dmca/review/DMCA-2024-000002');
    await page.waitForSelector('[data-testid="takedown-analysis"]');
    
    // Step 2: Flag as potentially false claim
    await page.click('[data-testid="flag-false-claim"]');
    await page.fill('[data-testid="false-claim-reason"]', 'No evidence of copyright ownership provided');
    await page.click('[data-testid="confirm-flag"]');
    
    // Step 3: Investigate claim
    await page.click('[data-testid="investigate-claim"]');
    await page.waitForSelector('[data-testid="investigation-tools"]');
    
    // Step 4: Verify copyright ownership
    await page.click('[data-testid="verify-ownership"]');
    await page.waitForSelector('[data-testid="ownership-check-failed"]');
    
    // Step 5: Reject false claim
    await page.click('[data-testid="reject-takedown"]');
    await page.fill('[data-testid="rejection-reason"]', 'Insufficient evidence of copyright ownership');
    await page.click('[data-testid="confirm-rejection"]');
    
    // Step 6: Apply penalty to false claimant
    await page.click('[data-testid="apply-penalty"]');
    await page.selectOption('[data-testid="penalty-type"]', 'warning');
    await page.fill('[data-testid="penalty-reason"]', 'False DMCA claim - first offense');
    await page.click('[data-testid="confirm-penalty"]');
    
    // Step 7: Verify penalty applied
    await page.waitForSelector('[data-testid="penalty-applied"]');
    expect(await page.textContent('[data-testid="penalty-status"]')).toContain('warning issued');
    
    // Step 8: Notify affected parties
    expect(await page.isVisible('[data-testid="creator-notified-rejection"]')).toBe(true);
    expect(await page.isVisible('[data-testid="claimant-notified-penalty"]')).toBe(true);
  });

  test('should handle automated content matching and pre-screening', async ({ page }) => {
    // Step 1: Admin view of automated screening
    await page.goto('/admin/dmca/automated-screening');
    await page.waitForSelector('[data-testid="screening-dashboard"]');
    
    // Step 2: Review content match alerts
    expect(await page.isVisible('[data-testid="content-matches"]')).toBe(true);
    
    // Step 3: Check high-confidence match
    await page.click('[data-testid="high-confidence-match"]:first-child');
    await page.waitForSelector('[data-testid="match-details"]');
    
    // Step 4: Verify match accuracy
    const matchScore = await page.textContent('[data-testid="match-score"]');
    expect(parseFloat(matchScore!.replace('%', ''))).toBeGreaterThan(95);
    
    // Step 5: Auto-approve high-confidence match
    await page.click('[data-testid="auto-approve-match"]');
    await page.waitForSelector('[data-testid="auto-takedown-initiated"]');
    
    // Step 6: Verify automated takedown
    expect(await page.textContent('[data-testid="takedown-method"]')).toContain('automated');
    
    // Step 7: Check false positive handling
    await page.click('[data-testid="review-false-positives"]');
    await page.waitForSelector('[data-testid="false-positive-queue"]');
    
    const falsePositiveRate = await page.textContent('[data-testid="false-positive-rate"]');
    expect(parseFloat(falsePositiveRate!.replace('%', ''))).toBeLessThan(5);
  });
});