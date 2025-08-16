#!/bin/bash

# Emergency Rollback Script
# Comprehensive rollback automation for critical incidents

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/emergency-rollback-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="/backups/emergency"
INCIDENT_ID="INC-$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Help function
show_help() {
    cat << EOF
Emergency Rollback Script

Usage: $0 [OPTIONS] COMPONENT

COMPONENTS:
    frontend        Rollback frontend application
    backend         Rollback backend API
    database        Rollback database to previous state
    contracts       Emergency pause smart contracts
    infrastructure  Rollback Kubernetes infrastructure
    full            Complete system rollback (all components)

OPTIONS:
    -h, --help      Show this help message
    -v, --version   Specify version to rollback to
    -f, --force     Force rollback without confirmation
    -d, --dry-run   Show what would be done without executing
    --skip-backup   Skip backup creation (faster but riskier)

EXAMPLES:
    $0 frontend                    # Rollback frontend to previous version
    $0 backend -v v1.2.3          # Rollback backend to specific version
    $0 full -f                     # Force complete system rollback
    $0 database --dry-run          # Show database rollback plan

EMERGENCY CONTACTS:
    Platform Lead: [PHONE]
    DevOps Lead: [PHONE]
    Security Lead: [PHONE]
EOF
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as appropriate user
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. This is not recommended for normal operations."
    fi
    
    # Check required tools
    local required_tools=("kubectl" "psql" "aws" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        error "Cannot connect to database"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Create emergency backup
create_emergency_backup() {
    local component="$1"
    
    log "Creating emergency backup for $component..."
    
    mkdir -p "$BACKUP_DIR"
    
    case "$component" in
        "frontend"|"backend"|"infrastructure")
            # Backup Kubernetes configurations
            kubectl get all -o yaml > "$BACKUP_DIR/k8s-state-$component-$(date +%Y%m%d_%H%M%S).yaml"
            ;;
        "database")
            # Backup database
            local backup_file="$BACKUP_DIR/db-emergency-$(date +%Y%m%d_%H%M%S).sql"
            pg_dump "$DATABASE_URL" > "$backup_file"
            log "Database backup created: $backup_file"
            ;;
        "contracts")
            # Backup contract states
            local contract_backup="$BACKUP_DIR/contracts-state-$(date +%Y%m%d_%H%M%S).json"
            echo "{" > "$contract_backup"
            echo "  \"payment_contract\": \"$(cast call $PAYMENT_CONTRACT 'paused()' --rpc-url $RPC_URL)\"," >> "$contract_backup"
            echo "  \"content_contract\": \"$(cast call $CONTENT_CONTRACT 'paused()' --rpc-url $RPC_URL)\"," >> "$contract_backup"
            echo "  \"revenue_contract\": \"$(cast call $REVENUE_CONTRACT 'paused()' --rpc-url $RPC_URL)\"" >> "$contract_backup"
            echo "}" >> "$contract_backup"
            ;;
    esac
    
    success "Emergency backup created"
}

# Send incident notification
send_notification() {
    local message="$1"
    local severity="${2:-HIGH}"
    
    log "Sending incident notification..."
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 EMERGENCY ROLLBACK - $severity\\n$message\\nIncident ID: $INCIDENT_ID\"}" \
            &> /dev/null || warning "Failed to send Slack notification"
    fi
    
    # PagerDuty notification (if configured)
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" ]]; then
        curl -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H "Content-Type: application/json" \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"dedup_key\": \"$INCIDENT_ID\",
                \"payload\": {
                    \"summary\": \"Emergency Rollback: $message\",
                    \"severity\": \"critical\",
                    \"source\": \"emergency-rollback-script\"
                }
            }" &> /dev/null || warning "Failed to send PagerDuty notification"
    fi
    
    success "Notifications sent"
}

