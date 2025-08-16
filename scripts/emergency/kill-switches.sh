#!/bin/bash

# Kill Switches Script
# Emergency feature disabling and system protection

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/kill-switches-$(date +%Y%m%d_%H%M%S).log"
INCIDENT_ID="KS-$(date +%Y%m%d_%H%M%S)"

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
Kill Switches Script - Emergency Feature Control

Usage: $0 [OPTIONS] ACTION [FEATURE]

ACTIONS:
    disable         Disable specified feature or system
    enable          Re-enable specified feature or system
    status          Show current status of all kill switches
    list            List all available kill switches

FEATURES:
    payments        Disable all payment processing
    uploads         Disable content uploads
    streaming       Disable video streaming
    registration    Disable new user registration
    api             Disable API access
    frontend        Disable frontend access
    smart-contracts Pause all smart contracts
    all             Disable all features (emergency mode)

OPTIONS:
    -h, --help      Show this help message
    -f, --force     Force action without confirmation
    -r, --reason    Specify reason for kill switch activation
    --duration      Specify duration (e.g., 1h, 30m, 2d)

EXAMPLES:
    $0 disable payments -r "Payment processor issue"
    $0 disable all -f --duration 1h
    $0 enable uploads
    $0 status

EMERGENCY CONTACTS:
    Platform Lead: [PHONE]
    DevOps Lead: [PHONE]
    Security Lead: [PHONE]
EOF
}

# Send notification
send_notification() {
    local message="$1"
    local severity="${2:-HIGH}"
    
    log "Sending kill switch notification..."
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🔴 KILL SWITCH ACTIVATED - $severity\\n$message\\nIncident ID: $INCIDENT_ID\"}" \
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
                    \"summary\": \"Kill Switch: $message\",
                    \"severity\": \"critical\",
                    \"source\": \"kill-switches-script\"
                }
            }" &> /dev/null || warning "Failed to send PagerDuty notification"
    fi
    
    success "Notifications sent"
}

# Update feature flag
update_feature_flag() {
    local feature="$1"
    local enabled="$2"
    local reason="$3"
    
    log "Updating feature flag: $feature = $enabled"
    
    # Update Kubernetes ConfigMap
    kubectl patch configmap feature-flags --patch "{\"data\":{\"$feature\":\"$enabled\"}}" || error "Failed to update feature flag"
    
    # Update database feature flags table
    psql "$DATABASE_URL" -c "
        INSERT INTO feature_flags (name, enabled, reason, updated_at, updated_by) 
        VALUES ('$feature', $enabled, '$reason', NOW(), 'kill-switch-script')
        ON CONFLICT (name) DO UPDATE SET 
            enabled = $enabled, 
            reason = '$reason', 
            updated_at = NOW(), 
            updated_by = 'kill-switch-script'
    " || warning "Failed to update database feature flag"
    
    # Restart relevant services to pick up changes
    case "$feature" in
        "PAYMENTS_ENABLED")
            kubectl rollout restart deployment/payment-service
            ;;
        "UPLOADS_ENABLED")
            kubectl rollout restart deployment/upload-service
            ;;
        "STREAMING_ENABLED")
            kubectl rollout restart deployment/streaming-service
            ;;
        "API_ENABLED")
            kubectl rollout restart deployment/backend
            ;;
        "FRONTEND_ENABLED")
            kubectl rollout restart deployment/frontend
            ;;
    esac
    
    success "Feature flag updated: $feature = $enabled"
}

# Disable payments
disable_payments() {
    local reason="$1"
    
    log "Disabling payment processing..."
    
    # Update feature flag
    update_feature_flag "PAYMENTS_ENABLED" "false" "$reason"
    
    # Scale down payment services
    kubectl scale deployment payment-service --replicas=0
    kubectl scale deployment payment-processor --replicas=0
    
    # Update frontend to show payment disabled message
    kubectl patch configmap app-config --patch "{\"data\":{\"PAYMENTS_DISABLED\":\"true\",\"PAYMENTS_DISABLED_REASON\":\"$reason\"}}"
    
    # Pause payment smart contracts
    if [[ -n "$PAYMENT_CONTRACT" && -n "$ADMIN_PRIVATE_KEY" ]]; then
        cast send "$PAYMENT_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || warning "Failed to pause payment contract"
    fi
    
    success "Payment processing disabled"
    send_notification "Payment processing has been disabled: $reason" "CRITICAL"
}

