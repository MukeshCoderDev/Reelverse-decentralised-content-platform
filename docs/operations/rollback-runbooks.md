# Rollback Runbooks and Emergency Procedures

## Overview

This document provides comprehensive rollback procedures and emergency response protocols for the adult content platform. These procedures ensure rapid recovery from deployment issues, security incidents, and system failures.

## Emergency Contact Information

### Primary Contacts
- **Platform Lead:** [Name] - [Phone] - [Email]
- **DevOps Lead:** [Name] - [Phone] - [Email]  
- **Security Lead:** [Name] - [Phone] - [Email]
- **Database Admin:** [Name] - [Phone] - [Email]

### Escalation Chain
1. **Level 1:** On-call Engineer
2. **Level 2:** Team Lead
3. **Level 3:** Engineering Manager
4. **Level 4:** CTO/VP Engineering

### External Contacts
- **CDN Provider:** [Support Contact]
- **Payment Processors:** CCBill [Contact], Segpay [Contact]
- **Cloud Provider:** AWS Support [Contact]
- **Legal Counsel:** [Contact] (for DMCA/compliance issues)

## Incident Classification

### Severity Levels

**P0 - Critical (Complete Outage)**
- Platform completely inaccessible
- Payment processing down
- Data breach or security incident
- Legal/compliance violation
- **Response Time:** 15 minutes
- **Resolution Target:** 1 hour

**P1 - High (Major Functionality Impacted)**
- Core features unavailable
- Performance severely degraded
- Payment issues affecting >50% of transactions
- **Response Time:** 30 minutes
- **Resolution Target:** 4 hours

**P2 - Medium (Partial Functionality Impacted)**
- Non-core features unavailable
- Performance moderately degraded
- Payment issues affecting <50% of transactions
- **Response Time:** 2 hours
- **Resolution Target:** 24 hours

**P3 - Low (Minor Issues)**
- Cosmetic issues
- Minor performance degradation
- Non-critical feature issues
- **Response Time:** 4 hours
- **Resolution Target:** 72 hours

## Application Rollback Procedures

### Frontend Rollback

#### Immediate Rollback (< 5 minutes)

```bash
#!/bin/bash
# Frontend Emergency Rollback Script

set -e

echo "🚨 EMERGENCY FRONTEND ROLLBACK INITIATED"
echo "Timestamp: $(date)"

# 1. Get current deployment info
CURRENT_VERSION=$(kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
echo "Current version: $CURRENT_VERSION"

# 2. Get previous stable version
PREVIOUS_VERSION=$(kubectl rollout history deployment/frontend | tail -2 | head -1 | awk '{print $1}')
echo "Rolling back to revision: $PREVIOUS_VERSION"

# 3. Execute rollback
kubectl rollout undo deployment/frontend --to-revision=$PREVIOUS_VERSION

# 4. Wait for rollback completion
kubectl rollout status deployment/frontend --timeout=300s

# 5. Verify rollback
NEW_VERSION=$(kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
echo "Rollback completed. New version: $NEW_VERSION"

# 6. Update CDN cache
echo "Purging CDN cache..."
aws cloudfront create-invalidation --distribution-id $CDN_DISTRIBUTION_ID --paths "/*"

# 7. Verify application health
echo "Verifying application health..."
curl -f https://platform.com/health || echo "❌ Health check failed"

echo "✅ Frontend rollback completed successfully"
```

#### Verification Steps

1. **Health Check:** Verify `/health` endpoint responds
2. **Core Functionality:** Test login, content browsing, payments
3. **Performance:** Check page load times < 3 seconds
4. **CDN:** Verify static assets loading correctly
5. **Analytics:** Confirm tracking is working

### Backend API Rollback

#### Database-Safe Rollback