# Frontend rollback
rollback_frontend() {
    local target_version="$1"
    
    log "Starting frontend rollback..."
    
    # Enable maintenance mode
    log "Enabling maintenance mode..."
    kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"true","MAINTENANCE_MESSAGE":"Emergency maintenance in progress. We will be back shortly."}}'
    
    # Get current version
    local current_version
    current_version=$(kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
    log "Current frontend version: $current_version"
    
    # Determine rollback target
    if [[ -n "$target_version" ]]; then
        log "Rolling back to specified version: $target_version"
        kubectl set image deployment/frontend frontend="$FRONTEND_IMAGE:$target_version"
    else
        log "Rolling back to previous version..."
        kubectl rollout undo deployment/frontend
    fi
    
    # Wait for rollback completion
    log "Waiting for rollback completion..."
    if kubectl rollout status deployment/frontend --timeout=300s; then
        success "Frontend rollback completed"
    else
        error "Frontend rollback failed"
        return 1
    fi
    
    # Verify rollback
    local new_version
    new_version=$(kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
    log "New frontend version: $new_version"
    
    # Update CDN cache
    log "Purging CDN cache..."
    if [[ -n "$CDN_DISTRIBUTION_ID" ]]; then
        aws cloudfront create-invalidation --distribution-id "$CDN_DISTRIBUTION_ID" --paths "/*" &> /dev/null || warning "CDN cache purge failed"
    fi
    
    # Health check
    log "Performing health check..."
    local health_check_attempts=0
    while [[ $health_check_attempts -lt 10 ]]; do
        if curl -f "https://platform.com/health" &> /dev/null; then
            success "Frontend health check passed"
            break
        fi
        ((health_check_attempts++))
        log "Health check attempt $health_check_attempts failed, retrying in 10s..."
        sleep 10
    done
    
    if [[ $health_check_attempts -eq 10 ]]; then
        error "Frontend health check failed after 10 attempts"
        return 1
    fi
    
    # Disable maintenance mode
    log "Disabling maintenance mode..."
    kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"false"}}'
    
    success "Frontend rollback completed successfully"
}

# Backend rollback
rollback_backend() {
    local target_version="$1"
    
    log "Starting backend rollback..."
    
    # Enable maintenance mode
    log "Enabling maintenance mode..."
    kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"true","MAINTENANCE_MESSAGE":"Emergency maintenance in progress. We will be back shortly."}}'
    
    # Scale down to prevent new requests
    log "Scaling down backend..."
    kubectl scale deployment backend --replicas=0
    sleep 30
    
    # Check for database migrations
    log "Checking database migrations..."
    local current_migration
    local previous_migration
    
    # This would need to be implemented based on your migration system
    # current_migration=$(kubectl exec deployment/backend -- npm run migration:current 2>/dev/null || echo "unknown")
    # previous_migration=$(kubectl exec deployment/backend -- npm run migration:previous 2>/dev/null || echo "unknown")
    
    # if [[ "$current_migration" != "$previous_migration" && "$current_migration" != "unknown" ]]; then
    #     warning "Database migration rollback may be required"
    #     log "Current migration: $current_migration"
    #     log "Previous migration: $previous_migration"
    # fi
    
    # Perform rollback
    if [[ -n "$target_version" ]]; then
        log "Rolling back to specified version: $target_version"
        kubectl set image deployment/backend backend="$BACKEND_IMAGE:$target_version"
    else
        log "Rolling back to previous version..."
        kubectl rollout undo deployment/backend
    fi
    
    # Scale back up
    log "Scaling backend back up..."
    kubectl scale deployment backend --replicas=3
    
    # Wait for rollback completion
    log "Waiting for rollback completion..."
    if kubectl rollout status deployment/backend --timeout=600s; then
        success "Backend rollback completed"
    else
        error "Backend rollback failed"
        return 1
    fi
    
    # Health check
    log "Performing health check..."
    local health_check_attempts=0
    while [[ $health_check_attempts -lt 15 ]]; do
        if curl -f "https://api.platform.com/health" &> /dev/null; then
            success "Backend health check passed"
            break
        fi
        ((health_check_attempts++))
        log "Health check attempt $health_check_attempts failed, retrying in 10s..."
        sleep 10
    done
    
    if [[ $health_check_attempts -eq 15 ]]; then
        error "Backend health check failed after 15 attempts"
        return 1
    fi
    
    # Disable maintenance mode
    log "Disabling maintenance mode..."
    kubectl patch configmap app-config --patch '{"data":{"MAINTENANCE_MODE":"false"}}'
    
    success "Backend rollback completed successfully"
}