# Enable payments
enable_payments() {
    log "Enabling payment processing..."
    
    # Update feature flag
    update_feature_flag "PAYMENTS_ENABLED" "true" "Re-enabled via kill switch"
    
    # Scale up payment services
    kubectl scale deployment payment-service --replicas=3
    kubectl scale deployment payment-processor --replicas=2
    
    # Wait for services to be ready
    kubectl rollout status deployment/payment-service --timeout=300s
    kubectl rollout status deployment/payment-processor --timeout=300s
    
    # Update frontend to remove disabled message
    kubectl patch configmap app-config --patch '{"data":{"PAYMENTS_DISABLED":"false"}}'
    
    # Unpause payment smart contracts
    if [[ -n "$PAYMENT_CONTRACT" && -n "$ADMIN_PRIVATE_KEY" ]]; then
        cast send "$PAYMENT_CONTRACT" "unpause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || warning "Failed to unpause payment contract"
    fi
    
    success "Payment processing enabled"
    send_notification "Payment processing has been re-enabled" "INFO"
}

# Disable uploads
disable_uploads() {
    local reason="$1"
    
    log "Disabling content uploads..."
    
    # Update feature flag
    update_feature_flag "UPLOADS_ENABLED" "false" "$reason"
    
    # Scale down upload services
    kubectl scale deployment upload-service --replicas=0
    kubectl scale deployment transcoding-service --replicas=0
    
    # Update frontend to show uploads disabled message
    kubectl patch configmap app-config --patch "{\"data\":{\"UPLOADS_DISABLED\":\"true\",\"UPLOADS_DISABLED_REASON\":\"$reason\"}}"
    
    success "Content uploads disabled"
    send_notification "Content uploads have been disabled: $reason" "HIGH"
}

# Enable uploads
enable_uploads() {
    log "Enabling content uploads..."
    
    # Update feature flag
    update_feature_flag "UPLOADS_ENABLED" "true" "Re-enabled via kill switch"
    
    # Scale up upload services
    kubectl scale deployment upload-service --replicas=3
    kubectl scale deployment transcoding-service --replicas=2
    
    # Wait for services to be ready
    kubectl rollout status deployment/upload-service --timeout=300s
    kubectl rollout status deployment/transcoding-service --timeout=300s
    
    # Update frontend to remove disabled message
    kubectl patch configmap app-config --patch '{"data":{"UPLOADS_DISABLED":"false"}}'
    
    success "Content uploads enabled"
    send_notification "Content uploads have been re-enabled" "INFO"
}

# Disable streaming
disable_streaming() {
    local reason="$1"
    
    log "Disabling video streaming..."
    
    # Update feature flag
    update_feature_flag "STREAMING_ENABLED" "false" "$reason"
    
    # Scale down streaming services
    kubectl scale deployment streaming-service --replicas=0
    kubectl scale deployment video-processor --replicas=0
    
    # Update CDN to block video requests
    if [[ -n "$CDN_DISTRIBUTION_ID" ]]; then
        aws cloudfront update-distribution --id "$CDN_DISTRIBUTION_ID" --distribution-config file:///configs/streaming-disabled.json &> /dev/null || warning "Failed to update CDN config"
    fi
    
    # Update frontend to show streaming disabled message
    kubectl patch configmap app-config --patch "{\"data\":{\"STREAMING_DISABLED\":\"true\",\"STREAMING_DISABLED_REASON\":\"$reason\"}}"
    
    success "Video streaming disabled"
    send_notification "Video streaming has been disabled: $reason" "HIGH"
}

