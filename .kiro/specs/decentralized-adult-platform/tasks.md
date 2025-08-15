# Implementation Plan

## Smart Contract Foundation (No Frontend Changes)

- [x] 1. Set up smart contract development environment alongside existing project

  - Create contracts/ directory in existing project structure
  - Initialize Foundry project with proper directory structure for smart contracts
  - Create base interfaces for all core contracts (ICreatorRegistry, IContentRegistry, INFTAccess, IRevenueSplitter)
  - Set up deployment scripts and configuration for Polygon PoS testnet
  - Configure testing environment with mock USDC token for development
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement Soul Bound Token (SBT) contracts for verification

  - Create AgeVerifiedSBT contract implementing ERC-5192 non-transferable standard
  - Create VerifiedTalentSBT contract for creator verification badges
  - Implement minting functions with proper access controls
  - Write comprehensive unit tests for SBT functionality
  - _Requirements: 2.3, 2.4, 3.2, 3.3_

- [x] 3. Build CreatorRegistry contract with verification integration

  - Implement creator registration and profile management
  - Integrate SBT verification status checking
  - Add earnings tracking and content count functionality
  - Create access control for verification status updates
  - Write unit tests for creator management flows
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Develop ContentRegistry with metadata and moderation

  - Implement content registration with IPFS metadata URIs
  - Add perceptual hash storage for anti-piracy protection
  - Create moderation status management with role-based access
  - Implement geographic restriction masks
  - Write tests for content lifecycle and moderation flows
  - _Requirements: 4.1, 4.6, 9.2, 9.3, 10.1, 10.2_

- [x] 5. Create NFTAccess contract for entitlements (ERC-1155)

  - Implement multi-token standard for PPV and subscription access
  - Create minting functions for different entitlement types
  - Add access checking logic with expiry handling
  - Implement batch operations for gas efficiency
  - Write comprehensive tests for entitlement management
  - _Requirements: 6.3, 6.4, 7.2, 7.3_

- [x] 6. Build RevenueSplitter with 90/10 creator share enforcement

  - Implement splitter creation with basis point validation
  - Enforce minimum 90% creator share requirement
  - Create automatic USDC distribution functionality
  - Add support for custom collaboration splits
  - Write tests for revenue distribution scenarios
  - _Requirements: 5.2, 5.3, 12.1, 12.2_

- [x] 7. Implement ContentAccessGate for playback authorization

  - Create access verification combining age, geo, and entitlement checks
  - Implement signed playback token generation
  - Add session-based access control
  - Create signer management for backend integration
  - Write tests for access gate scenarios
  - _Requirements: 6.1, 6.4, 6.5_

- [x] 8. Develop UploadManager for content pipeline orchestration

  - Implement upload request event emission
  - Create provisional content ID generation
  - Add upload finalization with content registration
  - Implement worker role access controls
  - Write tests for upload pipeline coordination
  - _Requirements: 4.1, 4.2, 4.6_

## Backend Services Implementation (Extending Existing Architecture)

- [x] 9. Set up backend services alongside existing frontend

  - Create api/ directory in existing project structure
  - Initialize Express.js application with TypeScript configuration matching existing frontend setup
  - Set up database connections (PostgreSQL) and Redis for queuing as separate services
  - Implement CORS, rate limiting, and security middleware compatible with existing frontend
  - Create environment configuration management that works with existing Vite setup
  - Set up logging and monitoring infrastructure
  - _Requirements: 1.1, 1.3_

- [x] 10. Enhance existing WalletContext with SIWE authentication

  - Create SIWE service that integrates with existing WalletContext.tsx
  - Add nonce generation and management to existing wallet connection flow
  - Implement SIWE message verification extending existing wallet authentication
  - Enhance existing session management with blockchain-verified JWT tokens
  - Add SIWE state to existing WalletContext without breaking current functionality
  - Write integration tests for enhanced authentication flows
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 11. Build age verification service with Persona integration

  - Create Persona KYC adapter with webhook handling
  - Implement age verification status tracking
  - Add SBT minting integration for successful verifications
  - Create verification status API endpoints
  - Write tests for KYC workflow integration
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 12. Develop content access control service

  - Implement multi-factor access checking (age, geo, entitlement)
  - Create geographic IP-based restriction logic
  - Add entitlement verification against blockchain state
  - Implement access reason reporting for blocked content
  - Write comprehensive tests for access control scenarios
  - _Requirements: 6.1, 6.2, 10.2, 10.3_