# Database rollback
rollback_database() {
    local target_time="$1"
    
    log "Starting database rollback..."
    warning "Database rollback is a critical operation. Proceeding with caution."
    
    # Stop applications
    log "Stopping applications..."
    kubectl scale deployment backend --replicas=0
    kubectl scale deployment worker --replicas=0
    sleep 30
    
    # Create safety backup
    local safety_backup="$BACKUP_DIR/safety-backup-$(date +%Y%m%d_%H%M%S).sql"
    log "Creating safety backup..."
    pg_dump "$DATABASE_URL" > "$safety_backup"
    log "Safety backup created: $safety_backup"
    
    if [[ -n "$target_time" ]]; then
        log "Performing point-in-time recovery to: $target_time"
        # Point-in-time recovery would be implemented here
        # This is highly dependent on your backup/recovery setup
        warning "Point-in-time recovery not implemented in this script"
        warning "Manual intervention required for PITR"
    else
        log "Rolling back to most recent backup..."
        # Restore from most recent backup
        local latest_backup
        latest_backup=$(ls -t "$BACKUP_DIR"/db-*.sql 2>/dev/null | head -1)
        
        if [[ -n "$latest_backup" ]]; then
            log "Restoring from backup: $latest_backup"
            
            # Terminate active connections
            psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" &> /dev/null
            
            # Drop and recreate database
            local db_name
            db_name=$(echo "$DATABASE_URL" | sed 's/.*\///')
            
            psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${db_name}_temp;" &> /dev/null
            psql "$DATABASE_URL" -c "CREATE DATABASE ${db_name}_temp;" &> /dev/null
            
            # Restore backup
            psql "${DATABASE_URL}_temp" < "$latest_backup"
            
            # Swap databases
            psql "$DATABASE_URL" -c "ALTER DATABASE $db_name RENAME TO ${db_name}_old;" &> /dev/null
            psql "$DATABASE_URL" -c "ALTER DATABASE ${db_name}_temp RENAME TO $db_name;" &> /dev/null
            
            success "Database restored from backup"
        else
            error "No backup found for database rollback"
            return 1
        fi
    fi
    
    # Restart applications
    log "Restarting applications..."
    kubectl scale deployment backend --replicas=3
    kubectl scale deployment worker --replicas=2
    
    # Wait for applications to be ready
    kubectl rollout status deployment/backend --timeout=300s
    kubectl rollout status deployment/worker --timeout=300s
    
    success "Database rollback completed successfully"
}

