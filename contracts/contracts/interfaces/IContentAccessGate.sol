// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContentAccessGate
 * @dev Interface for content access verification and playback token generation
 */
interface IContentAccessGate {
    struct AccessCheck {
        bool ageVerified;
        bool geoAllowed;
        bool hasEntitlement;
        string reason;
    }

    event PlaybackTokenIssued(
        address indexed viewer,
        uint256 indexed contentId,
        bytes32 indexed sessionId,
        uint256 expiresAt,
        uint256 timestamp
    );

    event SignerUpdated(
        address indexed oldSigner,
        address indexed newSigner,
        uint256 timestamp
    );

    /**
     * @dev Check if user has access to content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return AccessCheck struct with access information
     */
    function checkAccess(address user, uint256 contentId) external view returns (AccessCheck memory);

    /**
     * @dev Simple access check (backward compatibility)
     * @param user Address of the user
     * @param contentId ID of the content
     * @return bool Whether user has access
     */
    function hasAccess(address user, uint256 contentId) external view returns (bool);

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
    ) external view returns (bytes memory payload);

    /**
     * @dev Set the signer address for playback tokens
     * @param signer Address of the new signer
     */
    function setSigner(address signer) external;

    /**
     * @dev Get current signer address
     * @return address Current signer address
     */
    function getSigner() external view returns (address);

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
    ) external view returns (bool);

    /**
     * @dev Check geographic availability
     * @param contentId ID of the content
     * @param userRegion User's geographic region code
     * @return bool Whether content is available in region
     */
    function checkGeoAvailability(uint256 contentId, uint32 userRegion) external view returns (bool);

    /**
     * @dev Emergency pause access (admin only)
     * @param contentId ID of the content to pause
     */
    function pauseContentAccess(uint256 contentId) external;

    /**
     * @dev Resume content access (admin only)
     * @param contentId ID of the content to resume
     */
    function resumeContentAccess(uint256 contentId) external;

    /**
     * @dev Check if content access is paused
     * @param contentId ID of the content
     * @return bool Whether access is paused
     */
    function isContentPaused(uint256 contentId) external view returns (bool);
}