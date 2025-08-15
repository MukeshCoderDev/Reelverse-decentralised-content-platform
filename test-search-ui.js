#!/usr/bin/env node

/**
 * Integration test script for enhanced search UI components
 * This script tests the search UI functionality and AI integration
 */

const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testSearchUI() {
  console.log('🔍 Testing Enhanced Search UI...\n');

  let browser;
  let page;

  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: false, // Set to true for CI/CD
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Enable request interception to mock API responses
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/ai/search/')) {
        // Mock search API response
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              query: 'test query',
              results: [
                {
                  contentId: 'test-content-1',
                  relevanceScore: 0.92,
                  matchedTags: ['blonde', 'bedroom', 'romantic'],
                  snippet: 'A beautiful romantic scene in a bedroom setting',
                  metadata: {
                    title: 'Romantic Bedroom Scene',
                    description: 'A beautiful and intimate romantic scene',
                    category: 'adult',
                    creatorId: 'creator-1',
                    creatorName: 'Test Creator',
                    createdAt: new Date().toISOString(),
                    duration: 480,
                    viewCount: 15420,
                    ageRestricted: true
                  },
                  aiTags: [
                    { tag: 'blonde', confidence: 0.95, category: 'visual' },
                    { tag: 'bedroom', confidence: 0.88, category: 'scene' },
                    { tag: 'romantic', confidence: 0.91, category: 'setting' }
                  ]
                }
              ],
              total: 1,
              searchType: 'hybrid'
            }
          })
        });
      } else if (request.url().includes('/api/v1/ai/similar/')) {
        // Mock similar content API response
        request.respond({
          status: 'success',
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              contentId: 'test-content-1',
              similarContent: [
                {
                  contentId: 'similar-1',
                  relevanceScore: 0.87,
                  matchedTags: ['romantic', 'intimate'],
                  metadata: {
                    title: 'Similar Content 1',
                    description: 'Another romantic scene',
                    category: 'adult',
                    creatorId: 'creator-2',
                    creatorName: 'Another Creator',
                    createdAt: new Date().toISOString(),
                    duration: 360,
                    viewCount: 8930,
                    ageRestricted: true
                  }
                }
              ],
              total: 1
            }
          })
        });
      } else {
        request.continue();
      }
    });

    // Navigate to the search page
    console.log('1. Navigating to search page...');
    await page.goto(`${BASE_URL}/search`);
    await page.waitForSelector('[data-testid="enhanced-search-engine"]', { timeout: 10000 });
    console.log('   ✅ Search page loaded');

    // Test 1: Basic search functionality
    console.log('\n2. Testing basic search functionality...');
    const searchInput = await page.$('input[placeholder*="AI-powered"]');
    if (searchInput) {
      await searchInput.type('romantic bedroom');
      await page.keyboard.press('Enter');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 });
      console.log('   ✅ Search executed successfully');
      
      // Check for AI indicators
      const aiIndicator = await page.$('[data-testid="ai-indicator"]');
      if (aiIndicator) {
        console.log('   ✅ AI indicator displayed');
      }
    }

    // Test 2: Search suggestions
    console.log('\n3. Testing AI-powered search suggestions...');
    await searchInput.clear();
    await searchInput.type('blo');
    
    // Wait for suggestions dropdown
    await page.waitForSelector('[data-testid="search-suggestions"]', { timeout: 3000 });
    const suggestions = await page.$$('[data-testid="suggestion-item"]');
    
    if (suggestions.length > 0) {
      console.log(`   ✅ ${suggestions.length} suggestions displayed`);
      
      // Check for AI-generated suggestions
      const aiSuggestions = await page.$$('[data-testid="ai-suggestion"]');
      if (aiSuggestions.length > 0) {
        console.log(`   ✅ ${aiSuggestions.length} AI-generated suggestions found`);
      }
    }

    // Test 3: Search filters
    console.log('\n4. Testing enhanced search filters...');
    const filterButton = await page.$('[data-testid="filter-button"]');
    if (filterButton) {
      await filterButton.click();
      
      // Wait for filters panel
      await page.waitForSelector('[data-testid="filters-panel"]', { timeout: 3000 });
      
      // Test search type filter
      const searchTypeSelect = await page.$('select[data-testid="search-type"]');
      if (searchTypeSelect) {
        await searchTypeSelect.select('semantic');
        console.log('   ✅ Search type filter works');
      }
      
      // Test confidence threshold slider
      const confidenceSlider = await page.$('input[type="range"][data-testid="confidence-slider"]');
      if (confidenceSlider) {
        await confidenceSlider.evaluate(slider => slider.value = '0.8');
        console.log('   ✅ Confidence threshold slider works');
      }
    }

    // Test 4: Search results display
    console.log('\n5. Testing search results display...');
    const searchResults = await page.$$('[data-testid="search-result-item"]');
    
    if (searchResults.length > 0) {
      console.log(`   ✅ ${searchResults.length} search results displayed`);
      
      // Check for confidence scores
      const confidenceScores = await page.$$('[data-testid="confidence-score"]');
      if (confidenceScores.length > 0) {
        console.log('   ✅ Confidence scores displayed');
      }
      
      // Check for AI tags
      const aiTags = await page.$$('[data-testid="ai-tag"]');
      if (aiTags.length > 0) {
        console.log('   ✅ AI-generated tags displayed');
      }
      
      // Test result expansion
      const expandButton = await page.$('[data-testid="expand-result"]');
      if (expandButton) {
        await expandButton.click();
        
        const expandedContent = await page.$('[data-testid="expanded-content"]');
        if (expandedContent) {
          console.log('   ✅ Result expansion works');
        }
      }
    }

    // Test 5: Related content
    console.log('\n6. Testing related content functionality...');
    const relatedButton = await page.$('[data-testid="related-content-button"]');
    if (relatedButton) {
      await relatedButton.click();
      
      // Wait for related content to load
      await page.waitForSelector('[data-testid="related-content"]', { timeout: 5000 });
      
      const relatedItems = await page.$$('[data-testid="related-item"]');
      if (relatedItems.length > 0) {
        console.log(`   ✅ ${relatedItems.length} related content items displayed`);
      }
    }

    // Test 6: Search analytics
    console.log('\n7. Testing search analytics...');
    const analyticsButton = await page.$('[data-testid="analytics-button"]');
    if (analyticsButton) {
      await analyticsButton.click();
      
      // Wait for analytics to load
      await page.waitForSelector('[data-testid="search-analytics"]', { timeout: 5000 });
      
      const metricsCards = await page.$$('[data-testid="metric-card"]');
      if (metricsCards.length > 0) {
        console.log(`   ✅ ${metricsCards.length} analytics metrics displayed`);
      }
    }

    console.log('\n✅ Enhanced Search UI tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Search UI test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (page) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'search-ui-error.png', fullPage: true });
      console.log('   Screenshot saved as search-ui-error.png');
    }
    
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Performance test for search UI
async function performanceTest() {
  console.log('\n🚀 Running search UI performance test...\n');

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();

    // Enable performance monitoring
    await page.tracing.start({ path: 'search-ui-trace.json' });

    const startTime = Date.now();

    // Navigate and perform search operations
    await page.goto(`${BASE_URL}/search`);
    await page.waitForSelector('input[placeholder*="AI-powered"]');

    // Measure search input responsiveness
    const inputStartTime = Date.now();
    await page.type('input[placeholder*="AI-powered"]', 'performance test query');
    const inputEndTime = Date.now();

    // Measure search execution time
    const searchStartTime = Date.now();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    const searchEndTime = Date.now();

    const totalTime = Date.now() - startTime;

    await page.tracing.stop();

    console.log(`✅ Performance test completed:`);
    console.log(`   Total page load time: ${totalTime}ms`);
    console.log(`   Search input responsiveness: ${inputEndTime - inputStartTime}ms`);
    console.log(`   Search execution time: ${searchEndTime - searchStartTime}ms`);

    // Performance thresholds
    const thresholds = {
      pageLoad: 3000,
      inputResponse: 100,
      searchExecution: 2000,
    };

    let passed = true;
    if (totalTime > thresholds.pageLoad) {
      console.log(`   ⚠️  Page load time exceeds threshold (${thresholds.pageLoad}ms)`);
      passed = false;
    }
    if (inputEndTime - inputStartTime > thresholds.inputResponse) {
      console.log(`   ⚠️  Input response time exceeds threshold (${thresholds.inputResponse}ms)`);
      passed = false;
    }
    if (searchEndTime - searchStartTime > thresholds.searchExecution) {
      console.log(`   ⚠️  Search execution time exceeds threshold (${thresholds.searchExecution}ms)`);
      passed = false;
    }

    if (passed) {
      console.log('   🎉 All performance thresholds met!');
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Accessibility test
async function accessibilityTest() {
  console.log('\n♿ Running accessibility test...\n');

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();

    await page.goto(`${BASE_URL}/search`);
    await page.waitForSelector('input[placeholder*="AI-powered"]');

    // Test keyboard navigation
    console.log('Testing keyboard navigation...');
    await page.keyboard.press('Tab'); // Focus search input
    await page.keyboard.press('Tab'); // Focus filter button
    await page.keyboard.press('Tab'); // Focus search button
    console.log('   ✅ Keyboard navigation works');

    // Test ARIA labels and roles
    console.log('Testing ARIA attributes...');
    const searchInput = await page.$('input[aria-label]');
    const searchButton = await page.$('button[aria-label*="search"]');
    
    if (searchInput && searchButton) {
      console.log('   ✅ ARIA labels present');
    } else {
      console.log('   ⚠️  Missing ARIA labels');
    }

    // Test color contrast (basic check)
    console.log('Testing color contrast...');
    const styles = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="AI-powered"]');
      const computed = window.getComputedStyle(input);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
      };
    });
    
    console.log(`   Input colors: ${styles.color} on ${styles.backgroundColor}`);

    console.log('✅ Accessibility test completed');

  } catch (error) {
    console.error('❌ Accessibility test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance') || args.includes('-p')) {
    await performanceTest();
  } else if (args.includes('--accessibility') || args.includes('-a')) {
    await accessibilityTest();
  } else if (args.includes('--all')) {
    await testSearchUI();
    await performanceTest();
    await accessibilityTest();
  } else {
    await testSearchUI();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSearchUI, performanceTest, accessibilityTest };