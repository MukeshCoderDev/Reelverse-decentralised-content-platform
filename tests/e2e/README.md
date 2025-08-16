# Go-Live Sprint E2E Test Suite

This comprehensive End-to-End test suite validates all critical user journeys for the go-live sprint, ensuring 100% agency-ready status.

## Overview

The test suite covers 7 critical user flows with comprehensive scenarios for each:

1. **Fiat Payment Flow** - CCBill/Segpay checkout with 3DS/SCA
2. **Gasless Payment Flow** - USDC payments with paymaster
3. **Passkey Onboarding** - Sub-15-second wallet creation
4. **Video Playback Flow** - Access control and streaming
5. **Consent Management** - Multi-participant signatures
6. **DMCA Takedown Flow** - Content moderation and appeals
7. **Payout Processing** - 48-hour SLA revenue distribution

## Quick Start

### Installation

```bash
# Install Playwright
npm run test:install

# Install dependencies
npm install
```

### Running Tests

```bash
# Run all tests
npm run test:e2e

# Run critical tests only
npm run test:e2e -- --critical

# Run specific test suite
npm run test:e2e -- --single "fiat payment"

# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Test Architecture

### Test Structure

```
tests/e2e/
├── fixtures/
│   └── test-data.ts          # Test data and constants
├── utils/
│   └── test-helpers.ts       # Reusable test utilities
├── 01-fiat-payment-flow.spec.ts
├── 02-gasless-payment-flow.spec.ts
├── 03-passkey-onboarding.spec.ts
├── 04-video-playback-flow.spec.ts
├── 05-consent-management-flow.spec.ts
├── 06-dmca-takedown-flow.spec.ts
├── 07-payout-processing-flow.spec.ts
├── global-setup.ts          # Global test setup
├── global-teardown.ts       # Global test cleanup
└── test-runner.ts           # Custom test runner
```

### Key Features

- **Mock API Responses** - All external APIs are mocked for reliable testing
- **Performance Monitoring** - Tracks SLA compliance (join time, payout processing)
- **Screenshot Capture** - Automatic screenshots on failures and key milestones
- **Cross-Browser Testing** - Chrome, Firefox, Safari, Mobile
- **Parallel Execution** - Tests run in parallel for speed
- **Retry Logic** - Automatic retries for flaky tests

## Test Scenarios

### 1. Fiat Payment Flow (01-fiat-payment-flow.spec.ts)

Tests CCBill and Segpay payment processing:

- ✅ Complete fiat payment with CCBill
- ✅ Handle payment failures gracefully
- ✅ Support Segpay as alternative processor
- ✅ Handle 3DS/SCA authentication for EU
- ✅ Apply VAT/GST correctly by region

**SLA Requirements:**
- Payment completion < 60 seconds
- 3DS challenge < 30 seconds
- Error recovery < 15 seconds

### 2. Gasless Payment Flow (02-gasless-payment-flow.spec.ts)

Tests USDC payments with paymaster:

- ✅ Complete gasless USDC payment with permit
- ✅ Handle insufficient USDC balance
- ✅ Handle permit signature rejection
- ✅ Handle paymaster failure gracefully
- ✅ Display accurate gas savings
- ✅ Support subscription payments
- ✅ Handle network congestion

**SLA Requirements:**
- Permit signing < 10 seconds
- Transaction execution < 30 seconds
- Gas savings > 80% vs regular transaction

### 3. Passkey Onboarding (03-passkey-onboarding.spec.ts)

Tests passkey wallet creation and management:

- ✅ Create passkey wallet under 15 seconds
- ✅ Handle WebAuthn not supported
- ✅ Authenticate with existing passkey
- ✅ Handle authentication failure
- ✅ Support device management
- ✅ Handle passkey recovery flow
- ✅ Measure creation performance
- ✅ Support multiple device registration

**SLA Requirements:**
- Wallet creation < 15 seconds
- Authentication < 5 seconds
- Recovery flow < 60 seconds

### 4. Video Playback Flow (04-video-playback-flow.spec.ts)

Tests content access and video streaming:

- ✅ Enforce access control for premium content
- ✅ Play video with quality selection
- ✅ Handle loading and buffering states
- ✅ Track and report playback metrics
- ✅ Handle video errors gracefully
- ✅ Support video controls and seeking
- ✅ Enforce time-based access restrictions
- ✅ Support closed captions and accessibility
- ✅ Handle concurrent viewer limits

**SLA Requirements:**
- P95 join time < 2 seconds
- Rebuffer ratio < 1%
- Quality adaptation < 5 seconds

### 5. Consent Management (05-consent-management-flow.spec.ts)

Tests multi-participant consent and signatures:

- ✅ Create multi-participant consent document
- ✅ Handle participant signature collection
- ✅ Handle signature rejection and re-signing
- ✅ Enforce identity verification requirements
- ✅ Handle consent document expiration
- ✅ Support consent document amendments
- ✅ Generate consent compliance reports
- ✅ Handle blockchain anchoring of signatures

**SLA Requirements:**
- Document creation < 30 seconds
- Signature collection < 5 minutes per participant
- Blockchain anchoring < 10 minutes

### 6. DMCA Takedown Flow (06-dmca-takedown-flow.spec.ts)

Tests content moderation and DMCA compliance:

- ✅ Submit DMCA takedown request
- ✅ Process takedown and notify creator
- ✅ Handle DMCA counter-notice submission
- ✅ Handle content restoration after counter-notice
- ✅ Handle repeat infringer policy
- ✅ Generate DMCA compliance reports
- ✅ Handle false DMCA claims and penalties
- ✅ Handle automated content matching

**SLA Requirements:**
- Takedown processing < 24 hours
- Counter-notice processing < 48 hours
- Automated screening < 1 hour

### 7. Payout Processing (07-payout-processing-flow.spec.ts)

Tests creator payouts and revenue distribution:

- ✅ Process creator payout within 48-hour SLA
- ✅ Handle revenue splits for collaborative content
- ✅ Handle payout failures and retries
- ✅ Enforce minimum payout thresholds
- ✅ Support multiple payout methods and currencies
- ✅ Track payout history and generate tax documents
- ✅ Handle international payouts with currency conversion
- ✅ Handle payout compliance and KYC requirements

**SLA Requirements:**
- Payout processing < 48 hours
- Revenue split distribution < 1 hour
- International payouts < 5 business days

## Configuration

### Environment Variables

```bash
# Base URL for testing
PLAYWRIGHT_BASE_URL=http://localhost:5173