# Enable streaming
enable_streaming() {
    log "Enabling video streaming..."
    
    # Update feature flag
    update_feature_flag "STREAMING_ENABLED" "true" "Re-enabled via kill switch"
    
    # Scale up streaming services
    kubectl scale deployment streaming-service --replicas=5
    kubectl scale deployment video-processor --replicas=3
    
    # Wait for services to be ready
    kubectl rollout status deployment/streaming-service --timeout=300s
    kubectl rollout status deployment/video-processor --timeout=300s
    
    # Update CDN to allow video requests
    if [[ -n "$CDN_DISTRIBUTION_ID" ]]; then
        aws cloudfront update-distribution --id "$CDN_DISTRIBUTION_ID" --distribution-config file:///configs/streaming-enabled.json &> /dev/null || warning "Failed to update CDN config"
    fi
    
    # Update frontend to remove disabled message
    kubectl patch configmap app-config --patch '{"data":{"STREAMING_DISABLED":"false"}}'
    
    success "Video streaming enabled"
    send_notification "Video streaming has been re-enabled" "INFO"
}

# Disable registration
disable_registration() {
    local reason="$1"
    
    log "Disabling user registration..."
    
    # Update feature flag
    update_feature_flag "REGISTRATION_ENABLED" "false" "$reason"
    
    # Update frontend to show registration disabled message
    kubectl patch configmap app-config --patch "{\"data\":{\"REGISTRATION_DISABLED\":\"true\",\"REGISTRATION_DISABLED_REASON\":\"$reason\"}}"
    
    success "User registration disabled"
    send_notification "User registration has been disabled: $reason" "MEDIUM"
}

# Enable registration
enable_registration() {
    log "Enabling user registration..."
    
    # Update feature flag
    update_feature_flag "REGISTRATION_ENABLED" "true" "Re-enabled via kill switch"
    
    # Update frontend to remove disabled message
    kubectl patch configmap app-config --patch '{"data":{"REGISTRATION_DISABLED":"false"}}'
    
    success "User registration enabled"
    send_notification "User registration has been re-enabled" "INFO"
}

# Disable API
disable_api() {
    local reason="$1"
    
    log "Disabling API access..."
    
    # Update feature flag
    update_feature_flag "API_ENABLED" "false" "$reason"
    
    # Scale down API services
    kubectl scale deployment backend --replicas=1  # Keep minimal for health checks
    
    # Update load balancer to return maintenance page
    kubectl patch configmap nginx-config --patch '{"data":{"maintenance_mode":"true"}}'
    kubectl rollout restart deployment/nginx
    
    success "API access disabled"
    send_notification "API access has been disabled: $reason" "CRITICAL"
}

# Enable API
enable_api() {
    log "Enabling API access..."
    
    # Update feature flag
    update_feature_flag "API_ENABLED" "true" "Re-enabled via kill switch"
    
    # Scale up API services
    kubectl scale deployment backend --replicas=5
    
    # Wait for services to be ready
    kubectl rollout status deployment/backend --timeout=300s
    
    # Update load balancer to allow normal traffic
    kubectl patch configmap nginx-config --patch '{"data":{"maintenance_mode":"false"}}'
    kubectl rollout restart deployment/nginx
    
    success "API access enabled"
    send_notification "API access has been re-enabled" "INFO"
}

# Disable frontend
disable_frontend() {
    local reason="$1"
    
    log "Disabling frontend access..."
    
    # Update feature flag
    update_feature_flag "FRONTEND_ENABLED" "false" "$reason"
    
    # Scale down frontend
    kubectl scale deployment frontend --replicas=0
    
    # Deploy maintenance page
    kubectl apply -f /configs/maintenance-page.yaml
    
    # Update CDN to serve maintenance page
    if [[ -n "$CDN_DISTRIBUTION_ID" ]]; then
        aws cloudfront update-distribution --id "$CDN_DISTRIBUTION_ID" --distribution-config file:///configs/maintenance-mode.json &> /dev/null || warning "Failed to update CDN config"
    fi
    
    success "Frontend access disabled"
    send_notification "Frontend access has been disabled: $reason" "CRITICAL"
}

# Enable frontend
enable_frontend() {
    log "Enabling frontend access..."
    
    # Update feature flag
    update_feature_flag "FRONTEND_ENABLED" "true" "Re-enabled via kill switch"
    
    # Scale up frontend
    kubectl scale deployment frontend --replicas=3
    
    # Wait for frontend to be ready
    kubectl rollout status deployment/frontend --timeout=300s
    
    # Remove maintenance page
    kubectl delete -f /configs/maintenance-page.yaml --ignore-not-found
    
    # Update CDN to serve normal content
    if [[ -n "$CDN_DISTRIBUTION_ID" ]]; then
        aws cloudfront update-distribution --id "$CDN_DISTRIBUTION_ID" --distribution-config file:///configs/normal-mode.json &> /dev/null || warning "Failed to update CDN config"
    fi
    
    success "Frontend access enabled"
    send_notification "Frontend access has been re-enabled" "INFO"
}

