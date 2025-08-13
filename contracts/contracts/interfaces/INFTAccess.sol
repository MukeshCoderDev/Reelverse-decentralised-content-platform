// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC1155.sol";

/**
 * @title INFTAccess
 * @dev Interface for ERC-1155 based content access tokens
 */
interface INFTAccess is IERC1155 {
    enum AccessType {
        PPV,        // Pay-per-view
        SUBSCRIPTION, // Subscription access
        LIFETIME,   // Lifetime access
        RENTAL      // Time-limited rental
    }

    struct AccessToken {
        uint256 contentId;
        AccessType accessType;
        uint256 expiresAt;
        uint256 price;
        bool active;
    }

    event AccessMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed contentId,
        AccessType accessType,
        uint256 quantity,
        uint256 expiresAt,
        uint256 timestamp
    );

    event AccessRevoked(
        address indexed from,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    /**
     * @dev Mint PPV access token
     * @param to Address to mint to
     * @param contentId ID of the content
     * @param quantity Number of tokens to mint
     */
    function mintPPV(address to, uint256 contentId, uint256 quantity) external;

    /**
     * @dev Mint subscription access token
     * @param to Address to mint to
     * @param planId Subscription plan ID
     * @param duration Duration in seconds
     */
    function mintSubscription(address to, uint256 planId, uint256 duration) external;

    /**
     * @dev Mint lifetime access token
     * @param to Address to mint to
     * @param contentId ID of the content
     */
    function mintLifetime(address to, uint256 contentId) external;

    /**
     * @dev Mint rental access token
     * @param to Address to mint to
     * @param contentId ID of the content
     * @param duration Rental duration in seconds
     */
    function mintRental(address to, uint256 contentId, uint256 duration) external;

    /**
     * @dev Revoke access token
     * @param from Address to revoke from
     * @param tokenId Token ID to revoke
     */
    function revokeAccess(address from, uint256 tokenId) external;

    /**
     * @dev Check if user has access to content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return bool Whether user has access
     */
    function hasAccess(address user, uint256 contentId) external view returns (bool);

    /**
     * @dev Get access type for user and content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return string Access type ("ppv", "subscription", "lifetime", "rental", "none")
     */
    function getAccessType(address user, uint256 contentId) external view returns (string memory);

    /**
     * @dev Get access token information
     * @param tokenId Token ID
     * @return AccessToken struct with token information
     */
    function getAccessToken(uint256 tokenId) external view returns (AccessToken memory);

    /**
     * @dev Check if access token is expired
     * @param tokenId Token ID
     * @return bool Whether token is expired
     */
    function isExpired(uint256 tokenId) external view returns (bool);

    /**
     * @dev Get user's access tokens for content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return uint256[] Array of token IDs
     */
    function getUserAccessTokens(address user, uint256 contentId) external view returns (uint256[] memory);
}