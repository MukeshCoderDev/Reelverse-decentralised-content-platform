import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONTENT, SELECTORS, TIMEOUTS } from './fixtures/test-data';

test.describe('Video Playback and Access Control Flow', () => {
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

  test('should enforce access control for premium content', async ({ page }) => {
    // Step 1: Navigate to premium content without authentication
    await page.goto('/content/premium-video-1');
    
    // Step 2: Verify paywall is shown
    await page.waitForSelector('[data-testid="paywall"]');
    expect(await page.isVisible('[data-testid="paywall"]')).toBe(true);
    
    // Step 3: Verify video player is not accessible
    expect(await page.isVisible(SELECTORS.videoPlayer)).toBe(false);
    
    // Step 4: Verify preview/trailer is available
    expect(await page.isVisible('[data-testid="content-preview"]')).toBe(true);
    
    // Step 5: Connect wallet and authenticate
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Step 6: Purchase content
    await helpers.purchaseContentWithFiat('premium-video-1');
    
    // Step 7: Verify paywall is removed
    expect(await page.isVisible('[data-testid="paywall"]')).toBe(false);
    
    // Step 8: Verify video player is now accessible
    await page.waitForSelector(SELECTORS.videoPlayer);
    expect(await page.isVisible(SELECTORS.videoPlayer)).toBe(true);
    
    await helpers.takeTimestampedScreenshot('access-control-success');
  });

  test('should play video with proper quality selection', async ({ page }) => {
    // Setup authenticated user with content access
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    // Navigate to content
    await page.goto('/content/test-video-1');
    await page.waitForSelector(SELECTORS.videoPlayer);
    
    // Step 1: Start video playback
    await page.click('[data-testid="play-button"]');
    
    // Step 2: Wait for video to start playing
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && !video.paused && video.currentTime > 0;
    }, { timeout: TIMEOUTS.video });
    
    // Step 3: Verify video quality options
    await page.click('[data-testid="quality-selector"]');
    await page.waitForSelector('[data-testid="quality-options"]');
    
    const qualityOptions = await page.locator('[data-testid="quality-option"]').allTextContents();
    expect(qualityOptions).toContain('1080p');
    expect(qualityOptions).toContain('720p');
    expect(qualityOptions).toContain('480p');
    
    // Step 4: Change quality to 720p
    await page.click('[data-testid="quality-720p"]');
    
    // Step 5: Verify quality change
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.videoHeight === 720;
    }, { timeout: TIMEOUTS.medium });
    
    // Step 6: Test adaptive bitrate
    await page.evaluate(() => {
      // Simulate network slowdown
      (navigator as any).connection = { effectiveType: '3g' };
      window.dispatchEvent(new Event('online'));
    });
    
    // Verify quality adapts down
    await page.waitForTimeout(3000);
    const currentQuality = await page.textContent('[data-testid="current-quality"]');
    expect(['480p', '360p']).toContain(currentQuality);
  });

  test('should handle video loading and buffering states', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    await page.goto('/content/test-video-1');
    
    // Step 1: Verify loading state
    await page.waitForSelector('[data-testid="video-loading"]');
    expect(await page.isVisible('[data-testid="video-loading"]')).toBe(true);
    
    // Step 2: Wait for video to load
    await page.waitForSelector(SELECTORS.videoPlayer);
    expect(await page.isVisible('[data-testid="video-loading"]')).toBe(false);
    
    // Step 3: Start playback
    await page.click('[data-testid="play-button"]');
    
    // Step 4: Simulate buffering
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.dispatchEvent(new Event('waiting'));
      }
    });
    
    // Step 5: Verify buffering indicator
    await page.waitForSelector('[data-testid="buffering-indicator"]');
    expect(await page.isVisible('[data-testid="buffering-indicator"]')).toBe(true);
    
    // Step 6: Resume playback
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.dispatchEvent(new Event('canplay'));
      }
    });
    
    // Step 7: Verify buffering indicator disappears
    await page.waitForSelector('[data-testid="buffering-indicator"]', { state: 'hidden' });
  });

  test('should track and report playback metrics', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    // Enable metrics collection
    await page.evaluate(() => {
      window.playbackMetrics = {
        joinTime: 0,
        rebufferEvents: [],
        qualityChanges: [],
        errors: []
      };
    });
    
    const startTime = Date.now();
    
    await page.goto('/content/test-video-1');
    await page.waitForSelector(SELECTORS.videoPlayer);
    
    // Measure join time
    await page.click('[data-testid="play-button"]');
    
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      const isPlaying = video && !video.paused && video.currentTime > 0;
      
      if (isPlaying && !window.playbackMetrics.joinTime) {
        window.playbackMetrics.joinTime = Date.now() - window.startTime;
      }
      
      return isPlaying;
    }, { timeout: TIMEOUTS.video });
    
    // Get metrics
    const metrics = await page.evaluate(() => window.playbackMetrics);
    
    console.log('Playback metrics:', metrics);
    
    // Verify join time meets SLA (< 2 seconds)
    expect(metrics.joinTime).toBeLessThan(2000);
    
    // Simulate rebuffer event
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const rebufferStart = Date.now();
        video.dispatchEvent(new Event('waiting'));
        
        setTimeout(() => {
          const rebufferEnd = Date.now();
          window.playbackMetrics.rebufferEvents.push({
            start: rebufferStart,
            duration: rebufferEnd - rebufferStart
          });
          video.dispatchEvent(new Event('canplay'));
        }, 500);
      }
    });
    
    await page.waitForTimeout(1000);
    
    const finalMetrics = await page.evaluate(() => window.playbackMetrics);
    
    // Verify rebuffer tracking
    expect(finalMetrics.rebufferEvents.length).toBeGreaterThan(0);
    expect(finalMetrics.rebufferEvents[0].duration).toBeLessThan(1000);
  });

  test('should handle video errors gracefully', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    await page.goto('/content/test-video-1');
    await page.waitForSelector(SELECTORS.videoPlayer);
    
    // Simulate video error
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const error = new Event('error');
        (error as any).target = { error: { code: 3, message: 'Network error' } };
        video.dispatchEvent(error);
      }
    });
    
    // Verify error handling
    await page.waitForSelector('[data-testid="video-error"]');
    expect(await page.textContent('[data-testid="video-error"]')).toContain('error');
    
    // Verify retry option
    expect(await page.isVisible('[data-testid="retry-video"]')).toBe(true);
    
    // Test retry functionality
    await page.click('[data-testid="retry-video"]');
    
    // Verify video reloads
    await page.waitForSelector('[data-testid="video-loading"]');
    await page.waitForSelector(SELECTORS.videoPlayer);
  });

  test('should support video controls and seeking', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    await page.goto('/content/test-video-1');
    await page.waitForSelector(SELECTORS.videoPlayer);
    
    // Start playback
    await page.click('[data-testid="play-button"]');
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && !video.paused;
    });
    
    // Test pause
    await page.click('[data-testid="pause-button"]');
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.paused;
    });
    
    // Test volume control
    await page.click('[data-testid="volume-button"]');
    await page.waitForSelector('[data-testid="volume-slider"]');
    
    // Set volume to 50%
    await page.click('[data-testid="volume-slider"]', { position: { x: 50, y: 10 } });
    
    const volume = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.volume : 0;
    });
    expect(volume).toBeCloseTo(0.5, 1);
    
    // Test seeking
    await page.click('[data-testid="progress-bar"]', { position: { x: 100, y: 10 } });
    
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.currentTime > 10;
    });
    
    // Test fullscreen
    await page.click('[data-testid="fullscreen-button"]');
    
    const isFullscreen = await page.evaluate(() => {
      return document.fullscreenElement !== null;
    });
    expect(isFullscreen).toBe(true);
  });

  test('should enforce time-based access restrictions', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    
    // Mock expired entitlement
    await page.route('**/api/v1/payments/entitlement/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hasEntitlement: false,
            expired: true,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        })
      });
    });
    
    await page.goto('/content/subscription-video-1');
    
    // Verify access denied for expired subscription
    await page.waitForSelector('[data-testid="subscription-expired"]');
    expect(await page.textContent('[data-testid="subscription-expired"]')).toContain('expired');
    
    // Verify renewal option
    expect(await page.isVisible('[data-testid="renew-subscription"]')).toBe(true);
  });

  test('should support closed captions and accessibility', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    await page.goto('/content/test-video-1');
    await page.waitForSelector(SELECTORS.videoPlayer);
    
    // Enable closed captions
    await page.click('[data-testid="cc-button"]');
    await page.waitForSelector('[data-testid="cc-menu"]');
    
    // Select English captions
    await page.click('[data-testid="cc-english"]');
    
    // Start playback
    await page.click('[data-testid="play-button"]');
    
    // Verify captions are displayed
    await page.waitForSelector('[data-testid="video-captions"]');
    expect(await page.isVisible('[data-testid="video-captions"]')).toBe(true);
    
    // Test keyboard navigation
    await page.keyboard.press('Space'); // Pause/play
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.paused;
    });
    
    await page.keyboard.press('ArrowRight'); // Seek forward
    await page.keyboard.press('ArrowLeft'); // Seek backward
    
    // Test screen reader support
    const videoElement = await page.locator('video');
    expect(await videoElement.getAttribute('aria-label')).toBeTruthy();
  });

  test('should handle concurrent viewer limits', async ({ page }) => {
    await helpers.connectAndAuthenticateWallet('consumer');
    await helpers.purchaseContentWithFiat('test-video-1');
    
    // Mock concurrent viewer limit reached
    await page.route('**/api/v1/content/*/stream', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Concurrent viewer limit reached',
          retryAfter: 30
        })
      });
    });
    
    await page.goto('/content/test-video-1');
    await page.click('[data-testid="play-button"]');
    
    // Verify limit message
    await page.waitForSelector('[data-testid="viewer-limit"]');
    expect(await page.textContent('[data-testid="viewer-limit"]')).toContain('limit');
    
    // Verify retry timer
    expect(await page.isVisible('[data-testid="retry-timer"]')).toBe(true);
  });
});