```bash
#!/bin/bash
# Backend API Emergency Rollback Script

set -e

echo "🚨 EMERGENCY BACKEND ROLLBACK INITIATED"
echo "Timestamp: $(date)"

# 1. Enable maintenance mode
kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"true"}}'
kubectl rollout restart deployment/frontend

echo "⚠️ Maintenance mode enabled"

# 2. Stop new deployments
kubectl scale deployment backend --replicas=0
sleep 30

# 3. Backup current database state
BACKUP_NAME="emergency_backup_$(date +%Y%m%d_%H%M%S)"
pg_dump $DATABASE_URL > /backups/$BACKUP_NAME.sql
echo "Database backup created: $BACKUP_NAME"

# 4. Get previous stable version
PREVIOUS_VERSION=$(kubectl rollout history deployment/backend | tail -2 | head -1 | awk '{print $1}')
echo "Rolling back to revision: $PREVIOUS_VERSION"

# 5. Check for database migrations
CURRENT_MIGRATION=$(kubectl exec deployment/backend -- npm run migration:current)
PREVIOUS_MIGRATION=$(kubectl exec deployment/backend -- npm run migration:previous)

if [ "$CURRENT_MIGRATION" != "$PREVIOUS_MIGRATION" ]; then
    echo "⚠️ Database migration rollback required"
    kubectl exec deployment/backend -- npm run migration:rollback
    echo "Database migration rolled back"
fi

# 6. Execute application rollback
kubectl rollout undo deployment/backend --to-revision=$PREVIOUS_VERSION

# 7. Scale up to previous replica count
kubectl scale deployment backend --replicas=3

# 8. Wait for rollback completion
kubectl rollout status deployment/backend --timeout=600s

# 9. Verify backend health
echo "Verifying backend health..."
for i in {1..10}; do
    if curl -f https://api.platform.com/health; then
        echo "✅ Backend health check passed"
        break
    fi
    echo "Attempt $i failed, retrying in 10s..."
    sleep 10
done

# 10. Disable maintenance mode
kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"false"}}'
kubectl rollout restart deployment/frontend

echo "✅ Backend rollback completed successfully"
```

### Smart Contract Rollback

#### Emergency Contract Pause

```bash
#!/bin/bash
# Smart Contract Emergency Procedures

set -e

echo "🚨 SMART CONTRACT EMERGENCY PROCEDURES"
echo "Timestamp: $(date)"

# 1. Pause all contract operations
echo "Pausing all smart contracts..."

# Payment contract
cast send $PAYMENT_CONTRACT "pause()" --private-key $ADMIN_PRIVATE_KEY --rpc-url $RPC_URL

# Content access contract  
cast send $CONTENT_CONTRACT "pause()" --private-key $ADMIN_PRIVATE_KEY --rpc-url $RPC_URL

# Revenue split contract
cast send $REVENUE_CONTRACT "pause()" --private-key $ADMIN_PRIVATE_KEY --rpc-url $RPC_URL

echo "✅ All contracts paused"

# 2. Verify pause status
echo "Verifying pause status..."
PAYMENT_PAUSED=$(cast call $PAYMENT_CONTRACT "paused()" --rpc-url $RPC_URL)
CONTENT_PAUSED=$(cast call $CONTENT_CONTRACT "paused()" --rpc-url $RPC_URL)
REVENUE_PAUSED=$(cast call $REVENUE_CONTRACT "paused()" --rpc-url $RPC_URL)

echo "Payment Contract Paused: $PAYMENT_PAUSED"
echo "Content Contract Paused: $CONTENT_PAUSED"
echo "Revenue Contract Paused: $REVENUE_PAUSED"

# 3. Enable emergency withdrawal mode
echo "Enabling emergency withdrawal..."
cast send $PAYMENT_CONTRACT "enableEmergencyWithdrawal()" --private-key $ADMIN_PRIVATE_KEY --rpc-url $RPC_URL

# 4. Notify users via frontend
kubectl patch configmap app-config --patch '{"data":{"EMERGENCY_MODE":"true","EMERGENCY_MESSAGE":"Smart contracts are temporarily paused for maintenance. Withdrawals are available."}}'

echo "✅ Emergency procedures completed"
```

## Database Rollback Procedures

### PostgreSQL Rollback

#### Point-in-Time Recovery