- [x] 13. Create playback token service with HLS integration

  - Implement signed JWT token generation for video playback
  - Add session-based watermark ID generation
  - Create HLS URL signing with expiry management
  - Implement token validation middleware
  - Write tests for playback authorization flows
  - _Requirements: 6.4, 6.5, 13.3_

- [x] 14. Build USDC payment processing with permit functionality

  - Implement USDC permit-based single-click purchases
  - Create transaction calldata generation for frontend
  - Add payment confirmation and entitlement minting
  - Implement revenue splitting automation
  - Write tests for crypto payment flows
  - _Requirements: 5.1, 5.2, 5.3, 12.2_

- [x] 15. Implement fiat payment integration with hosted checkout

  - Create CCBill/Segpay hosted checkout redirect logic
  - Implement webhook handling for payment confirmations
  - Add fiat-to-entitlement minting bridge
  - Create payment method validation
  - Write tests for fiat payment integration
  - _Requirements: 5.4, 5.5_

- [x] 16. Develop upload pipeline orchestration service

  - Create upload request handling with provisional ID generation
  - Implement file encryption using AES-128 CENC
  - Add Livepeer transcoding integration
  - Create dynamic watermarking application
  - Implement perceptual hash computation
  - Add content finalization and blockchain registration
  - Write tests for complete upload pipeline
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 17. Build scene consent management system

  - Create scene hash generation and participant tracking
  - Implement EIP-712 typed consent data structures
  - Add encrypted signature storage and verification
  - Create consent completion validation
  - Write tests for multi-participant consent flows
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 18. Implement moderation and DMCA service

  - Create content flagging and moderation queue management
  - Implement moderator decision processing
  - Add perceptual hash matching for DMCA detection
  - Create takedown execution and audit trail
  - Write tests for moderation workflows
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 19. Create payout management service

  - Implement balance tracking for USDC and fiat earnings
  - Create instant USDC withdrawal functionality
  - Add Paxum integration for fiat payouts
  - Implement payout method validation and storage
  - Write tests for payout processing
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

## Frontend Enhancement (Preserving Existing UI/UX)

- [x] 20. Enhance existing React application with additional Web3 capabilities

  - Add Wagmi and Viem to existing package.json for enhanced Ethereum interactions
  - Integrate React Query with existing state management patterns
  - Preserve all existing routing structure and layout components
  - Add Web3 service layer that works with existing component architecture
  - Enhance existing build pipeline to support new Web3 dependencies
  - _Requirements: 1.1, 1.3_

- [x] 21. Enhance existing wallet components with SIWE authentication

  - Extend existing WalletButton.tsx component with SIWE authentication flow
  - Enhance existing WalletConnectModal.tsx with SIWE message signing
  - Add verification badges to existing Header.tsx component
  - Extend existing WalletContext session management with SIWE verification
  - Preserve all existing wallet functionality while adding blockchain authentication
  - Write component tests for enhanced authentication flows
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 22. Add age verification to existing content system

  - Create AgeGateModal component using existing modal patterns and styling
  - Integrate Persona KYC flow with existing content access system
  - Add age verification badges to existing Header.tsx and profile components
  - Enhance existing ContentCard.tsx with age-restricted content blurring
  - Add age verification state to existing WalletContext
  - Write tests for age verification integration with existing UI flows
  - _Requirements: 2.1, 2.2, 2.4, 2.6_

- [x] 23. Enhance existing video player with access control

  - Add PlayerGuard wrapper to existing VideoPlayer.tsx component
  - Integrate multi-step access verification with existing ContentCard.tsx click handlers
  - Enhance existing YouTubeStyleVideoPlayer.tsx with blockchain entitlement checks
  - Add access control overlays using existing modal and error handling patterns
  - Preserve existing video player functionality while adding Web3 access gates
  - Write comprehensive component tests for enhanced player functionality
  - _Requirements: 6.1, 6.2, 6.6, 10.3_

- [x] 24. Add watermarking to existing video player

  - Enhance existing VideoPlayer.tsx with dynamic watermark overlay functionality
  - Add moving overlay with wallet address and session ID to existing player controls
  - Integrate watermarking with existing HLS playback and quality selection
  - Preserve existing poster image display and loading states while adding watermark
  - Extend existing player tests to include watermarking functionality
  - _Requirements: 6.5, 13.3_

