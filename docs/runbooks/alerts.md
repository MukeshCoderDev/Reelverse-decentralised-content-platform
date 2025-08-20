# Alerts Runbook - Reelverse Platform

This runbook provides guidance for responding to critical alerts within the Reelverse platform.

## General Alert Response Steps

1.  **Acknowledge Alert**: Confirm receipt of the alert in the monitoring system.
2.  **Assess Impact**: Determine the scope and severity of the issue (e.g., single user, subset of users, all users, specific feature).
3.  **Check Recent Deployments**: Identify any recent code deployments or infrastructure changes that might be related.
4.  **Review Logs**: Access relevant service logs for error messages, stack traces, or unusual patterns.
5.  **Consult Service-Specific Runbook**: Refer to the detailed steps for the specific alert type below.
6.  **Communicate**: Inform relevant stakeholders (e.g., team, product, leadership) about the incident and its status.
7.  **Escalate**: If unable to resolve within defined timeframes or if the impact is severe, escalate to the appropriate on-call engineer or team.
8.  **Document**: After resolution, document the incident, root cause, and resolution steps for future reference.

## Specific Alerts

### 1. Bundler Down

*   **Description**: The Account Abstraction (AA) Bundler service is unresponsive or reporting unhealthy.
*   **Threshold**: No successful responses from Bundler health check for 5 minutes.
*   **On-Call Steps**:
    1.  **Verify Bundler Status**:
        *   Check Bundler service logs for errors.
        *   Attempt to ping the Bundler endpoint directly.
    2.  **Restart Bundler Service**:
        *   If the service is down, attempt a graceful restart.
        *   If restart fails, investigate underlying infrastructure (e.g., server, network).
    3.  **Check Dependencies**: Ensure RPC nodes and other Bundler dependencies are healthy.
    4.  **Escalate**: If the Bundler remains down, escalate to the blockchain infrastructure team.

### 2. Paymaster Budget Low

*   **Description**: The Paymaster service's gas sponsorship budget is critically low.
*   **Threshold**: Remaining budget falls below 1 ETH (or configured equivalent).
*   **On-Call Steps**:
    1.  **Check Paymaster Wallet Balance**:
        *   Verify the current balance of the Paymaster's associated wallet on the blockchain explorer.
    2.  **Top-Up Paymaster**:
        *   Initiate a top-up transaction to replenish the Paymaster's budget. Follow established procedures for funding.
    3.  **Review Usage Patterns**:
        *   Analyze recent user operation volume and gas consumption to understand the rate of budget depletion.
        *   Consider adjusting the alert threshold or top-up frequency if usage has significantly increased.
    4.  **Escalate**: If unable to top-up or if the issue recurs frequently, escalate to the finance/operations team responsible for crypto asset management.

### 3. Queue Backlog

*   **Description**: A critical message queue (e.g., for user operations, webhooks, analytics events) has a growing backlog.
*   **Threshold**: Queue size exceeds 1000 messages for 10 minutes.
*   **On-Call Steps**:
    1.  **Identify Affected Queue**: Determine which specific queue is experiencing the backlog.
    2.  **Check Consumer Health**:
        *   Verify that the consumers processing messages from this queue are running and healthy.
        *   Check consumer service logs for errors or performance bottlenecks.
    3.  **Scale Consumers**:
        *   If consumers are healthy but overwhelmed, consider temporarily scaling up the number of consumer instances.
    4.  **Investigate Upstream**:
        *   Look for issues in the service that produces messages to this queue (e.g., a sudden spike in requests, a bug causing excessive message generation).
    5.  **Clear Poison Messages**: If specific malformed messages are blocking the queue, identify and move them to a dead-letter queue if configured.
    6.  **Escalate**: If the backlog continues to grow or consumers are consistently failing, escalate to the relevant service owner.

### 4. Webhook Signature Failures

*   **Description**: The system is failing to verify signatures on incoming webhooks from external services.
*   **Threshold**: More than 5 signature verification failures in a 1-minute window.
*   **On-Call Steps**:
    1.  **Check Shared Secrets**:
        *   Verify that the shared secret used for webhook signature verification is correct and matches the external service's configuration.
        *   Ensure no recent secret rotations have occurred without proper updates.
    2.  **Review Incoming Payload**:
        *   Examine the raw incoming webhook payload and headers to ensure they match expected format.
        *   Check for any encoding issues or unexpected characters.
    3.  **Check Clock Skew**:
        *   Ensure the system's clock is synchronized with NTP. Significant clock skew can cause timestamp-based signature verification to fail.
    4.  **Contact External Service Provider**:
        *   If all internal checks pass, contact the external service provider to confirm their webhook configuration and shared secret.
    5.  **Escalate**: If the issue persists, escalate to the integration team.

### 5. Canary Failure

*   **Description**: The hourly sponsored User Operation (UserOp) health check canary script has failed.
*   **Threshold**: Canary script exits with a non-zero status code.
*   **On-Call Steps**:
    1.  **Review Canary Logs**:
        *   Examine the output of the `canary:aa` job for specific error messages (e.g., bundler error, paymaster error, transaction timeout).
    2.  **Check Dependent Services**:
        *   Based on the canary error, check the health of the Bundler, Paymaster, and RPC services. (Refer to "Bundler Down" or "Paymaster Budget Low" alerts if applicable).
    3.  **Verify Environment Variables**:
        *   Ensure `DEV_OWNER_PRIVATE_KEY`, `BUNDLER_URL`, `ENTRY_POINT_ADDRESS`, `RPC_URL`, and `PAYMASTER_URL` are correctly configured in the non-prod environment where the canary runs.
    4.  **Manually Run Canary**:
        *   Attempt to run the canary script manually in the affected environment to reproduce the issue and gather more detailed logs: `cd api && npm run canary:aa`
    5.  **Escalate**: If the underlying issue cannot be quickly identified and resolved, escalate to the AA team.