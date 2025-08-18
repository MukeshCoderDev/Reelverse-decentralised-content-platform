# Implementation Plan

## M0: Foundations (Week 1)

- [x] 1. Set up core infrastructure and shared components

  - Create project structure for microservices architecture with mTLS/service tokens
  - Implement event bus with schema validation and correlation-ID propagation library
  - Set up WORM audit sink for license issue/revoke, takedown, key rotate from day 1
  - Configure database connections and migrations with PII redaction at exporters
  - _Requirements: 10.1, 10.2, 25.1, 25.2_

- [x] 1.1 Implement feature flags system

  - Create dynamic feature flag system with 30-second propagation
  - Add permanent storage off by default, kill switch, geo/age policy toggles
  - Implement rate limits: license 100/user/min, uploads 10/org/min, takedowns 5/day
  - Build configuration validation and rollback capabilities
  - _Requirements: 27.1, 27.2, 27.3_

- [x] 1.2 Build monitoring and metrics foundation

  - Create real-time metrics collection with timers for license issuance, edge authorize, upload→preview
  - Build alerting for SLA violations and security events with thresholds
  - Add operational dashboards for system health monitoring
  - Implement structured logging with correlation IDs and secrets redaction
  - _Requirements: 10.5, 10.6, 26.6_

- [x] 1.3 Implement audit and observability baseline

  - Create immutable audit logs with cryptographic integrity and 7+ year retention
  - Implement structured event emission with correlation IDs and user context
  - Add security event correlation and threat intelligence
  - Build compliance audit reporting without PII exposure
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_

## M1: Media Pipeline to First Secure Playback (Week 2)

- [x] 2. Implement upload service with multipart support

  - Create resumable multipart upload endpoints with idempotency keys
  - Implement malware and CSAM scanning integration with test whitelists
  - Add upload session management with cleanup and max 50GB support
  - Configure storage buckets and AV scanning vendor keys
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 3. Build transcoding service with Livepeer integration

  - Implement Livepeer API client with ABR ladder and profiles configuration
  - Create transcoding job management with exponential backoff retry logic
  - Add webhook signature verification, replay protection, and idempotent job updates
  - Configure webhook secrets and job status tracking
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 4. Develop content packaging and encryption pipeline

  - Implement CMAF HLS packaging with CENC format
  - Create envelope encryption for content keys using KMS/HSM
  - Build manifest generation with internal key URIs and purge policy for clear masters
  - Add atomic key rotation functionality with manifest version bumping
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Create DRM license and key delivery service (Phase 1: AES-HLS + Widevine)

  - Implement device-bound license issuance with TTL ≤ 5 minutes
  - Build key delivery with license claims set and concurrency policy
  - Add device registration with fingerprinting and binding fields
  - Create license revocation and session management with no keys in logs

  - Write performance tests to meet P95 ≤ 250ms, P99 ≤ 500ms SLA
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 7. Implement CDN authorization and edge handshake



  - Create real-time segment authorization with P95 ≤ 50ms (≤ 80ms cache miss)
  - Build manifest sanitization with internal key URIs and ticket JWT format
  - Implement short-lived key token delivery (≤60s TTL) with cache TTL rules
  - Add deny-by-default behavior with cold-start grace toggle and edge cache management
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

## M2: Access Control, Monetization, and Safety (Week 3)

- [x] 6. Build policy engine and authorization system



  - Implement policy evaluation for geo, age, subscription, device limits
  - Create signed playback ticket generation with embedded entitlements
  - Add geo-restriction enforcement with audit logging
  - Build age verification integration and subscription validation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 8. Create payment and entitlement system (start with CCBill + crypto)

  - Implement single processor payment handling with sandbox credentials
  - Build entitlement creation and validation logic with SKU taxonomy
  - Add webhook normalization with HMAC secrets and replay protection
  - Create chargeback and refund handling workflows with entitlement adjustment
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 11. Build takedown and kill switch system

  - Implement takedown case management with roles and SLA clocks
  - Create immediate content restriction (≤60 seconds) with cache purge triggers
  - Build kill switch for key revocation and playlist invalidation
  - Add immutable audit logging for legal compliance with notify list
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 17. Build emergency key rotation system
  - Create emergency re-keying (P99 ≤ 5 minutes globally)
  - Add key history audit trails and operator tracking
  - Build backward compatibility for active sessions
  - Implement automatic rotation on compromise detection with CDN purge
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8_