- [x] 25. Add payment options to existing content access flow


  - Create CheckoutModal using existing modal patterns and styling
  - Add USDC payment tab to existing payment interfaces
  - Integrate USDC permit-based purchasing with existing wallet functionality
  - Add fiat hosted checkout to existing payment flows
  - Enhance existing payment success/failure handling with blockchain confirmations
  - Write tests for enhanced checkout flows
  - _Requirements: 5.1, 5.4, 6.2_

- [ ] 26. Enhance existing studio verification page

  - Enhance existing StudioVerifyPage.tsx with KYC integration and status display
  - Add VerifiedTalentSBT minting interface to existing studio workflow
  - Integrate verification badges with existing Header.tsx and profile components
  - Add verification requirement checks to existing studio content upload flow
  - Preserve existing studio navigation and layout while adding Web3 verification features
  - Write tests for enhanced creator verification UI
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 27. Enhance existing studio content upload

  - Enhance existing /studio/content page with Web3 upload options
  - Add storage class selection (shreddable vs permanent) to existing upload interface
  - Integrate blockchain content registration with existing ContentTable.tsx
  - Add encryption and watermarking steps to existing upload progress tracking
  - Enhance existing error handling and retry functionality with blockchain-specific errors
  - Write tests for enhanced upload wizard flows
  - _Requirements: 4.1, 4.7, 13.1, 13.2_

- [ ] 28. Add consent management to existing studio workflow

  - Create ConsentStepper component using existing studio styling and patterns
  - Add participant invitation and tracking to existing studio content creation flow
  - Integrate EIP-712 signature collection with existing wallet functionality
  - Add consent status visualization to existing ContentTable.tsx and studio dashboard
  - Enhance existing studio workflow with consent requirements before publishing
  - Write tests for consent management integration with existing UI
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 29. Enhance existing earnings and splits pages

  - Add SplitEditor component to existing /studio/splits page with validation
  - Enhance existing /earnings page with blockchain balance display and instant USDC withdrawals
  - Add crypto payout options to existing payout method management
  - Integrate revenue splitting with existing studio monetization workflow
  - Preserve existing financial UI patterns while adding Web3 capabilities
  - Write tests for enhanced financial management UI
  - _Requirements: 5.2, 12.1, 12.2, 12.4_

- [ ] 30. Enhance existing studio moderation page
  - Enhance existing /studio/moderation page with blockchain-based moderation queue
  - Add DMCA perceptual hash matching to existing content review interface
  - Integrate blockchain takedown actions with existing moderation decisions
  - Add blockchain audit trail to existing moderation history tracking
  - Preserve existing moderation UI patterns while adding Web3 compliance features
  - Write tests for enhanced moderation workflows
  - _Requirements: 9.1, 9.2, 9.4, 9.6_

## Integration and Testing

- [ ] 31. Set up The Graph subgraph for blockchain indexing

  - Create subgraph schema for creators, content, and entitlements
  - Implement event handlers for all contract events
  - Add revenue split and moderation event tracking
  - Deploy subgraph to The Graph network
  - Write tests for subgraph data accuracy
  - _Requirements: All requirements for data querying_

- [ ] 32. Implement comprehensive error handling and user feedback

  - Create error boundary components for React application
  - Implement user-friendly error messages for all failure scenarios
  - Add retry mechanisms for transient failures
  - Create error logging and monitoring integration
  - Write tests for error handling scenarios
  - _Requirements: All requirements for error cases_

- [ ] 33. Add feature flag system for platform configuration

  - Implement feature flag service with remote configuration
  - Add flags for age blur, crypto-only mode, verification requirements
  - Create admin interface for flag management
  - Add geographic feature flag support
  - Write tests for feature flag functionality
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 34. Implement audit trail and evidence pack generation

  - Create comprehensive logging for all user actions
  - Implement evidence pack compilation for legal compliance
  - Add watermark session tracking
  - Create consent hash verification
  - Write tests for audit trail completeness
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 35. Set up monitoring, analytics, and performance tracking

  - Implement playback quality metrics collection
  - Add business KPI tracking (conversion rates, verification rates)
  - Create alerting for payment and verification failures
  - Set up performance monitoring for video delivery
  - Write tests for analytics data collection
  - _Requirements: Performance and business metrics from all requirements_

- [ ] 36. Conduct end-to-end testing and security audit
  - Create comprehensive E2E test suite covering all user journeys
  - Implement load testing for concurrent users and payments
  - Conduct smart contract security audit
  - Perform penetration testing on backend services
  - Create deployment and rollback procedures
  - _Requirements: All requirements for complete system validation_