```bash
#!/bin/bash
# Database Point-in-Time Recovery

set -e

echo "🚨 DATABASE POINT-IN-TIME RECOVERY"
echo "Timestamp: $(date)"

# Parameters
RECOVERY_TIME="$1"  # Format: 2024-01-15 14:30:00
BACKUP_NAME="pitr_recovery_$(date +%Y%m%d_%H%M%S)"

if [ -z "$RECOVERY_TIME" ]; then
    echo "❌ Recovery time required. Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    exit 1
fi

# 1. Stop application connections
echo "Stopping application..."
kubectl scale deployment backend --replicas=0
kubectl scale deployment worker --replicas=0

# 2. Create current database backup
echo "Creating safety backup..."
pg_dump $DATABASE_URL > /backups/safety_$BACKUP_NAME.sql

# 3. Stop database connections
echo "Terminating active connections..."
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

# 4. Perform point-in-time recovery
echo "Performing point-in-time recovery to: $RECOVERY_TIME"

# Stop PostgreSQL
sudo systemctl stop postgresql

# Restore from base backup
sudo rm -rf /var/lib/postgresql/data/*
sudo -u postgres pg_basebackup -D /var/lib/postgresql/data -Ft -z -P -W

# Configure recovery
sudo -u postgres cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '$RECOVERY_TIME'
recovery_target_action = 'promote'
EOF

# Start PostgreSQL
sudo systemctl start postgresql

# Wait for recovery completion
echo "Waiting for recovery completion..."
while ! pg_isready -h localhost -p 5432; do
    sleep 5
done

# 5. Verify database state
echo "Verifying database state..."
RECOVERED_TIME=$(psql $DATABASE_URL -t -c "SELECT now();")
echo "Database recovered to: $RECOVERED_TIME"

# 6. Run data consistency checks
echo "Running consistency checks..."
psql $DATABASE_URL -f /scripts/consistency_check.sql

# 7. Restart applications
echo "Restarting applications..."
kubectl scale deployment backend --replicas=3
kubectl scale deployment worker --replicas=2

echo "✅ Point-in-time recovery completed"
```

#### Migration Rollback

```bash
#!/bin/bash
# Database Migration Rollback

set -e

echo "🚨 DATABASE MIGRATION ROLLBACK"
echo "Timestamp: $(date)"

# 1. Get current migration version
CURRENT_VERSION=$(npm run migration:current)
echo "Current migration version: $CURRENT_VERSION"

# 2. Create pre-rollback backup
BACKUP_NAME="migration_rollback_$(date +%Y%m%d_%H%M%S)"
pg_dump $DATABASE_URL > /backups/$BACKUP_NAME.sql
echo "Backup created: $BACKUP_NAME"

# 3. Stop applications
kubectl scale deployment backend --replicas=0
kubectl scale deployment worker --replicas=0

# 4. Rollback migrations
echo "Rolling back migrations..."
npm run migration:rollback

# 5. Verify rollback
NEW_VERSION=$(npm run migration:current)
echo "New migration version: $NEW_VERSION"

# 6. Run data validation
echo "Validating data integrity..."
npm run migration:validate

# 7. Restart applications
kubectl scale deployment backend --replicas=3
kubectl scale deployment worker --replicas=2

echo "✅ Migration rollback completed"
```

## Infrastructure Rollback

### Kubernetes Rollback

```bash
#!/bin/bash
# Kubernetes Infrastructure Rollback

set -e

echo "🚨 KUBERNETES INFRASTRUCTURE ROLLBACK"
echo "Timestamp: $(date)"

# 1. Get all deployments
DEPLOYMENTS=$(kubectl get deployments -o name)

echo "Rolling back all deployments..."

# 2. Rollback each deployment
for deployment in $DEPLOYMENTS; do
    echo "Rolling back $deployment..."
    kubectl rollout undo $deployment
done

# 3. Wait for all rollbacks to complete
echo "Waiting for rollbacks to complete..."
for deployment in $DEPLOYMENTS; do
    kubectl rollout status $deployment --timeout=300s
done

# 4. Verify all pods are healthy
echo "Verifying pod health..."
kubectl get pods --field-selector=status.phase!=Running

# 5. Run health checks
echo "Running health checks..."
kubectl exec deployment/backend -- curl -f http://localhost:3000/health
kubectl exec deployment/frontend -- curl -f http://localhost:3000/health

echo "✅ Kubernetes rollback completed"
```

