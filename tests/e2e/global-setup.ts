import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:5173');
    
    // Wait for the main app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 30000 });
    console.log('✅ Application is ready');

    // Setup test data if needed
    await setupTestData(page);
    
    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function setupTestData(page: any) {
  console.log('📊 Setting up test data...');
  
  // Create test users, content, etc.
  // This would typically involve API calls to set up test data
  
  // For now, just verify the app is responsive
  await page.evaluate(() => {
    // Add test data marker to localStorage
    localStorage.setItem('e2e-test-mode', 'true');
    localStorage.setItem('test-setup-timestamp', Date.now().toString());
  });
  
  console.log('✅ Test data setup completed');
}

export default globalSetup;