# Disable smart contracts
disable_smart_contracts() {
    local reason="$1"
    
    log "Pausing smart contracts..."
    
    if [[ -z "$ADMIN_PRIVATE_KEY" ]]; then
        error "ADMIN_PRIVATE_KEY not set"
        return 1
    fi
    
    # Pause all contracts
    cast send "$PAYMENT_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause payment contract"
    cast send "$CONTENT_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause content contract"
    cast send "$REVENUE_CONTRACT" "pause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to pause revenue contract"
    
    # Update frontend to show contracts paused
    kubectl patch configmap app-config --patch "{\"data\":{\"CONTRACTS_PAUSED\":\"true\",\"CONTRACTS_PAUSED_REASON\":\"$reason\"}}"
    
    success "Smart contracts paused"
    send_notification "Smart contracts have been paused: $reason" "CRITICAL"
}

# Enable smart contracts
enable_smart_contracts() {
    log "Unpausing smart contracts..."
    
    if [[ -z "$ADMIN_PRIVATE_KEY" ]]; then
        error "ADMIN_PRIVATE_KEY not set"
        return 1
    fi
    
    # Unpause all contracts
    cast send "$PAYMENT_CONTRACT" "unpause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to unpause payment contract"
    cast send "$CONTENT_CONTRACT" "unpause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to unpause content contract"
    cast send "$REVENUE_CONTRACT" "unpause()" --private-key "$ADMIN_PRIVATE_KEY" --rpc-url "$RPC_URL" &> /dev/null || error "Failed to unpause revenue contract"
    
    # Update frontend to remove paused message
    kubectl patch configmap app-config --patch '{"data":{"CONTRACTS_PAUSED":"false"}}'
    
    success "Smart contracts unpaused"
    send_notification "Smart contracts have been unpaused" "INFO"
}

# Disable all features (emergency mode)
disable_all() {
    local reason="$1"
    
    log "Activating emergency mode - disabling all features..."
    
    # Disable all features
    disable_payments "$reason"
    disable_uploads "$reason"
    disable_streaming "$reason"
    disable_registration "$reason"
    disable_smart_contracts "$reason"
    
    # Set emergency mode
    kubectl patch configmap app-config --patch "{\"data\":{\"EMERGENCY_MODE\":\"true\",\"EMERGENCY_REASON\":\"$reason\"}}"
    
    # Scale down non-essential services
    kubectl scale deployment worker --replicas=0
    kubectl scale deployment analytics-service --replicas=0
    kubectl scale deployment notification-service --replicas=0
    
    success "Emergency mode activated - all features disabled"
    send_notification "EMERGENCY MODE ACTIVATED - All features disabled: $reason" "CRITICAL"
}

# Enable all features
enable_all() {
    log "Deactivating emergency mode - enabling all features..."
    
    # Enable all features
    enable_payments
    enable_uploads
    enable_streaming
    enable_registration
    enable_smart_contracts
    
    # Disable emergency mode
    kubectl patch configmap app-config --patch '{"data":{"EMERGENCY_MODE":"false"}}'
    
    # Scale up services
    kubectl scale deployment worker --replicas=3
    kubectl scale deployment analytics-service --replicas=2
    kubectl scale deployment notification-service --replicas=2
    
    success "Emergency mode deactivated - all features enabled"
    send_notification "Emergency mode deactivated - all features re-enabled" "INFO"
}