# API endpoints
VITE_API_URL=http://localhost:3001

# Test mode flags
E2E_TEST_MODE=true
MOCK_EXTERNAL_APIS=true
```

### Browser Configuration

Tests run on multiple browsers:
- Chrome (Desktop & Mobile)
- Firefox
- Safari (Desktop & Mobile)
- Edge

### Timeouts

- Default test timeout: 60 seconds
- Payment flows: 120 seconds
- Video playback: 45 seconds
- Navigation: 30 seconds
- Element wait: 10 seconds

## Debugging

### Common Issues

1. **Test Timeouts**
   ```bash
   # Increase timeout for specific test
   test.setTimeout(120000);
   ```

2. **Element Not Found**
   ```bash
   # Use retry logic
   await helpers.waitForElementWithRetry(selector, 3);
   ```

3. **API Mocking Issues**
   ```bash
   # Check mock setup in beforeEach
   await helpers.setupApiMocks();
   ```

### Debug Commands

```bash
# Run single test with debug
npx playwright test tests/e2e/01-fiat-payment-flow.spec.ts --debug

# Run with trace
npx playwright test --trace on

# Generate test report
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

### Go/No-Go Criteria

All tests must pass for go-live approval:

- ✅ All critical user journeys working
- ✅ Payment flows (fiat & crypto) functional
- ✅ Content access control enforced
- ✅ DMCA compliance operational
- ✅ Payout processing within SLA
- ✅ Performance metrics meeting targets

## Reporting

### Test Results

Results are generated in multiple formats:
- HTML report: `test-results/index.html`
- JSON report: `test-results/results.json`
- JUnit XML: `test-results/results.xml`

### Screenshots

Automatic screenshots are captured:
- On test failures
- At key milestones
- For manual verification

Location: `test-results/screenshots/`

### Performance Metrics

Key metrics tracked:
- Page load times
- Payment processing duration
- Video join times
- API response times

## Maintenance

### Updating Tests

1. **Add new test scenario:**
   ```typescript
   test('should handle new feature', async ({ page }) => {
     // Test implementation
   });
   ```

2. **Update test data:**
   ```typescript
   // Edit tests/e2e/fixtures/test-data.ts
   export const NEW_TEST_DATA = { ... };
   ```

3. **Add new helper function:**
   ```typescript
   // Edit tests/e2e/utils/test-helpers.ts
   async newHelper(): Promise<void> { ... }
   ```

### Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Mock external APIs** to avoid flaky tests
3. **Take screenshots** at key verification points
4. **Use meaningful test names** that describe the scenario
5. **Group related tests** in describe blocks
6. **Clean up test data** in afterEach hooks
7. **Use timeouts appropriately** for different operations
8. **Verify SLA compliance** in performance-critical tests

## Support

For issues with the test suite:

1. Check the test logs in `test-results/`
2. Review screenshots for visual debugging
3. Run tests in headed mode to see browser interaction
4. Use debug mode to step through tests
5. Check mock API responses in network tab

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add appropriate test data to fixtures
3. Use the helper utilities for common operations
4. Include performance assertions where relevant
5. Add comprehensive error handling scenarios
6. Update this README with new test descriptions