# Referral and Affiliate Growth System Documentation

## Overview

The Referral and Affiliate Growth System is designed to scale user acquisition through partners, creators, and existing users. It provides comprehensive tracking, attribution, commission management, and analytics for multiple referral program types.

## System Architecture

### Core Components

1. **ReferralService** - Core referral logic and attribution tracking
2. **AffiliateDashboardService** - Analytics and dashboard functionality  
3. **AttributionTrackingMiddleware** - Frontend attribution tracking
4. **Commission Processing** - Automated payout calculations
5. **Analytics Engine** - Performance metrics and reporting

### Program Types

#### 1. User Referral Program
- **Commission**: 10% of first purchase
- **Cookie Duration**: 30 days
- **Minimum Payout**: $25 USDC
- **Target**: Existing platform users

#### 2. Creator Referral Program  
- **Commission**: 15% of first 3 months earnings
- **Cookie Duration**: 60 days
- **Minimum Payout**: $50 USDC
- **Target**: Content creators referring other creators

#### 3. Affiliate Program
- **Commission**: Tiered structure (20-35%)
- **Cookie Duration**: 90 days
- **Minimum Payout**: $100 USDC
- **Target**: Professional affiliates and marketers

#### 4. Agency Partnership Program
- **Commission**: 40% revenue share
- **Cookie Duration**: 180 days
- **Minimum Payout**: $500 USDC
- **Target**: Agencies bringing multiple creators

## API Reference

### Base URL
```
https://api.platform.com/v1/referrals
```

### Authentication
All API requests require authentication using API keys with appropriate scopes.

### Endpoints

#### Get Referral Programs
```http
GET /programs
```

Returns available referral programs with commission structures and terms.