# Smart contracts emergency pause
emergency_pause_contracts() {
    log "Starting emergency contract pause..."
    
    if [[ -z "$ADMIN_PRIVATE_KEY" ]]; then
        error "ADMIN_PRIVATE_KEY not set"
        return 1
    fi
    
    # Pause all contracts
    log "Pausing payment contract..."
    cast send "$PAYMENT_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause payment contract"
    
    log "Pausing content contract..."
    cast send "$CONTENT_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause content contract"
    
    log "Pausing revenue contract..."
    cast send "$REVENUE_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause revenue contract"
    
    # Verify pause status
    log "Verifying pause status..."
    local payment_paused
    local content_paused
    local revenue_paused
    
    payment_paused=$(cast call "$PAYMENT_CONTRACT" "paused()" --rpc-url "$RPC_URL")
    content_paused=$(cast call "$CONTENT_CONTRACT" "paused()" --rpc-url "$RPC_URL")
    revenue_paused=$(cast call "$REVENUE_CONTRACT" "paused()" --rpc-url "$RPC_URL")
    
    log "Payment Contract Paused: $payment_paused"
    log "Content Contract Paused: $content_paused"
    log "Revenue Contract Paused: $revenue_paused"
    
    # Enable emergency withdrawal
    log "Enabling emergency withdrawal..."
    cast send "$PAYMENT_CONTRACT" "enableEmergencyWithdrawal()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || warning "Failed to enable emergency withdrawal"
    
    # Update frontend to show emergency mode
    kubectl patch configmap app-config --patch '{"data":{"EMERGENCY_MODE":"true","EMERGENCY_MESSAGE":"Smart contracts are temporarily paused for maintenance. Emergency withdrawals are available."}}'
    
    success "Emergency contract pause completed"
}

# Infrastructure rollback
rollback_infrastructure() {
    log "Starting infrastructure rollback..."
    
    # Get all deployments
    local deployments
    deployments=$(kubectl get deployments -o name)
    
    log "Rolling back all deployments..."
    
    # Rollback each deployment
    for deployment in $deployments; do
        log "Rolling back $deployment..."
        kubectl rollout undo "$deployment" &> /dev/null || warning "Failed to rollback $deployment"
    done
    
    # Wait for all rollbacks to complete
    log "Waiting for rollbacks to complete..."
    for deployment in $deployments; do
        kubectl rollout status "$deployment" --timeout=300s || warning "Rollback timeout for $deployment"
    done
    
    # Verify all pods are healthy
    log "Verifying pod health..."
    local unhealthy_pods
    unhealthy_pods=$(kubectl get pods --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    
    if [[ $unhealthy_pods -eq 0 ]]; then
        success "All pods are healthy"
    else
        warning "$unhealthy_pods unhealthy pods found"
        kubectl get pods --field-selector=status.phase!=Running
    fi
    
    success "Infrastructure rollback completed"
}

# Full system rollback
rollback_full() {
    log "Starting full system rollback..."
    
    # Send initial notification
    send_notification "Full system rollback initiated" "CRITICAL"
    
    # Pause smart contracts first to prevent new transactions
    log "Step 1: Emergency pause smart contracts"
    emergency_pause_contracts || warning "Contract pause failed, continuing..."
    
    # Rollback infrastructure
    log "Step 2: Rollback infrastructure"
    rollback_infrastructure || warning "Infrastructure rollback failed, continuing..."
    
    # Rollback backend
    log "Step 3: Rollback backend"
    rollback_backend || warning "Backend rollback failed, continuing..."
    
    # Rollback frontend
    log "Step 4: Rollback frontend"
    rollback_frontend || warning "Frontend rollback failed, continuing..."
    
    # Database rollback (optional, requires confirmation)
    if [[ "$INCLUDE_DATABASE" == "true" ]]; then
        log "Step 5: Rollback database"
        rollback_database || warning "Database rollback failed"
    else
        log "Step 5: Skipping database rollback (not requested)"
    fi
    
    # Final health check
    log "Performing final health check..."
    sleep 30
    
    local health_status=0
    
    # Check frontend
    if ! curl -f "https://platform.com/health" &> /dev/null; then
        error "Frontend health check failed"
        health_status=1
    fi
    
    # Check backend
    if ! curl -f "https://api.platform.com/health" &> /dev/null; then
        error "Backend health check failed"
        health_status=1
    fi
    
    # Check database
    if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        error "Database health check failed"
        health_status=1
    fi
    
    if [[ $health_status -eq 0 ]]; then
        success "Full system rollback completed successfully"
        send_notification "Full system rollback completed successfully" "INFO"
    else
        error "Full system rollback completed with errors"
        send_notification "Full system rollback completed with errors - manual intervention required" "CRITICAL"
        return 1
    fi
}

# Dry run mode
dry_run() {
    local component="$1"
    
    log "DRY RUN MODE - No changes will be made"
    log "Component: $component"
    
    case "$component" in
        "frontend")
            log "Would rollback frontend deployment"
            log "Current version: $(kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)"
            ;;
        "backend")
            log "Would rollback backend deployment"
            log "Current version: $(kubectl get deployment backend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)"
            ;;
        "database")
            log "Would rollback database to previous state"
            log "Latest backup: $(ls -t "$BACKUP_DIR"/db-*.sql 2>/dev/null | head -1 || echo "No backups found")"
            ;;
        "contracts")
            log "Would pause all smart contracts"
            log "Payment contract paused: $(cast call "$PAYMENT_CONTRACT" "paused()" --rpc-url "$RPC_URL" 2>/dev/null || echo "unknown")"
            ;;
        "infrastructure")
            log "Would rollback all Kubernetes deployments"
            kubectl get deployments
            ;;
        "full")
            log "Would perform full system rollback"
            log "This includes: contracts, infrastructure, backend, frontend"
            ;;
    esac
    
    log "DRY RUN COMPLETED - No changes were made"
}

