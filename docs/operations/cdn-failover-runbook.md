# CDN Failover Runbook

## Overview

This runbook provides step-by-step procedures for handling CDN failures, executing manual failovers, and recovering from outages. The multi-CDN infrastructure is designed for automatic failover, but manual intervention may be required in certain scenarios.

## CDN Infrastructure Overview

### Primary CDN Providers
1. **Cloudflare** (Priority 1) - Primary CDN
2. **AWS CloudFront** (Priority 2) - Secondary CDN  
3. **BunnyCDN** (Priority 3) - Tertiary CDN

### Automatic Failover Triggers
- 3 consecutive health check failures
- Response time > 5 seconds
- Error rate > 5% over 5-minute window
- Regional compliance violations

## Emergency Procedures

### 1. Immediate Response (0-5 minutes)

#### Check System Status
```bash
# Check CDN health status
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/health

# Check active alerts
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/alerts
```

#### Verify Automatic Failover
```bash
# Check current primary CDN
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/status | jq '.data.currentPrimary'

# Check recent failover events
grep "CDN failover" /var/log/platform/cdn.log | tail -10
```

### 2. Manual Failover (5-10 minutes)

If automatic failover hasn't occurred or is insufficient:

#### Force Failover to Secondary CDN
```javascript
// Using Node.js admin script
const { multiCDNService } = require('./src/services/cdn/MultiCDNService');

// Force failover to AWS CloudFront
await multiCDNService.forceFailover('aws_cloudfront', 'manual_intervention');
```

#### Update DNS Records (if needed)
```bash
# Update DNS to point to backup CDN
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-failover.json
```

### 3. Communication (0-15 minutes)

#### Internal Notifications
```bash
# Send Slack alert
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 CDN Failover Executed: Primary CDN down, switched to backup"}' \
  $SLACK_WEBHOOK_URL

# Update status page
curl -X POST -H "Authorization: Bearer $STATUS_API_KEY" \
  -d '{"status":"partial_outage","message":"CDN issues - investigating"}' \
  https://api.statuspage.io/v1/pages/$PAGE_ID/incidents
```

#### Customer Communication
- Update status page with incident details
- Send email notifications to enterprise customers
- Post updates on social media if widespread impact

## Detailed Procedures

### Health Check Failure Investigation

#### Step 1: Verify CDN Provider Status
```bash
# Check Cloudflare status
curl -s https://www.cloudflarestatus.com/api/v2/status.json

# Check AWS CloudFront status  
aws support describe-service-health --service-codes cloudfront

# Check BunnyCDN status
curl -s https://status.bunnycdn.com/api/v2/status.json
```

#### Step 2: Test CDN Endpoints Manually
```bash
# Test primary CDN
curl -I -w "%{http_code} %{time_total}s\n" \
  https://cdn.platform.com/health

# Test secondary CDN
curl -I -w "%{http_code} %{time_total}s\n" \
  https://d123456789.cloudfront.net/health

# Test tertiary CDN
curl -I -w "%{http_code} %{time_total}s\n" \
  https://platform.b-cdn.net/health
```

#### Step 3: Check Regional Performance
```bash
# Test from different regions using monitoring service
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/regional-compliance
```

### Manual Failover Procedures

#### Scenario 1: Primary CDN Complete Outage
```bash
# 1. Confirm outage scope
curl -f https://cdn.platform.com/health || echo "Primary CDN down"

# 2. Check secondary CDN health
curl -f https://d123456789.cloudfront.net/health && echo "Secondary CDN healthy"

# 3. Execute failover
node scripts/cdn-failover.js --to=aws_cloudfront --reason="primary_outage"

# 4. Verify failover success
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/status | jq '.data.currentPrimary'

# 5. Test content delivery
curl -I https://d123456789.cloudfront.net/content/test-video.mp4
```

#### Scenario 2: Regional CDN Issues
```bash
# 1. Identify affected regions
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/performance | jq '.data.providers[]'

# 2. Check regional compliance
node scripts/test-regional-access.js --region=EU

# 3. Update regional routing if needed
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://regional-failover-eu.json
```

### Recovery Procedures

#### Primary CDN Recovery
```bash
# 1. Verify primary CDN is healthy
for i in {1..5}; do
  curl -f https://cdn.platform.com/health && echo "Check $i: OK" || echo "Check $i: FAIL"
  sleep 30
done

# 2. Test content delivery
curl -I https://cdn.platform.com/content/test-video.mp4

# 3. Gradually shift traffic back
node scripts/cdn-recovery.js --from=aws_cloudfront --to=cloudflare --percentage=25

# 4. Monitor for 15 minutes
watch -n 30 'curl -s -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/performance | jq ".data.providers[] | select(.provider==\"cloudflare\")"'

# 5. Complete recovery if stable
node scripts/cdn-recovery.js --from=aws_cloudfront --to=cloudflare --percentage=100
```