### CDN Rollback

```bash
#!/bin/bash
# CDN Configuration Rollback

set -e

echo "🚨 CDN ROLLBACK INITIATED"
echo "Timestamp: $(date)"

# 1. Get current CDN configuration
aws cloudfront get-distribution-config --id $CDN_DISTRIBUTION_ID > /tmp/current_cdn_config.json

# 2. Restore previous configuration
aws cloudfront update-distribution --id $CDN_DISTRIBUTION_ID --distribution-config file:///backups/cdn_config_backup.json

# 3. Wait for deployment
echo "Waiting for CDN deployment..."
aws cloudfront wait distribution-deployed --id $CDN_DISTRIBUTION_ID

# 4. Purge cache
echo "Purging CDN cache..."
aws cloudfront create-invalidation --distribution-id $CDN_DISTRIBUTION_ID --paths "/*"

# 5. Verify CDN health
echo "Verifying CDN health..."
curl -I https://cdn.platform.com/health

echo "✅ CDN rollback completed"
```

## Emergency Response Procedures

### Security Incident Response

#### Data Breach Response

```bash
#!/bin/bash
# Data Breach Emergency Response

set -e

echo "🚨 DATA BREACH RESPONSE INITIATED"
echo "Timestamp: $(date)"

# 1. Immediate containment
echo "Step 1: Immediate containment"

# Isolate affected systems
kubectl patch deployment backend --patch '{"spec":{"replicas":0}}'
kubectl patch deployment worker --patch '{"spec":{"replicas":0}}'

# Block suspicious IPs
for ip in $SUSPICIOUS_IPS; do
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --source-group $ip/32 --rule-action deny
done

# 2. Evidence preservation
echo "Step 2: Evidence preservation"

# Capture system state
kubectl get all -o yaml > /evidence/k8s_state_$(date +%Y%m%d_%H%M%S).yaml

# Capture logs
kubectl logs -l app=backend --since=24h > /evidence/backend_logs_$(date +%Y%m%d_%H%M%S).log
kubectl logs -l app=frontend --since=24h > /evidence/frontend_logs_$(date +%Y%m%d_%H%M%S).log

# Database audit logs
psql $DATABASE_URL -c "COPY (SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours') TO '/evidence/db_audit_$(date +%Y%m%d_%H%M%S).csv' CSV HEADER;"

# 3. Assessment
echo "Step 3: Impact assessment"

# Check for data exfiltration
psql $DATABASE_URL -f /scripts/breach_assessment.sql > /evidence/breach_assessment_$(date +%Y%m%d_%H%M%S).txt

# 4. Notification
echo "Step 4: Stakeholder notification"

# Internal notification
curl -X POST $SLACK_WEBHOOK -d '{"text":"🚨 SECURITY INCIDENT: Data breach detected. Incident response initiated."}'

# External notification (if required)
# This would trigger legal/compliance team notifications

echo "✅ Initial breach response completed"
echo "Next steps: Full forensic analysis, user notification, regulatory reporting"
```

#### DDoS Attack Response

```bash
#!/bin/bash
# DDoS Attack Response

set -e

echo "🚨 DDOS ATTACK RESPONSE"
echo "Timestamp: $(date)"

# 1. Enable DDoS protection
echo "Enabling DDoS protection..."

# AWS Shield Advanced
aws shield-advanced enable-protection --resource-arn $CLOUDFRONT_ARN

# Rate limiting
kubectl apply -f /configs/rate-limit-strict.yaml

# 2. Scale infrastructure
echo "Scaling infrastructure..."

# Increase replicas
kubectl scale deployment backend --replicas=10
kubectl scale deployment frontend --replicas=5

# Enable auto-scaling
kubectl autoscale deployment backend --cpu-percent=50 --min=5 --max=20

# 3. Traffic filtering
echo "Implementing traffic filtering..."

# Block attack patterns
aws wafv2 update-web-acl --scope CLOUDFRONT --id $WAF_ACL_ID --rules file:///configs/ddos-rules.json

# Geographic blocking if needed
aws cloudfront update-distribution --id $CDN_DISTRIBUTION_ID --distribution-config file:///configs/geo-block.json

# 4. Monitor and adjust
echo "Monitoring attack..."

# Real-time monitoring
kubectl logs -f deployment/backend | grep -E "(429|503|504)"

echo "✅ DDoS response measures activated"
```