# Main function
main() {
    local component=""
    local target_version=""
    local force=false
    local dry_run=false
    local skip_backup=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                target_version="$2"
                shift 2
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            --skip-backup)
                skip_backup=true
                shift
                ;;
            --include-database)
                INCLUDE_DATABASE=true
                shift
                ;;
            frontend|backend|database|contracts|infrastructure|full)
                component="$1"
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate component
    if [[ -z "$component" ]]; then
        error "Component must be specified"
        show_help
        exit 1
    fi
    
    # Start logging
    log "Emergency Rollback Script Started"
    log "Incident ID: $INCIDENT_ID"
    log "Component: $component"
    log "Target Version: ${target_version:-"previous"}"
    log "Force: $force"
    log "Dry Run: $dry_run"
    log "Skip Backup: $skip_backup"
    
    # Dry run mode
    if [[ "$dry_run" == true ]]; then
        dry_run "$component"
        exit 0
    fi
    
    # Confirmation prompt (unless forced)
    if [[ "$force" != true ]]; then
        echo
        warning "This will perform an emergency rollback of: $component"
        warning "This action cannot be easily undone!"
        echo
        read -p "Are you sure you want to continue? (type 'ROLLBACK' to confirm): " confirmation
        
        if [[ "$confirmation" != "ROLLBACK" ]]; then
            log "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup (unless skipped)
    if [[ "$skip_backup" != true ]]; then
        create_emergency_backup "$component"
    fi
    
    # Send initial notification
    send_notification "Emergency rollback started for $component" "HIGH"
    
    # Execute rollback based on component
    case "$component" in
        "frontend")
            rollback_frontend "$target_version"
            ;;
        "backend")
            rollback_backend "$target_version"
            ;;
        "database")
            rollback_database "$target_version"
            ;;
        "contracts")
            emergency_pause_contracts
            ;;
        "infrastructure")
            rollback_infrastructure
            ;;
        "full")
            rollback_full
            ;;
        *)
            error "Unknown component: $component"
            exit 1
            ;;
    esac
    
    # Final status
    if [[ $? -eq 0 ]]; then
        success "Emergency rollback completed successfully"
        log "Incident ID: $INCIDENT_ID"
        log "Log file: $LOG_FILE"
        send_notification "Emergency rollback completed successfully for $component" "INFO"
    else
        error "Emergency rollback failed"
        log "Incident ID: $INCIDENT_ID"
        log "Log file: $LOG_FILE"
        send_notification "Emergency rollback FAILED for $component - manual intervention required" "CRITICAL"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"