**Response:**
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "affiliate-program-2024",
        "name": "Affiliate Program",
        "type": "affiliate_program",
        "description": "Tiered commission structure with up to 35% on all purchases",
        "commissionRate": 35,
        "cookieDuration": 90,
        "minimumPayout": 100,
        "isActive": true
      }
    ]
  }
}
```

#### Generate Referral Code
```http
POST /codes
```

**Request Body:**
```json
{
  "programId": "affiliate-program-2024",
  "referrerType": "affiliate",
  "customCode": "MYCODE123",
  "usageLimit": 1000,
  "expiresAt": "2024-12-31T23:59:59Z",
  "metadata": {
    "campaignName": "Q4 Promotion"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "code-uuid",
    "code": "MYCODE123",
    "programId": "affiliate-program-2024",
    "isActive": true,
    "usageLimit": 1000,
    "usageCount": 0,
    "expiresAt": "2024-12-31T23:59:59Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Track Attribution
```http
POST /track
```

**Request Body:**
```json
{
  "referralCode": "MYCODE123",
  "sessionId": "session-12345",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "source": "google",
  "medium": "cpc",
  "campaign": "winter-sale",
  "landingPage": "https://platform.com/signup?ref=MYCODE123"
}
```

#### Convert Attribution
```http
POST /convert
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "sessionId": "session-12345",
  "conversionValue": 99.99,
  "conversionType": "purchase"
}
```

#### Generate Referral Link
```http
POST /links
```

**Request Body:**
```json
{
  "referralCode": "MYCODE123",
  "targetPath": "/premium",
  "utmSource": "affiliate",
  "utmMedium": "banner",
  "utmCampaign": "q4-promo"
}
```

#### Get Analytics
```http
GET /analytics/{referrerId}?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "totalReferrals": 150,
      "conversions": 45,
      "conversionRate": 30,
      "totalCommission": 2250.50,
      "pendingCommission": 450.25,
      "topPerformingCodes": [
        {
          "code": "MYCODE123",
          "referrals": 50,
          "conversions": 18,
          "commission": 900
        }
      ]
    }
  }
}
```

#### Get Dashboard Metrics
```http
GET /dashboard/{affiliateId}?startDate=2024-01-01&endDate=2024-01-31
```

Returns comprehensive dashboard metrics including overview, performance, payouts, and referral codes.

#### Get Real-time Metrics
```http
GET /dashboard/{affiliateId}/realtime
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "todayClicks": 125,
      "todayConversions": 8,
      "todayEarnings": 400.00,
      "liveVisitors": 23,
      "recentConversions": [
        {
          "timestamp": "2024-01-15T10:25:00Z",
          "amount": 49.99,
          "referralCode": "MYCODE123"
        }
      ]
    }
  }
}
```

## Frontend Integration

### Attribution Tracking Middleware

The system includes Express middleware for automatic attribution tracking:

```javascript
import { trackAttribution, trackPageView, trackConversion } from './middleware/AttributionTrackingMiddleware';

// Apply to all routes
app.use(trackAttribution);
app.use(trackPageView);

// Apply to conversion endpoints
app.post('/purchase', trackConversion('purchase'), handlePurchase);
app.post('/subscribe', trackConversion('subscription'), handleSubscription);
```

### Client-Side Tracking

#### Basic Attribution Tracking
```javascript
// Automatically tracks referral codes from URL parameters
// No additional code needed - handled by middleware
```

#### Manual Conversion Tracking
```javascript
// Track conversion after successful purchase
fetch('/api/v1/referrals/convert', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  },
  body: JSON.stringify({
    userId: 'user-uuid',
    sessionId: sessionStorage.getItem('sessionId'),
    conversionValue: 99.99,
    conversionType: 'purchase'
  })
});
```

#### Generate Tracking Links
```javascript
async function generateTrackingLink(referralCode, targetUrl, campaign) {
  const response = await fetch('/api/v1/referrals/tracking-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      referralCode,
      targetUrl,
      campaignName: campaign
    })
  });
  
  const data = await response.json();
  return data.data.trackingLink;
}
```

## Commission Structure

### Tiered Commission Example (Affiliate Program)

| Referrals | Commission Rate |
|-----------|----------------|
| 0-9       | 20%           |
| 10-49     | 25%           |
| 50-99     | 30%           |
| 100+      | 35%           |

### Recurring Commissions

- **User Referral**: 1 month
- **Creator Referral**: 3 months  
- **Affiliate Program**: 6 months
- **Agency Partnership**: 12 months

## Payout Processing

### Automated Payout Schedule

- **Frequency**: Monthly (15th of each month)
- **Minimum Thresholds**: Vary by program type
- **Payment Methods**: USDC (primary), PayPal, Bank Transfer
- **Processing Time**: 1-3 business days

### Payout Calculation Logic

```javascript
function calculateCommission(program, conversionValue, referrerStats) {
  switch (program.commissionStructure.type) {
    case 'percentage':
      return (conversionValue * program.commissionStructure.value) / 100;
    
    case 'tiered':
      const tier = findApplicableTier(referrerStats.totalReferrals, program.tiers);
      return (conversionValue * tier.commissionRate) / 100;
    
    case 'fixed':
      return program.commissionStructure.value;
  }
}
```

## Analytics and Reporting

### Key Metrics Tracked

#### Performance Metrics
- Click-through rates (CTR)
- Conversion rates
- Earnings per click (EPC)
- Average order value (AOV)
- Customer lifetime value (CLV)

#### Attribution Metrics
- First-click attribution
- Last-click attribution
- Multi-touch attribution
- Cross-device tracking

#### Funnel Analysis
- Clicks → Signups
- Signups → First Purchase
- First Purchase → Repeat Purchase
- Retention rates by referral source

### Dashboard Features

#### Overview Dashboard
- Total earnings (lifetime, monthly, daily)
- Pending commissions
- Active referral codes
- Conversion rates
- Top performing links

#### Performance Analytics
- Daily/monthly performance charts
- Conversion funnel visualization
- Geographic performance data
- Device and browser analytics
- Traffic source breakdown

#### Payout Management
- Payout history
- Next payout date and amount
- Payment method management
- Tax form collection (W-9/W-8BEN)

## Marketing Materials

### Available Asset Types

#### Banner Ads
- Standard sizes (728x90, 300x250, 160x600)
- Animated GIFs and static images
- Mobile-optimized versions
- A/B tested creative variations

#### Text Links
- Pre-written copy with high conversion rates
- Multiple call-to-action variations
- Localized versions for different markets

#### Email Templates
- Welcome sequences
- Promotional campaigns
- Newsletter templates
- Automated drip campaigns

#### Social Media Assets
- Instagram story templates
- Twitter card optimized images
- Facebook ad creative
- TikTok video templates

### Performance Tracking

Each marketing material includes:
- Performance score (1-10)
- Conversion rate data
- A/B test results
- Usage analytics
- Optimization recommendations

## Advanced Features

### Cross-Domain Attribution

Track referrals across multiple domains:

```javascript
// Generate cross-domain attribution link
const crossDomainData = {
  referralCode: 'MYCODE123',
  source: 'affiliate',
  medium: 'banner',
  campaign: 'q4-promo',
  timestamp: new Date().toISOString()
};

const encodedData = btoa(JSON.stringify(crossDomainData));
const crossDomainUrl = `https://platform.com/?xref=${encodedData}`;
```

### A/B Testing Integration

```javascript
// Assign consistent A/B test variants based on referral code
app.use(attributionABTest('checkout-flow', ['variant-a', 'variant-b']));
```

### Fraud Prevention

#### Detection Methods
- Velocity checks (IP, device, fingerprint)
- Pattern analysis for suspicious activity
- Cookie stuffing detection
- Click fraud prevention
- Duplicate conversion filtering

#### Risk Scoring
- Real-time risk assessment
- Machine learning-based detection
- Manual review queue for high-risk conversions
- Automatic blocking of fraudulent sources

## Integration Examples

### E-commerce Platform Integration

```javascript
// Track product page views with attribution
app.get('/product/:id', trackAttribution, (req, res) => {
  if (req.attribution?.referralCode) {
    // Log product interest for attribution
    analytics.track('product_viewed', {
      productId: req.params.id,
      referralCode: req.attribution.referralCode,
      sessionId: req.attribution.sessionId
    });
  }
  
  res.render('product', { 
    product: getProduct(req.params.id),
    attribution: res.locals.attribution 
  });
});

// Track purchases with commission calculation
app.post('/checkout', trackConversion('purchase'), async (req, res) => {
  const order = await processOrder(req.body);
  
  // Commission will be automatically calculated and attributed
  // via the trackConversion middleware
  
  res.json({ 
    success: true, 
    orderId: order.id,
    attribution: res.locals.attribution 
  });
});
```

### Creator Platform Integration

```javascript
// Track creator signups
app.post('/creator/signup', trackConversion('creator_signup'), async (req, res) => {
  const creator = await createCreatorAccount(req.body);
  
  // Track creator signup conversion
  // Commission will be calculated based on future creator earnings
  
  res.json({ 
    success: true, 
    creatorId: creator.id 
  });
});
```

## Monitoring and Alerts

### Key Alerts

#### Performance Alerts
- Conversion rate drops below threshold
- Unusual traffic patterns detected
- High refund/chargeback rates
- Affiliate performance degradation

#### Fraud Alerts
- Suspicious click patterns
- High-risk IP addresses
- Duplicate conversions
- Cookie stuffing attempts

#### System Alerts
- Attribution tracking failures
- Commission calculation errors
- Payout processing issues
- API rate limit breaches

### Monitoring Dashboard

Real-time monitoring includes:
- Attribution success rates
- Conversion tracking accuracy
- Commission calculation health
- Payout processing status
- Fraud detection metrics

## Best Practices

### For Affiliates

#### Link Optimization
- Use descriptive campaign names
- Test different landing pages
- Optimize for mobile traffic
- Track performance by traffic source

#### Content Strategy
- Create valuable, relevant content
- Disclose affiliate relationships
- Focus on user experience
- Build trust with audience

### For Platform Operators

#### Program Management
- Regular commission structure reviews
- Performance-based tier adjustments
- Fraud monitoring and prevention
- Timely payout processing

#### Analytics and Optimization
- A/B test commission structures
- Monitor attribution accuracy
- Optimize conversion funnels
- Analyze customer lifetime value

## Troubleshooting

### Common Issues

#### Attribution Not Tracking
```bash
# Check middleware configuration
curl -H "X-Session-ID: test-session" \
  "https://platform.com/?ref=TESTCODE123"

# Verify referral code exists
curl -H "Authorization: Bearer $API_KEY" \
  "https://api.platform.com/v1/referrals/codes/TESTCODE123"
```

#### Conversions Not Converting
```bash
# Check attribution exists for session
curl -H "Authorization: Bearer $API_KEY" \
  -d '{"sessionId":"test-session"}' \
  "https://api.platform.com/v1/referrals/check-attribution"
```

#### Commission Calculation Issues
```bash
# Verify program configuration
curl -H "Authorization: Bearer $API_KEY" \
  "https://api.platform.com/v1/referrals/programs/affiliate-program-2024"
```

### Debug Mode

Enable debug logging for detailed attribution tracking:

```javascript
// Set environment variable
process.env.REFERRAL_DEBUG = 'true';

// Or configure in code
referralService.setDebugMode(true);
```

## Security Considerations

### Data Protection
- PII encryption at rest and in transit
- GDPR/CCPA compliance for attribution data
- Secure API key management
- Regular security audits

### Fraud Prevention
- Rate limiting on API endpoints
- IP-based blocking for suspicious activity
- Machine learning fraud detection
- Manual review processes

### Attribution Integrity
- Cryptographic signatures for cross-domain attribution
- Tamper-proof attribution cookies
- Server-side validation of all conversions
- Audit trails for all commission calculations

## Support and Resources

### Documentation
- API Reference: `/docs/api/referrals`
- Integration Guides: `/docs/integration`
- Best Practices: `/docs/best-practices`

### Support Channels
- Technical Support: api-support@platform.com
- Affiliate Support: affiliates@platform.com
- Documentation: docs.platform.com/referrals

### Developer Resources
- SDK Downloads: github.com/platform/referral-sdk
- Code Examples: github.com/platform/referral-examples
- Postman Collection: Available in API docs