### Payment System Emergency

#### Payment Processor Outage

```bash
#!/bin/bash
# Payment Processor Emergency Response

set -e

echo "🚨 PAYMENT PROCESSOR OUTAGE RESPONSE"
echo "Timestamp: $(date)"

FAILED_PROCESSOR="$1"  # ccbill or segpay

# 1. Detect outage
echo "Detecting payment processor status..."

# Check processor health
if ! curl -f https://api.$FAILED_PROCESSOR.com/health; then
    echo "❌ $FAILED_PROCESSOR is down"
else
    echo "✅ $FAILED_PROCESSOR is healthy"
    exit 0
fi

# 2. Failover to backup processor
echo "Initiating failover..."

if [ "$FAILED_PROCESSOR" = "ccbill" ]; then
    BACKUP_PROCESSOR="segpay"
else
    BACKUP_PROCESSOR="ccbill"
fi

# Update payment configuration
kubectl patch configmap payment-config --patch "{\"data\":{\"PRIMARY_PROCESSOR\":\"$BACKUP_PROCESSOR\",\"BACKUP_PROCESSOR\":\"$FAILED_PROCESSOR\"}}"

# Restart payment service
kubectl rollout restart deployment/payment-service

# 3. Notify users
kubectl patch configmap app-config --patch '{"data":{"PAYMENT_NOTICE":"We are experiencing issues with one payment processor. Alternative payment methods are available."}}'

# 4. Monitor failover
echo "Monitoring failover..."

# Test payment processing
curl -X POST https://api.platform.com/payments/test -d '{"amount":1,"currency":"USD"}' -H "Content-Type: application/json"

echo "✅ Payment failover completed"
```

### Content Delivery Emergency

#### CDN Outage Response

```bash
#!/bin/bash
# CDN Outage Emergency Response

set -e

echo "🚨 CDN OUTAGE RESPONSE"
echo "Timestamp: $(date)"

# 1. Detect CDN outage
echo "Checking CDN status..."

if ! curl -f https://cdn.platform.com/health; then
    echo "❌ Primary CDN is down"
else
    echo "✅ Primary CDN is healthy"
    exit 0
fi

# 2. Failover to backup CDN
echo "Failing over to backup CDN..."

# Update DNS records
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch file:///configs/cdn-failover.json

# 3. Enable origin serving
echo "Enabling direct origin serving..."

# Update load balancer configuration
kubectl patch service frontend --patch '{"spec":{"type":"LoadBalancer"}}'

# Scale up origin servers
kubectl scale deployment frontend --replicas=10

# 4. Notify users
kubectl patch configmap app-config --patch '{"data":{"CDN_NOTICE":"We are experiencing CDN issues. Content may load slower than usual."}}'

echo "✅ CDN failover completed"
```

## Recovery Verification

### Health Check Scripts