# Show status of all kill switches
show_status() {
    log "Kill Switch Status Report"
    log "========================"
    
    # Get feature flags from ConfigMap
    local feature_flags
    feature_flags=$(kubectl get configmap feature-flags -o jsonpath='{.data}' 2>/dev/null || echo "{}")
    
    # Get app config
    local app_config
    app_config=$(kubectl get configmap app-config -o jsonpath='{.data}' 2>/dev/null || echo "{}")
    
    # Check each feature
    echo
    echo "Feature Status:"
    echo "==============="
    
    # Payments
    local payments_enabled
    payments_enabled=$(echo "$feature_flags" | jq -r '.PAYMENTS_ENABLED // "true"')
    if [[ "$payments_enabled" == "true" ]]; then
        echo -e "Payments: ${GREEN}ENABLED${NC}"
    else
        echo -e "Payments: ${RED}DISABLED${NC}"
    fi
    
    # Uploads
    local uploads_enabled
    uploads_enabled=$(echo "$feature_flags" | jq -r '.UPLOADS_ENABLED // "true"')
    if [[ "$uploads_enabled" == "true" ]]; then
        echo -e "Uploads: ${GREEN}ENABLED${NC}"
    else
        echo -e "Uploads: ${RED}DISABLED${NC}"
    fi
    
    # Streaming
    local streaming_enabled
    streaming_enabled=$(echo "$feature_flags" | jq -r '.STREAMING_ENABLED // "true"')
    if [[ "$streaming_enabled" == "true" ]]; then
        echo -e "Streaming: ${GREEN}ENABLED${NC}"
    else
        echo -e "Streaming: ${RED}DISABLED${NC}"
    fi
    
    # Registration
    local registration_enabled
    registration_enabled=$(echo "$feature_flags" | jq -r '.REGISTRATION_ENABLED // "true"')
    if [[ "$registration_enabled" == "true" ]]; then
        echo -e "Registration: ${GREEN}ENABLED${NC}"
    else
        echo -e "Registration: ${RED}DISABLED${NC}"
    fi
    
    # API
    local api_enabled
    api_enabled=$(echo "$feature_flags" | jq -r '.API_ENABLED // "true"')
    if [[ "$api_enabled" == "true" ]]; then
        echo -e "API: ${GREEN}ENABLED${NC}"
    else
        echo -e "API: ${RED}DISABLED${NC}"
    fi
    
    # Frontend
    local frontend_enabled
    frontend_enabled=$(echo "$feature_flags" | jq -r '.FRONTEND_ENABLED // "true"')
    if [[ "$frontend_enabled" == "true" ]]; then
        echo -e "Frontend: ${GREEN}ENABLED${NC}"
    else
        echo -e "Frontend: ${RED}DISABLED${NC}"
    fi
    
    # Smart Contracts
    if [[ -n "$PAYMENT_CONTRACT" ]]; then
        local contracts_paused
        contracts_paused=$(cast call "$PAYMENT_CONTRACT" "paused()" --rpc-url "$RPC_URL" 2>/dev/null || echo "unknown")
        if [[ "$contracts_paused" == "false" ]]; then
            echo -e "Smart Contracts: ${GREEN}ACTIVE${NC}"
        else
            echo -e "Smart Contracts: ${RED}PAUSED${NC}"
        fi
    else
        echo -e "Smart Contracts: ${YELLOW}NOT CONFIGURED${NC}"
    fi
    
    # Emergency Mode
    local emergency_mode
    emergency_mode=$(echo "$app_config" | jq -r '.EMERGENCY_MODE // "false"')
    if [[ "$emergency_mode" == "true" ]]; then
        echo -e "Emergency Mode: ${RED}ACTIVE${NC}"
        local emergency_reason
        emergency_reason=$(echo "$app_config" | jq -r '.EMERGENCY_REASON // "Unknown"')
        echo "  Reason: $emergency_reason"
    else
        echo -e "Emergency Mode: ${GREEN}INACTIVE${NC}"
    fi
    
    echo
    echo "Service Replicas:"
    echo "================"
    kubectl get deployments -o custom-columns=NAME:.metadata.name,REPLICAS:.spec.replicas,AVAILABLE:.status.availableReplicas
    
    echo
    log "Status report completed"
}

# List available kill switches
list_switches() {
    log "Available Kill Switches"
    log "======================="
    
    echo
    echo "Individual Features:"
    echo "  payments        - Payment processing"
    echo "  uploads         - Content uploads"
    echo "  streaming       - Video streaming"
    echo "  registration    - User registration"
    echo "  api             - API access"
    echo "  frontend        - Frontend access"
    echo "  smart-contracts - Smart contract operations"
    echo
    echo "System-wide:"
    echo "  all             - All features (emergency mode)"
    echo
    echo "Use 'disable <feature>' to activate kill switch"
    echo "Use 'enable <feature>' to deactivate kill switch"
    echo "Use 'status' to see current state"
}

