# Walletless Core for ERC-4337

This document outlines the architecture and API endpoints for the walletless core implementation using ERC-4337 Account Abstraction.

## Architecture Overview

The walletless core enables users to interact with the blockchain without directly managing private keys for their smart accounts. It leverages ERC-4337 to abstract away the complexities of transaction signing and gas payment.

Key components include:

*   **Smart Account Service (`SmartAccountService.ts`)**: Manages the creation and deployment of counterfactual smart account addresses. It provides utilities for generating deterministic smart account addresses and building `initCode` for the first UserOperation.
*   **Session Key Service (`SessionKeyService.ts`)**: Facilitates the creation, management, and revocation of ephemeral session keys. These keys can be scoped to specific contracts and functions, allowing for granular permissions and enhanced security for dApp interactions.
*   **Unified Paymaster Service (`UnifiedPaymasterService.ts`)**: Acts as an intermediary for sponsoring UserOperations. It integrates with external paymaster providers (e.g., Biconomy, Alchemy) to handle gas payments on behalf of users, providing a gasless experience.
*   **API Endpoints (`api/src/routes/aa.ts`)**: Exposes a set of RESTful APIs for interacting with the walletless core, allowing frontend applications to manage smart accounts and session keys.
*   **Centralized Configuration (`config/env.ts`, `config/chain.ts`)**: All environment-specific and chain-specific configurations are centralized for easy management and deployment.
*   **Encryption Utility (`utils/encryption.ts`)**: Provides a shared service for encrypting and decrypting sensitive data, such as private keys, using a master key.

The flow for a typical UserOperation involving a session key would be:

1.  User initiates an action in the dApp.
2.  The dApp requests a session key from the backend (`POST /api/aa/session/create`).
3.  The backend generates a session key, stores it, and constructs a UserOperation to register this session key on the user's smart account.
4.  The backend sends this UserOperation to the Unified Paymaster Service for sponsorship and submission to a bundler.
5.  Once the session key is registered on-chain, the dApp can use this session key to sign subsequent UserOperations within its defined scope and expiry.
6.  These UserOperations are also sent to the Unified Paymaster Service for sponsorship and submission.

## API Endpoints

All API endpoints are prefixed with `/api/v1/aa`.

### 1. Get Smart Account Details

`GET /api/aa/account`

Retrieves the counterfactual smart account address for the authenticated user, its deployment status, the EntryPoint address, and the current chain ID.

**Request:**
`GET /api/v1/aa/account`

**Response (200 OK):**
```json
{
  "smartAccountAddress": "0x...",
  "deployed": true,
  "entryPoint": "0x...",
  "chainId": 11155111
}
```

### 2. Create and Register Session Key

`POST /api/aa/session/create`

Generates a new ephemeral session key, stores it in the database, and registers it on the user's smart account via a UserOperation submitted to the bundler.

**Request:**
`POST /api/v1/aa/session/create`
**Headers:**
`Content-Type: application/json`
**Body:**
```json
{
  "ttlMins": 60,
  "scope": {
    "targets": ["0xContentAccessGateAddress", "0xUploadManagerAddress"],
    "selectors": ["0xabcdef01", "0x12345678"]
  }
}
```

**Response (201 Created):**
```json
{
  "sessionKeyId": "uuid-of-session-key",
  "publicKey": "0x...",
  "expiresAt": "2025-08-20T10:00:00.000Z",
  "userOpHash": "0x..."
}
```

### 3. Revoke Session Key

`POST /api/aa/session/revoke`

Revokes an existing session key by marking it as revoked in the database and submitting a UserOperation to revoke it on the smart account.

**Request:**
`POST /api/v1/aa/session/revoke`
**Headers:**
`Content-Type: application/json`
**Body:**
```json
{
  "sessionKeyId": "uuid-of-session-key-to-revoke"
}
```

**Response (200 OK):**
```json
{
  "message": "Session key revoked successfully.",
  "userOpHash": "0x..."
}
```

### 4. Get Active Session Status

`GET /api/aa/session/status`

Lists all active (non-expired and non-revoked) session keys for the authenticated user's smart account.

**Request:**
`GET /api/v1/aa/session/status`

**Response (200 OK):**
```json
[
  {
    "id": "uuid-of-session-key-1",
    "publicKey": "0x...",
    "scope": {
      "targets": ["0xContentAccessGateAddress"],
      "selectors": ["0xabcdef01"]
    },
    "expiresAt": "2025-08-20T10:00:00.000Z",
    "createdAt": "2025-08-19T09:00:00.000Z"
  },
  {
    "id": "uuid-of-session-key-2",
    "publicKey": "0x...",
    "scope": {
      "targets": ["0xUploadManagerAddress"],
      "selectors": ["0x12345678"]
    },
    "expiresAt": "2025-08-21T12:00:00.000Z",
    "createdAt": "2025-08-20T11:00:00.000Z"
  }
]