```bash
#!/bin/bash
# Comprehensive Health Check

set -e

echo "🔍 COMPREHENSIVE HEALTH CHECK"
echo "Timestamp: $(date)"

HEALTH_STATUS=0

# 1. Application health
echo "Checking application health..."

if curl -f https://platform.com/health; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    HEALTH_STATUS=1
fi

if curl -f https://api.platform.com/health; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    HEALTH_STATUS=1
fi

# 2. Database connectivity
echo "Checking database connectivity..."

if psql $DATABASE_URL -c "SELECT 1;" > /dev/null; then
    echo "✅ Database connectivity check passed"
else
    echo "❌ Database connectivity check failed"
    HEALTH_STATUS=1
fi

# 3. Payment processing
echo "Checking payment processing..."

PAYMENT_TEST=$(curl -s -X POST https://api.platform.com/payments/test -d '{"amount":1}' -H "Content-Type: application/json")
if echo $PAYMENT_TEST | grep -q "success"; then
    echo "✅ Payment processing check passed"
else
    echo "❌ Payment processing check failed"
    HEALTH_STATUS=1
fi

# 4. Content delivery
echo "Checking content delivery..."

if curl -f https://cdn.platform.com/test.jpg > /dev/null; then
    echo "✅ Content delivery check passed"
else
    echo "❌ Content delivery check failed"
    HEALTH_STATUS=1
fi

# 5. Smart contracts
echo "Checking smart contracts..."

CONTRACT_STATUS=$(cast call $PAYMENT_CONTRACT "paused()" --rpc-url $RPC_URL)
if [ "$CONTRACT_STATUS" = "false" ]; then
    echo "✅ Smart contracts operational"
else
    echo "⚠️ Smart contracts are paused"
fi

# 6. Performance check
echo "Checking performance..."

RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' https://platform.com)
if (( $(echo "$RESPONSE_TIME < 3.0" | bc -l) )); then
    echo "✅ Performance check passed ($RESPONSE_TIME seconds)"
else
    echo "⚠️ Performance degraded ($RESPONSE_TIME seconds)"
fi

# Summary
if [ $HEALTH_STATUS -eq 0 ]; then
    echo "✅ All health checks passed"
else
    echo "❌ Some health checks failed"
fi

exit $HEALTH_STATUS
```

## Communication Templates

### Internal Incident Communication

```markdown
# Incident Alert Template

**INCIDENT ALERT - P[SEVERITY]**

**Incident ID:** INC-[TIMESTAMP]
**Severity:** P[0-3]
**Status:** [INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED]
**Started:** [TIMESTAMP]
**Duration:** [DURATION]

## Summary
[Brief description of the incident]

## Impact
- **Users Affected:** [NUMBER/PERCENTAGE]
- **Services Affected:** [LIST]
- **Business Impact:** [DESCRIPTION]

## Current Status
[What is currently happening]

## Actions Taken
- [ACTION 1]
- [ACTION 2]
- [ACTION 3]

## Next Steps
- [NEXT STEP 1]
- [NEXT STEP 2]

## Point of Contact
**Incident Commander:** [NAME] - [CONTACT]

---
*Next update in [TIME INTERVAL]*
```

### User Communication Template

```markdown
# User Notification Template

**Service Status Update**

We are currently experiencing [ISSUE DESCRIPTION] that may affect [AFFECTED SERVICES].

**What's happening:**
[User-friendly explanation]

**What we're doing:**
[Actions being taken]

**What you can do:**
[User actions/workarounds]

**Expected resolution:**
[Timeline if known]

We apologize for any inconvenience and will provide updates as we have them.

For questions, please contact support@platform.com

---
Platform Team
```

## Post-Incident Procedures

### Post-Mortem Template

```markdown
# Post-Incident Review

**Incident:** [TITLE]
**Date:** [DATE]
**Duration:** [TOTAL DURATION]
**Severity:** P[0-3]

## Summary
[Brief summary of what happened]

## Timeline
- **[TIME]** - [EVENT]
- **[TIME]** - [EVENT]
- **[TIME]** - [EVENT]

## Root Cause
[Detailed root cause analysis]

## Impact
- **Users Affected:** [NUMBER]
- **Revenue Impact:** [AMOUNT]
- **Reputation Impact:** [ASSESSMENT]

## What Went Well
- [POSITIVE ASPECT 1]
- [POSITIVE ASPECT 2]

## What Went Poorly
- [ISSUE 1]
- [ISSUE 2]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [ACTION 1] | [OWNER] | [DATE] | [STATUS] |
| [ACTION 2] | [OWNER] | [DATE] | [STATUS] |

## Lessons Learned
[Key takeaways and improvements]
```

## Testing and Maintenance

### Rollback Testing Schedule

- **Weekly:** Test application rollback procedures
- **Monthly:** Test database rollback procedures  
- **Quarterly:** Full disaster recovery drill
- **Annually:** Complete emergency response simulation

### Runbook Maintenance

- **Monthly:** Review and update contact information
- **Quarterly:** Update procedures based on infrastructure changes
- **After incidents:** Update based on lessons learned
- **Annually:** Complete runbook review and validation

---

*This document should be reviewed and updated regularly. Last updated: [DATE]*