## Monitoring and Alerting

### Key Metrics to Monitor
- Response time (target: < 2 seconds)
- Error rate (target: < 1%)
- Cache hit ratio (target: > 90%)
- Bandwidth utilization
- Regional availability

### Alert Thresholds
```yaml
critical_alerts:
  - cdn_completely_down: immediate
  - error_rate_above_10_percent: immediate
  - response_time_above_10_seconds: immediate

warning_alerts:
  - error_rate_above_5_percent: 5_minutes
  - response_time_above_5_seconds: 5_minutes
  - cache_hit_ratio_below_80_percent: 15_minutes
```

### Monitoring Commands
```bash
# Real-time CDN performance
watch -n 10 'curl -s -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/performance | jq ".data.providers[]"'

# Alert history
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/alerts | jq '.data.alerts[]'

# Performance trends
curl -H "Authorization: Bearer $API_KEY" \
  "https://api.platform.com/v1/cdn/performance?timeRange=3600" | \
  jq '.data.providers[] | {provider, avgResponseTime, avgErrorRate}'
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: High Error Rate on Single CDN
```bash
# Diagnosis
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/performance | \
  jq '.data.providers[] | select(.avgErrorRate > 5)'

# Solution: Temporary traffic shift
node scripts/cdn-traffic-shift.js --from=cloudflare --to=aws_cloudfront --duration=1800
```

#### Issue: Slow Response Times
```bash
# Diagnosis
curl -w "@curl-format.txt" -s -o /dev/null https://cdn.platform.com/content/test.mp4

# Solution: Check origin server performance
curl -w "@curl-format.txt" -s -o /dev/null https://origin.platform.com/content/test.mp4
```

#### Issue: Regional Blocking
```bash
# Diagnosis
node scripts/test-regional-access.js --all-regions

# Solution: Update regional routing
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://unblock-region.json
```

### Escalation Procedures

#### Level 1: Automatic Response (0-5 minutes)
- Automatic failover triggers
- Monitoring alerts sent
- Initial diagnostics run

#### Level 2: Engineering Response (5-30 minutes)
- Manual investigation begins
- Escalation to on-call engineer
- Customer communication initiated

#### Level 3: Management Escalation (30+ minutes)
- Incident commander assigned
- External vendor engagement
- Executive communication

## Post-Incident Procedures

### Immediate Post-Recovery (0-2 hours)
```bash
# 1. Verify all CDNs are healthy
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/health

# 2. Check performance metrics
curl -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/performance

# 3. Clear acknowledged alerts
for alert_id in $(curl -s -H "Authorization: Bearer $API_KEY" \
  https://api.platform.com/v1/cdn/alerts | jq -r '.data.alerts[].id'); do
  curl -X POST -H "Authorization: Bearer $API_KEY" \
    https://api.platform.com/v1/cdn/alerts/$alert_id/acknowledge
done

# 4. Update status page
curl -X POST -H "Authorization: Bearer $STATUS_API_KEY" \
  -d '{"status":"operational","message":"All systems operational"}' \
  https://api.statuspage.io/v1/pages/$PAGE_ID/incidents/$INCIDENT_ID
```

### Post-Incident Review (24-48 hours)
1. **Timeline Documentation**
   - Record exact failure time
   - Document detection time
   - Note resolution time
   - Calculate MTTR (Mean Time To Recovery)

2. **Root Cause Analysis**
   - Identify primary cause
   - Document contributing factors
   - Review monitoring effectiveness
   - Assess response procedures

3. **Action Items**
   - Improve monitoring/alerting
   - Update runbooks
   - Enhance automation
   - Schedule follow-up reviews

## Contact Information

### Emergency Contacts
- **On-Call Engineer**: +1-555-0123
- **CDN Team Lead**: +1-555-0124  
- **Infrastructure Manager**: +1-555-0125

### Vendor Support
- **Cloudflare Support**: +1-888-99-FLARE
- **AWS Support**: Enterprise Support Portal
- **BunnyCDN Support**: support@bunnycdn.com

### Internal Escalation
- **Slack**: #cdn-alerts, #incident-response
- **PagerDuty**: CDN Service escalation policy
- **Email**: cdn-team@platform.com