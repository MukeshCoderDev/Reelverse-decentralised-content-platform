// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContentRegistry
 * @dev Interface for managing content metadata and moderation
 */
interface IContentRegistry {
    struct Content {
        address creator;
        address splitter;
        string metaURI;
        bytes32 perceptualHash;
        uint32 geoMask;
        uint256 priceUSDC;
        uint8 storageClass; // 0: Shreddable, 1: Permanent
        uint8 moderationStatus; // 0: Pending, 1: Approved, 2: Rejected, 3: Flagged
        uint256 createdAt;
        uint256 totalSales;
        uint256 viewCount;
    }

    event ContentRegistered(
        uint256 indexed contentId,
        address indexed creator,
        address splitter,
        uint256 priceUSDC,
        uint8 storageClass,
        uint256 timestamp
    );
    
    event ModerationStatusUpdated(
        uint256 indexed contentId,
        uint8 oldStatus,
        uint8 newStatus,
        address indexed moderator,
        uint256 timestamp
    );
    
    event ContentSale(
        uint256 indexed contentId,
        address indexed buyer,
        uint256 price,
        uint256 timestamp
    );

    /**
     * @dev Register new content
     * @param metaURI IPFS URI for content metadata
     * @param pHash Perceptual hash for anti-piracy
     * @param priceUSDC Price in USDC (6 decimals)
     * @param storageClass 0 for shreddable, 1 for permanent
     * @param splitter Revenue splitter contract address
     * @param geoMask Geographic availability mask
     * @return contentId The ID of the registered content
     */
    function registerContent(
        string calldata metaURI,
        bytes32 pHash,
        uint256 priceUSDC,
        uint8 storageClass,
        address splitter,
        uint32 geoMask
    ) external returns (uint256 contentId);

    /**
     * @dev Update moderation status
     * @param contentId ID of the content
     * @param status New moderation status
     */
    function setModerationStatus(uint256 contentId, uint8 status) external;

    /**
     * @dev Record a content sale
     * @param contentId ID of the content
     * @param buyer Address of the buyer
     * @param price Sale price
     */
    function recordSale(uint256 contentId, address buyer, uint256 price) external;

    /**
     * @dev Increment view count
     * @param contentId ID of the content
     */
    function incrementViewCount(uint256 contentId) external;

    /**
     * @dev Get content information
     * @param contentId ID of the content
     * @return Content struct with all information
     */
    function getContent(uint256 contentId) external view returns (Content memory);

    /**
     * @dev Check if content exists
     * @param contentId ID to check
     * @return bool Whether content exists
     */
    function exists(uint256 contentId) external view returns (bool);

    /**
     * @dev Get content count for creator
     * @param creator Address of the creator
     * @return uint256 Number of content items
     */
    function getCreatorContentCount(address creator) external view returns (uint256);

    /**
     * @dev Check if content is available in geographic region
     * @param contentId ID of the content
     * @param region Geographic region code
     * @return bool Whether content is available
     */
    function isAvailableInRegion(uint256 contentId, uint32 region) external view returns (bool);
}