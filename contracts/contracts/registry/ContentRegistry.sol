// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IContentRegistry.sol";
import "../interfaces/ICreatorRegistry.sol";

/**
 * @title ContentRegistry
 * @dev Registry for managing content metadata, pricing, and moderation
 */
contract ContentRegistry is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IContentRegistry
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    ICreatorRegistry public creatorRegistry;

    mapping(uint256 => Content) private _content;
    mapping(address => uint256[]) private _creatorContent;
    mapping(bytes32 => uint256) private _hashToContentId; // Prevent duplicate hashes
    mapping(uint32 => uint256[]) private _regionContent; // Geographic content mapping
    
    uint256 private _nextContentId;
    uint256 public totalContent;
    uint256 public totalApprovedContent;
    uint256 public totalFlaggedContent;

    // Moderation statistics
    mapping(uint8 => uint256) private _moderationStats; // status => count
    mapping(address => uint256) private _moderatorActions; // moderator => action count

    // Content categories and tags
    mapping(uint256 => string[]) private _contentTags;
    mapping(string => uint256[]) private _taggedContent;

    // Revenue tracking
    mapping(uint256 => uint256) private _contentRevenue;
    mapping(address => uint256) private _creatorRevenue;

    event ContentUpdated(
        uint256 indexed contentId,
        string metaURI,
        uint256 priceUSDC,
        uint256 timestamp
    );

    event ContentTagsUpdated(
        uint256 indexed contentId,
        string[] tags,
        uint256 timestamp
    );

    event ContentFlagged(
        uint256 indexed contentId,
        address indexed reporter,
        string reason,
        uint256 timestamp
    );

    event ModerationActionTaken(
        uint256 indexed contentId,
        address indexed moderator,
        uint8 oldStatus,
        uint8 newStatus,
        string reason,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _creatorRegistry) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_creatorRegistry != address(0), "Invalid creator registry address");
        creatorRegistry = ICreatorRegistry(_creatorRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
        _grantRole(PUBLISHER_ROLE, msg.sender);
        
        _nextContentId = 1;
    }

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
    ) external override onlyRole(PUBLISHER_ROLE) whenNotPaused nonReentrant returns (uint256 contentId) {
        require(bytes(metaURI).length > 0, "Meta URI cannot be empty");
        require(pHash != bytes32(0), "Perceptual hash cannot be empty");
        require(storageClass <= 1, "Invalid storage class");
        require(splitter != address(0), "Invalid splitter address");
        require(_hashToContentId[pHash] == 0, "Content with this hash already exists");

        // Verify creator is registered and has necessary permissions
        address creator = msg.sender;
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            require(creatorRegistry.isRegistered(creator), "Creator not registered");
            
            // Check if verification is required (this could be a feature flag)
            // For now, we'll allow unverified creators but track their status
        }

        contentId = _nextContentId++;

        _content[contentId] = Content({
            creator: creator,
            splitter: splitter,
            metaURI: metaURI,
            perceptualHash: pHash,
            geoMask: geoMask,
            priceUSDC: priceUSDC,
            storageClass: storageClass,
            moderationStatus: 0, // Pending
            createdAt: block.timestamp,
            totalSales: 0,
            viewCount: 0
        });

        _creatorContent[creator].push(contentId);
        _hashToContentId[pHash] = contentId;
        _moderationStats[0]++; // Increment pending count
        
        totalContent++;

        // Add to regional content if geo mask allows
        if (geoMask != 0) {
            _addToRegionalContent(contentId, geoMask);
        }

        // Update creator registry
        creatorRegistry.addCreatorContent(creator, contentId);

        emit ContentRegistered(contentId, creator, splitter, priceUSDC, storageClass, block.timestamp);

        return contentId;
    }

    /**
     * @dev Update moderation status
     * @param contentId ID of the content
     * @param status New moderation status
     */
    function setModerationStatus(uint256 contentId, uint8 status) external override onlyRole(MODERATOR_ROLE) {
        require(exists(contentId), "Content does not exist");
        require(status <= 3, "Invalid moderation status"); // 0: Pending, 1: Approved, 2: Rejected, 3: Flagged

        Content storage content = _content[contentId];
        uint8 oldStatus = content.moderationStatus;
        
        require(oldStatus != status, "Status already set");

        // Update statistics
        _moderationStats[oldStatus]--;
        _moderationStats[status]++;
        _moderatorActions[msg.sender]++;

        if (oldStatus == 1) totalApprovedContent--; // Was approved
        if (oldStatus == 3) totalFlaggedContent--; // Was flagged
        
        if (status == 1) totalApprovedContent++; // Now approved
        if (status == 3) totalFlaggedContent++; // Now flagged

        content.moderationStatus = status;

        emit ModerationStatusUpdated(contentId, oldStatus, status, msg.sender, block.timestamp);
    }

    /**
     * @dev Set moderation status with reason
     * @param contentId ID of the content
     * @param status New moderation status
     * @param reason Reason for moderation action
     */
    function setModerationStatusWithReason(
        uint256 contentId,
        uint8 status,
        string calldata reason
    ) external onlyRole(MODERATOR_ROLE) {
        require(exists(contentId), "Content does not exist");
        require(status <= 3, "Invalid moderation status");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        Content storage content = _content[contentId];
        uint8 oldStatus = content.moderationStatus;
        
        require(oldStatus != status, "Status already set");

        // Update statistics
        _moderationStats[oldStatus]--;
        _moderationStats[status]++;
        _moderatorActions[msg.sender]++;

        if (oldStatus == 1) totalApprovedContent--;
        if (oldStatus == 3) totalFlaggedContent--;
        
        if (status == 1) totalApprovedContent++;
        if (status == 3) totalFlaggedContent++;

        content.moderationStatus = status;

        emit ModerationActionTaken(contentId, msg.sender, oldStatus, status, reason, block.timestamp);
        emit ModerationStatusUpdated(contentId, oldStatus, status, msg.sender, block.timestamp);
    }

    /**
     * @dev Flag content for review
     * @param contentId ID of the content
     * @param reason Reason for flagging
     */
    function flagContent(uint256 contentId, string calldata reason) external {
        require(exists(contentId), "Content does not exist");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        Content storage content = _content[contentId];
        
        // Only flag if not already flagged or rejected
        if (content.moderationStatus != 3 && content.moderationStatus != 2) {
            uint8 oldStatus = content.moderationStatus;
            
            _moderationStats[oldStatus]--;
            _moderationStats[3]++; // Flagged
            
            if (oldStatus == 1) totalApprovedContent--;
            totalFlaggedContent++;
            
            content.moderationStatus = 3; // Flagged
            
            emit ModerationStatusUpdated(contentId, oldStatus, 3, address(0), block.timestamp);
        }

        emit ContentFlagged(contentId, msg.sender, reason, block.timestamp);
    }

    /**
     * @dev Record a content sale
     * @param contentId ID of the content
     * @param buyer Address of the buyer
     * @param price Sale price
     */
    function recordSale(uint256 contentId, address buyer, uint256 price) external override onlyRole(PUBLISHER_ROLE) {
        require(exists(contentId), "Content does not exist");
        require(buyer != address(0), "Invalid buyer address");
        require(price > 0, "Price must be greater than 0");

        Content storage content = _content[contentId];
        content.totalSales += price;
        
        _contentRevenue[contentId] += price;
        _creatorRevenue[content.creator] += price;

        // Update creator earnings in registry
        creatorRegistry.addEarnings(content.creator, price);

        emit ContentSale(contentId, buyer, price, block.timestamp);
    }

    /**
     * @dev Increment view count
     * @param contentId ID of the content
     */
    function incrementViewCount(uint256 contentId) external override onlyRole(PUBLISHER_ROLE) {
        require(exists(contentId), "Content does not exist");
        
        _content[contentId].viewCount++;
    }

    /**
     * @dev Update content metadata
     * @param contentId ID of the content
     * @param metaURI New metadata URI
     * @param priceUSDC New price in USDC
     */
    function updateContent(
        uint256 contentId,
        string calldata metaURI,
        uint256 priceUSDC
    ) external {
        require(exists(contentId), "Content does not exist");
        require(bytes(metaURI).length > 0, "Meta URI cannot be empty");

        Content storage content = _content[contentId];
        
        // Only creator or admin can update
        require(
            msg.sender == content.creator || hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized to update content"
        );

        content.metaURI = metaURI;
        content.priceUSDC = priceUSDC;

        emit ContentUpdated(contentId, metaURI, priceUSDC, block.timestamp);
    }

    /**
     * @dev Set content tags
     * @param contentId ID of the content
     * @param tags Array of tags
     */
    function setContentTags(uint256 contentId, string[] calldata tags) external {
        require(exists(contentId), "Content does not exist");
        require(tags.length > 0 && tags.length <= 10, "Invalid number of tags");

        Content storage content = _content[contentId];
        
        // Only creator or admin can set tags
        require(
            msg.sender == content.creator || hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized to set tags"
        );

        // Remove old tags
        string[] storage oldTags = _contentTags[contentId];
        for (uint256 i = 0; i < oldTags.length; i++) {
            _removeFromTaggedContent(oldTags[i], contentId);
        }

        // Set new tags
        delete _contentTags[contentId];
        for (uint256 i = 0; i < tags.length; i++) {
            require(bytes(tags[i]).length > 0, "Tag cannot be empty");
            _contentTags[contentId].push(tags[i]);
            _taggedContent[tags[i]].push(contentId);
        }

        emit ContentTagsUpdated(contentId, tags, block.timestamp);
    }

    /**
     * @dev Get content information
     * @param contentId ID of the content
     * @return Content struct with all information
     */
    function getContent(uint256 contentId) external view override returns (Content memory) {
        require(exists(contentId), "Content does not exist");
        return _content[contentId];
    }

    /**
     * @dev Check if content exists
     * @param contentId ID to check
     * @return bool Whether content exists
     */
    function exists(uint256 contentId) public view override returns (bool) {
        return contentId > 0 && contentId < _nextContentId && _content[contentId].creator != address(0);
    }

    /**
     * @dev Get content count for creator
     * @param creator Address of the creator
     * @return uint256 Number of content items
     */
    function getCreatorContentCount(address creator) external view override returns (uint256) {
        return _creatorContent[creator].length;
    }

    /**
     * @dev Get creator's content list
     * @param creator Address of the creator
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return contentIds Array of content IDs
     * @return total Total number of content items
     */
    function getCreatorContent(address creator, uint256 offset, uint256 limit) external view returns (
        uint256[] memory contentIds,
        uint256 total
    ) {
        uint256[] storage creatorContent = _creatorContent[creator];
        total = creatorContent.length;
        
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        contentIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            contentIds[i - offset] = creatorContent[i];
        }
    }

    /**
     * @dev Check if content is available in geographic region
     * @param contentId ID of the content
     * @param region Geographic region code
     * @return bool Whether content is available
     */
    function isAvailableInRegion(uint256 contentId, uint32 region) external view override returns (bool) {
        require(exists(contentId), "Content does not exist");
        
        uint32 geoMask = _content[contentId].geoMask;
        
        // If geoMask is 0, content is globally available
        if (geoMask == 0) return true;
        
        // Check if region bit is set in mask
        return (geoMask & (1 << region)) != 0;
    }

    /**
     * @dev Get content by tags
     * @param tag Tag to search for
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return contentIds Array of content IDs
     * @return total Total number of tagged content
     */
    function getContentByTag(string calldata tag, uint256 offset, uint256 limit) external view returns (
        uint256[] memory contentIds,
        uint256 total
    ) {
        uint256[] storage taggedContent = _taggedContent[tag];
        total = taggedContent.length;
        
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        contentIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            contentIds[i - offset] = taggedContent[i];
        }
    }

    /**
     * @dev Get content tags
     * @param contentId ID of the content
     * @return string[] Array of tags
     */
    function getContentTags(uint256 contentId) external view returns (string[] memory) {
        require(exists(contentId), "Content does not exist");
        return _contentTags[contentId];
    }

    /**
     * @dev Get moderation statistics
     * @return pending Number of pending content
     * @return approved Number of approved content
     * @return rejected Number of rejected content
     * @return flagged Number of flagged content
     */
    function getModerationStats() external view returns (
        uint256 pending,
        uint256 approved,
        uint256 rejected,
        uint256 flagged
    ) {
        return (
            _moderationStats[0],
            _moderationStats[1],
            _moderationStats[2],
            _moderationStats[3]
        );
    }

    /**
     * @dev Get moderator action count
     * @param moderator Address of the moderator
     * @return uint256 Number of actions taken
     */
    function getModeratorActionCount(address moderator) external view returns (uint256) {
        return _moderatorActions[moderator];
    }

    /**
     * @dev Get content revenue
     * @param contentId ID of the content
     * @return uint256 Total revenue for content
     */
    function getContentRevenue(uint256 contentId) external view returns (uint256) {
        require(exists(contentId), "Content does not exist");
        return _contentRevenue[contentId];
    }

    /**
     * @dev Get creator revenue
     * @param creator Address of the creator
     * @return uint256 Total revenue for creator
     */
    function getCreatorRevenue(address creator) external view returns (uint256) {
        return _creatorRevenue[creator];
    }

    /**
     * @dev Get content by moderation status
     * @param status Moderation status (0-3)
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return contentIds Array of content IDs
     * @return total Total number of content with status
     */
    function getContentByModerationStatus(uint8 status, uint256 offset, uint256 limit) external view returns (
        uint256[] memory contentIds,
        uint256 total
    ) {
        require(status <= 3, "Invalid moderation status");
        
        // Count content with status
        uint256[] memory statusContent = new uint256[](_moderationStats[status]);
        uint256 count = 0;
        
        for (uint256 i = 1; i < _nextContentId; i++) {
            if (exists(i) && _content[i].moderationStatus == status) {
                if (count < statusContent.length) {
                    statusContent[count] = i;
                    count++;
                }
            }
        }
        
        total = count;
        
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        contentIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            contentIds[i - offset] = statusContent[i];
        }
    }

    /**
     * @dev Add content to regional mapping
     * @param contentId ID of the content
     * @param geoMask Geographic mask
     */
    function _addToRegionalContent(uint256 contentId, uint32 geoMask) internal {
        for (uint32 region = 0; region < 32; region++) {
            if ((geoMask & (1 << region)) != 0) {
                _regionContent[region].push(contentId);
            }
        }
    }

    /**
     * @dev Remove content from tagged content mapping
     * @param tag Tag to remove from
     * @param contentId Content ID to remove
     */
    function _removeFromTaggedContent(string memory tag, uint256 contentId) internal {
        uint256[] storage taggedContent = _taggedContent[tag];
        for (uint256 i = 0; i < taggedContent.length; i++) {
            if (taggedContent[i] == contentId) {
                taggedContent[i] = taggedContent[taggedContent.length - 1];
                taggedContent.pop();
                break;
            }
        }
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
     * @dev Update creator registry address (admin only)
     * @param _creatorRegistry New creator registry address
     */
    function updateCreatorRegistry(address _creatorRegistry) external onlyRole(ADMIN_ROLE) {
        require(_creatorRegistry != address(0), "Invalid creator registry address");
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
    }

    /**
     * @dev Emergency content removal (admin only)
     * @param contentId ID of the content to remove
     * @param reason Reason for removal
     */
    function emergencyRemoveContent(uint256 contentId, string calldata reason) external onlyRole(ADMIN_ROLE) {
        require(exists(contentId), "Content does not exist");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        Content storage content = _content[contentId];
        uint8 oldStatus = content.moderationStatus;
        
        // Update statistics
        _moderationStats[oldStatus]--;
        if (oldStatus == 1) totalApprovedContent--;
        if (oldStatus == 3) totalFlaggedContent--;
        
        // Set to rejected status
        content.moderationStatus = 2;
        _moderationStats[2]++;

        emit ModerationActionTaken(contentId, msg.sender, oldStatus, 2, reason, block.timestamp);
    }

    /**
     * @dev Get contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}