## M3: Compliance + Minimal Decentralization + On-Chain (Week 3 continued)

- [ ] 9. Build minimal age verification and 2257 compliance

  - Implement viewer age verification flag with jurisdiction-specific rules
  - Create performer document upload to Vault with encrypted storage
  - Build attestation hash generation for on-chain storage without PII exposure
  - Add compliance audit capabilities with hash-based verification
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 12. Create minimal storage replication (R2 primary + 1 decentralized)

  - Implement R2 primary storage with one decentralized backend (Storj or Filecoin)
  - Build encrypted blob storage with clear master purging after encryption
  - Add content integrity verification and availability proof recording
  - Create proof record generation with hash-of-hash + timestamp + provider attestations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 16. Implement minimal on-chain coordinator
  - Create UploadManager contract integration for requestUpload + finalize + cancel
  - Build ContentRegistry commitment for finalized content with event indexing
  - Add transaction retry logic with state consistency (no per-step mirroring yet)
  - Create indexed event querying by uploadId/contentId with no PII on-chain
  - _Requirements: 16.1, 16.3, 16.4, 16.5, 16.6, 16.7_

## Deferred/Stubbed for Test Mode

- [ ] 10. Implement basic watermarking (static overlays only)

  - Create static overlay watermark application (defer forensic embedding)
  - Build basic fingerprint generation for duplicate detection
  - Stub forensic watermark vendor integration for future implementation
  - _Requirements: 9.1, 9.3, 9.6 (partial)_

- [ ] 13. Implement manual leak detection (defer crawler network)

  - Create manual leak ingestion interface
  - Build basic DMCA takedown template generation
  - Stub automated crawler network integration for future implementation
  - _Requirements: 22.1, 22.2 (partial)_

- [ ] 15. Implement basic RBAC (defer analytics and bulk ops)
  - Create basic role-based access control enforcement
  - Implement organization creation with basic quotas
  - Defer usage analytics and bulk operation workflows
  - _Requirements: 14.1, 14.2 (partial)_

## Test Mode Validation Tasks

- [ ] 26. Build critical path testing suite

  - Create 10 E2E scenarios: upload→play, payment→play, revoke→deny, takedown→deny, re-key during playback
  - Implement synthetic canaries: hourly license issuance and edge authorization from 3 regions
  - Add chaos drills: temporarily block KMS or Livepeer, ensure graceful failure
  - Build SLA monitoring: edge authorize ≤ 50ms P95, license ≤ 250ms P95
  - _Requirements: All critical path validation_

- [ ] 27. Deploy test mode infrastructure
  - Set up single CDN with pre-approved fallback configuration
  - Configure sandbox environments for all external services
  - Deploy monitoring and alerting with SLA breach detection
  - Set up secrets management with structured scanning in CI
  - _Requirements: Production readiness for test mode_

## Definition of Done per Milestone

### M1 DoD (First Secure Play)

- Upload→Transcode→Package/Encrypt→R2 store→Ticket→License→Edge authorize→Playback OK
- P95 edge authorize ≤ 50ms (≤ 80ms on cache miss); P95 license ≤ 250ms
- Clear masters purged after encryption; no keys in logs; WORM audit entries present

### M2 DoD (Monetized + Safe)

- CCBill sandbox purchase → entitlement → playback allowed; refund/chargeback → entitlement adjusted
- Concurrency cap enforced; 3rd session denied with device management prompt
- Takedown: restrict → deny within 60s; kill → keys revoked + manifest bumped + purge

### M3 DoD (Compliance + Minimal Decentralization + Chain)

- Viewer age-verified flag gates adult playback; creator/performer docs in Vault; attestation hash on-chain
- Replication to one decentralized network; proof record saved; availability check passes
- On-chain finalize emits events mapped to contentId; no PII on-chain