# Main function
main() {
    local action=""
    local feature=""
    local reason="Manual kill switch activation"
    local force=false
    local duration=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -r|--reason)
                reason="$2"
                shift 2
                ;;
            --duration)
                duration="$2"
                shift 2
                ;;
            disable|enable|status|list)
                action="$1"
                shift
                ;;
            payments|uploads|streaming|registration|api|frontend|smart-contracts|all)
                feature="$1"
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate action
    if [[ -z "$action" ]]; then
        error "Action must be specified"
        show_help
        exit 1
    fi
    
    # Start logging
    log "Kill Switches Script Started"
    log "Incident ID: $INCIDENT_ID"
    log "Action: $action"
    log "Feature: ${feature:-"N/A"}"
    log "Reason: $reason"
    log "Force: $force"
    log "Duration: ${duration:-"indefinite"}"
    
    # Handle actions that don't require feature
    case "$action" in
        "status")
            show_status
            exit 0
            ;;
        "list")
            list_switches
            exit 0
            ;;
    esac
    
    # Validate feature for disable/enable actions
    if [[ -z "$feature" ]]; then
        error "Feature must be specified for $action action"
        show_help
        exit 1
    fi
    
    # Confirmation prompt (unless forced)
    if [[ "$force" != true ]]; then
        echo
        if [[ "$action" == "disable" ]]; then
            warning "This will DISABLE $feature"
            warning "This may impact user experience and platform functionality!"
        else
            warning "This will ENABLE $feature"
        fi
        echo
        read -p "Are you sure you want to continue? (type 'CONFIRM' to proceed): " confirmation
        
        if [[ "$confirmation" != "CONFIRM" ]]; then
            log "Action cancelled by user"
            exit 0
        fi
    fi
    
    # Execute action
    case "$action" in
        "disable")
            case "$feature" in
                "payments")
                    disable_payments "$reason"
                    ;;
                "uploads")
                    disable_uploads "$reason"
                    ;;
                "streaming")
                    disable_streaming "$reason"
                    ;;
                "registration")
                    disable_registration "$reason"
                    ;;
                "api")
                    disable_api "$reason"
                    ;;
                "frontend")
                    disable_frontend "$reason"
                    ;;
                "smart-contracts")
                    disable_smart_contracts "$reason"
                    ;;
                "all")
                    disable_all "$reason"
                    ;;
                *)
                    error "Unknown feature: $feature"
                    exit 1
                    ;;
            esac
            ;;
        "enable")
            case "$feature" in
                "payments")
                    enable_payments
                    ;;
                "uploads")
                    enable_uploads
                    ;;
                "streaming")
                    enable_streaming
                    ;;
                "registration")
                    enable_registration
                    ;;
                "api")
                    enable_api
                    ;;
                "frontend")
                    enable_frontend
                    ;;
                "smart-contracts")
                    enable_smart_contracts
                    ;;
                "all")
                    enable_all
                    ;;
                *)
                    error "Unknown feature: $feature"
                    exit 1
                    ;;
            esac
            ;;
    esac
    
    # Schedule re-enable if duration specified
    if [[ -n "$duration" && "$action" == "disable" ]]; then
        log "Scheduling re-enable in $duration"
        
        # Convert duration to seconds
        local seconds
        case "$duration" in
            *h) seconds=$((${duration%h} * 3600)) ;;
            *m) seconds=$((${duration%m} * 60)) ;;
            *d) seconds=$((${duration%d} * 86400)) ;;
            *) seconds="$duration" ;;
        esac
        
        # Schedule re-enable
        (sleep "$seconds" && "$0" enable "$feature" -f -r "Automatic re-enable after $duration") &
        local job_pid=$!
        log "Scheduled re-enable job PID: $job_pid"
    fi
    
    # Final status
    log "Kill switch operation completed successfully"
    log "Incident ID: $INCIDENT_ID"
    log "Log file: $LOG_FILE"
}

# Run main function with all arguments
main "$@"