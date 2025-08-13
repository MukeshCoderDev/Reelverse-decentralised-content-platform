// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../interfaces/IContentAccessGate.sol";
import "../interfaces/IContentRegistry.sol";
import "../interfaces/INFTAccess.sol";
import "../interfaces/ICreatorRegistry.sol";
import "../tokens/AgeVerifiedSBT.sol";

/**
 * @title ContentAccessGate
 * @dev Manages content access verification and playback token generation
 * @notice Combines age verification, geographic restrictions, and entitlement checks
 */
contract ContentAccessGate is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IContentAccessGate
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    // Registry contracts
    IContentRegistry public contentRegistry;
    INFTAccess public nftAccess;
    ICreatorRegistry public creatorRegistry;
    AgeVerifiedSBT public ageVerifiedSBT;

    // Playback token signer
    address public signer;
    
    // Token expiry duration (default: 24 hours)
    uint256 public tokenExpiryDuration;
    
    // Content pause status
    mapping(uint256 => bool) private _pausedContent;
    
    // Geographic region mappings (ISO 3166-1 numeric codes)
    mapping(uint32 => bool) private _restrictedRegions;
    
    // Session tracking for audit
    mapping(bytes32 => bool) private _usedSessions;
    
    // Statistics
    uint256 public totalTokensIssued;
    uint256 public totalAccessChecks;
    uint256 public totalBlockedAccess;
    
    // Access reason codes
    string constant REASON_AGE_VERIFICATION = "age_verification_required";
    string constant REASON_GEO_RESTRICTED = "geo_restricted";
    string constant REASON_NO_ENTITLEMENT = "no_entitlement";
    string constant REASON_CONTENT_PAUSED = "content_paused";
    string constant REASON_CONTENT_MODERATED = "content_moderated";
    string constant REASON_SUCCESS = "access_granted";

    event AccessBlocked(
        address indexed user,
        uint256 indexed contentId,
        string reason,
        uint32 region,
        uint256 timestamp
    );

    event TokenExpiryUpdated(
        uint256 oldDuration,
        uint256 newDuration,
        uint256 timestamp
    );

    event RegionRestrictionUpdated(
        uint32 indexed region,
        bool restricted,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param _contentRegistry Address of the ContentRegistry contract
     * @param _nftAccess Address of the NFTAccess contract
     * @param _creatorRegistry Address of the CreatorRegistry contract
     * @param _ageVerifiedSBT Address of the AgeVerifiedSBT contract
     * @param _signer Address of the playback token signer
     */
    function initialize(
        address _contentRegistry,
        address _nftAccess,
        address _creatorRegistry,
        address _ageVerifiedSBT,
        address _signer
    ) public initializer {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_nftAccess != address(0), "Invalid NFT access");
        require(_creatorRegistry != address(0), "Invalid creator registry");
        require(_ageVerifiedSBT != address(0), "Invalid age verified SBT");
        require(_signer != address(0), "Invalid signer");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        contentRegistry = IContentRegistry(_contentRegistry);
        nftAccess = INFTAccess(_nftAccess);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        ageVerifiedSBT = AgeVerifiedSBT(_ageVerifiedSBT);
        signer = _signer;

        tokenExpiryDuration = 24 hours; // Default 24 hours

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, _signer);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }

    /**
     * @dev Check if user has access to content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return AccessCheck struct with access information
     */
    function checkAccess(address user, uint256 contentId) external view override returns (AccessCheck memory) {
        return _checkAccess(user, contentId);
    }

    /**
     * @dev Check access and track statistics
     * @param user Address of the user
     * @param contentId ID of the content
     * @return AccessCheck struct with access information
     */
    function checkAccessAndTrack(address user, uint256 contentId) external returns (AccessCheck memory) {
        totalAccessChecks++;
        return _checkAccess(user, contentId);
    }

    /**
     * @dev Internal function to check access
     * @param user Address of the user
     * @param contentId ID of the content
     * @return AccessCheck struct with access information
     */
    function _checkAccess(address user, uint256 contentId) internal view returns (AccessCheck memory) {
        
        // Check if content exists
        if (!contentRegistry.exists(contentId)) {
            return AccessCheck({
                ageVerified: false,
                geoAllowed: false,
                hasEntitlement: false,
                reason: "content_not_found"
            });
        }

        // Get content information
        IContentRegistry.Content memory content = contentRegistry.getContent(contentId);
        
        // Check if content is paused
        if (_pausedContent[contentId]) {
            return AccessCheck({
                ageVerified: false,
                geoAllowed: false,
                hasEntitlement: false,
                reason: REASON_CONTENT_PAUSED
            });
        }

        // Check moderation status (only approved content is accessible)
        if (content.moderationStatus != 1) { // 1 = Approved
            return AccessCheck({
                ageVerified: false,
                geoAllowed: false,
                hasEntitlement: false,
                reason: REASON_CONTENT_MODERATED
            });
        }

        // Check age verification
        bool ageVerified = ageVerifiedSBT.hasVerification(user);
        
        // For now, assume geo is allowed (would need external service for real geo checking)
        bool geoAllowed = true;
        
        // Check entitlement
        bool hasEntitlement = nftAccess.hasAccess(user, contentId);

        // Determine access result
        if (!ageVerified) {
            return AccessCheck({
                ageVerified: false,
                geoAllowed: geoAllowed,
                hasEntitlement: hasEntitlement,
                reason: REASON_AGE_VERIFICATION
            });
        }

        if (!geoAllowed) {
            return AccessCheck({
                ageVerified: true,
                geoAllowed: false,
                hasEntitlement: hasEntitlement,
                reason: REASON_GEO_RESTRICTED
            });
        }

        if (!hasEntitlement) {
            return AccessCheck({
                ageVerified: true,
                geoAllowed: true,
                hasEntitlement: false,
                reason: REASON_NO_ENTITLEMENT
            });
        }

        return AccessCheck({
            ageVerified: true,
            geoAllowed: true,
            hasEntitlement: true,
            reason: REASON_SUCCESS
        });
    }

    /**
     * @dev Simple access check (backward compatibility)
     * @param user Address of the user
     * @param contentId ID of the content
     * @return bool Whether user has access
     */
    function hasAccess(address user, uint256 contentId) external view override returns (bool) {
        AccessCheck memory check = _checkAccess(user, contentId);
        return check.ageVerified && check.geoAllowed && check.hasEntitlement;
    }

    /**
     * @dev Issue playback token for authorized user
     * @param viewer Address of the viewer
     * @param contentId ID of the content
     * @param sessionId Unique session identifier
     * @return payload Signed payload for playback authorization
     */
    function issuePlaybackToken(
        address viewer,
        uint256 contentId,
        bytes32 sessionId
    ) external view override returns (bytes memory payload) {
        require(viewer != address(0), "Invalid viewer address");
        require(sessionId != bytes32(0), "Invalid session ID");
        require(!_usedSessions[sessionId], "Session already used");

        // Check access
        AccessCheck memory accessCheck = _checkAccess(viewer, contentId);
        require(
            accessCheck.ageVerified && accessCheck.geoAllowed && accessCheck.hasEntitlement,
            string(abi.encodePacked("Access denied: ", accessCheck.reason))
        );

        uint256 expiresAt = block.timestamp + tokenExpiryDuration;

        // Create message hash for signing
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                viewer,
                contentId,
                sessionId,
                expiresAt,
                block.chainid
            )
        );

        // For view function, we return the unsigned payload
        // In practice, this would be signed by the backend service
        payload = abi.encodePacked(
            viewer,
            contentId,
            sessionId,
            expiresAt
        );

        return payload;
    }

    /**
     * @dev Set the signer address for playback tokens
     * @param _signer Address of the new signer
     */
    function setSigner(address _signer) external override onlyRole(ADMIN_ROLE) {
        require(_signer != address(0), "Invalid signer address");
        
        address oldSigner = signer;
        signer = _signer;
        
        // Update roles
        if (oldSigner != address(0)) {
            _revokeRole(SIGNER_ROLE, oldSigner);
        }
        _grantRole(SIGNER_ROLE, _signer);

        emit SignerUpdated(oldSigner, _signer, block.timestamp);
    }

    /**
     * @dev Get current signer address
     * @return address Current signer address
     */
    function getSigner() external view override returns (address) {
        return signer;
    }

    /**
     * @dev Verify a playback token signature
     * @param viewer Address of the viewer
     * @param contentId ID of the content
     * @param sessionId Session identifier
     * @param expiresAt Expiration timestamp
     * @param signature Token signature
     * @return bool Whether signature is valid
     */
    function verifyPlaybackToken(
        address viewer,
        uint256 contentId,
        bytes32 sessionId,
        uint256 expiresAt,
        bytes calldata signature
    ) external view override returns (bool) {
        // Check if token is expired
        if (block.timestamp > expiresAt) {
            return false;
        }

        // Recreate message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                viewer,
                contentId,
                sessionId,
                expiresAt,
                block.chainid
            )
        );

        // Convert to Ethereum signed message hash
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover signer from signature
        address recoveredSigner = ethSignedMessageHash.recover(signature);

        // Verify signer has SIGNER_ROLE
        return hasRole(SIGNER_ROLE, recoveredSigner);
    }

    /**
     * @dev Check geographic availability
     * @param contentId ID of the content
     * @param userRegion User's geographic region code
     * @return bool Whether content is available in region
     */
    function checkGeoAvailability(uint256 contentId, uint32 userRegion) external view override returns (bool) {
        require(contentRegistry.exists(contentId), "Content does not exist");
        
        // Check if region is globally restricted
        if (_restrictedRegions[userRegion]) {
            return false;
        }

        // Check content-specific geo restrictions
        return contentRegistry.isAvailableInRegion(contentId, userRegion);
    }

    /**
     * @dev Emergency pause access (admin only)
     * @param contentId ID of the content to pause
     */
    function pauseContentAccess(uint256 contentId) external override onlyRole(MODERATOR_ROLE) {
        require(contentRegistry.exists(contentId), "Content does not exist");
        require(!_pausedContent[contentId], "Content already paused");
        
        _pausedContent[contentId] = true;
    }

    /**
     * @dev Resume content access (admin only)
     * @param contentId ID of the content to resume
     */
    function resumeContentAccess(uint256 contentId) external override onlyRole(MODERATOR_ROLE) {
        require(contentRegistry.exists(contentId), "Content does not exist");
        require(_pausedContent[contentId], "Content not paused");
        
        _pausedContent[contentId] = false;
    }

    /**
     * @dev Check if content access is paused
     * @param contentId ID of the content
     * @return bool Whether access is paused
     */
    function isContentPaused(uint256 contentId) external view override returns (bool) {
        return _pausedContent[contentId];
    }

    /**
     * @dev Set token expiry duration
     * @param _duration New duration in seconds
     */
    function setTokenExpiryDuration(uint256 _duration) external onlyRole(ADMIN_ROLE) {
        require(_duration > 0, "Duration must be greater than 0");
        require(_duration <= 7 days, "Duration too long");
        
        uint256 oldDuration = tokenExpiryDuration;
        tokenExpiryDuration = _duration;
        
        emit TokenExpiryUpdated(oldDuration, _duration, block.timestamp);
    }

    /**
     * @dev Set region restriction
     * @param region Region code
     * @param restricted Whether region is restricted
     */
    function setRegionRestriction(uint32 region, bool restricted) external onlyRole(ADMIN_ROLE) {
        _restrictedRegions[region] = restricted;
        
        emit RegionRestrictionUpdated(region, restricted, block.timestamp);
    }

    /**
     * @dev Batch set region restrictions
     * @param regions Array of region codes
     * @param restricted Array of restriction statuses
     */
    function batchSetRegionRestrictions(
        uint32[] calldata regions,
        bool[] calldata restricted
    ) external onlyRole(ADMIN_ROLE) {
        require(regions.length == restricted.length, "Array length mismatch");
        
        for (uint256 i = 0; i < regions.length; i++) {
            _restrictedRegions[regions[i]] = restricted[i];
            emit RegionRestrictionUpdated(regions[i], restricted[i], block.timestamp);
        }
    }

    /**
     * @dev Check if region is restricted
     * @param region Region code
     * @return bool Whether region is restricted
     */
    function isRegionRestricted(uint32 region) external view returns (bool) {
        return _restrictedRegions[region];
    }

    /**
     * @dev Mark session as used (for backend integration)
     * @param sessionId Session identifier
     */
    function markSessionUsed(bytes32 sessionId) external onlyRole(SIGNER_ROLE) {
        _usedSessions[sessionId] = true;
    }

    /**
     * @dev Check if session is used
     * @param sessionId Session identifier
     * @return bool Whether session is used
     */
    function isSessionUsed(bytes32 sessionId) external view returns (bool) {
        return _usedSessions[sessionId];
    }

    /**
     * @dev Issue and track playback token (for backend integration)
     * @param viewer Address of the viewer
     * @param contentId ID of the content
     * @param sessionId Unique session identifier
     * @return payload Signed payload for playback authorization
     */
    function issueAndTrackPlaybackToken(
        address viewer,
        uint256 contentId,
        bytes32 sessionId
    ) external onlyRole(SIGNER_ROLE) nonReentrant returns (bytes memory payload) {
        require(viewer != address(0), "Invalid viewer address");
        require(sessionId != bytes32(0), "Invalid session ID");
        require(!_usedSessions[sessionId], "Session already used");

        // Check access
        AccessCheck memory accessCheck = _checkAccess(viewer, contentId);
        if (!accessCheck.ageVerified || !accessCheck.geoAllowed || !accessCheck.hasEntitlement) {
            totalBlockedAccess++;
            
            emit AccessBlocked(
                viewer,
                contentId,
                accessCheck.reason,
                0, // Region would be passed from backend
                block.timestamp
            );
            
            revert(string(abi.encodePacked("Access denied: ", accessCheck.reason)));
        }

        uint256 expiresAt = block.timestamp + tokenExpiryDuration;

        // Mark session as used
        _usedSessions[sessionId] = true;
        totalTokensIssued++;

        // Create payload
        payload = abi.encodePacked(
            viewer,
            contentId,
            sessionId,
            expiresAt
        );

        emit PlaybackTokenIssued(
            viewer,
            contentId,
            sessionId,
            expiresAt,
            block.timestamp
        );

        return payload;
    }

    /**
     * @dev Get access statistics
     * @return totalChecks Total access checks performed
     * @return totalTokens Total tokens issued
     * @return totalBlocked Total blocked access attempts
     */
    function getAccessStats() external view returns (
        uint256 totalChecks,
        uint256 totalTokens,
        uint256 totalBlocked
    ) {
        return (totalAccessChecks, totalTokensIssued, totalBlockedAccess);
    }

    /**
     * @dev Update registry addresses (admin only)
     * @param _contentRegistry New content registry address
     * @param _nftAccess New NFT access address
     * @param _creatorRegistry New creator registry address
     * @param _ageVerifiedSBT New age verified SBT address
     */
    function updateRegistries(
        address _contentRegistry,
        address _nftAccess,
        address _creatorRegistry,
        address _ageVerifiedSBT
    ) external onlyRole(ADMIN_ROLE) {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_nftAccess != address(0), "Invalid NFT access");
        require(_creatorRegistry != address(0), "Invalid creator registry");
        require(_ageVerifiedSBT != address(0), "Invalid age verified SBT");

        contentRegistry = IContentRegistry(_contentRegistry);
        nftAccess = INFTAccess(_nftAccess);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        ageVerifiedSBT = AgeVerifiedSBT(_ageVerifiedSBT);
    }

    /**
     * @dev Pause contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}

    /**
     * @dev Override supportsInterface to include all interfaces
     * @param interfaceId Interface ID
     * @return bool Whether interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}