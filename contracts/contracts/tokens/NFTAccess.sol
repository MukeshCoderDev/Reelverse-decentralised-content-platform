// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../interfaces/INFTAccess.sol";
import "../interfaces/IContentRegistry.sol";
import "../interfaces/ICreatorRegistry.sol";

/**
 * @title NFTAccess
 * @dev ERC-1155 based content access tokens for Reelverse platform
 * @notice Manages PPV, subscription, lifetime, and rental access to content
 */
contract NFTAccess is 
    Initializable,
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    INFTAccess
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    uint256 public constant MAX_RENTAL_DURATION = 30 days;
    
    // Registry contracts
    IContentRegistry public contentRegistry;
    ICreatorRegistry public creatorRegistry;
    
    // Token tracking
    uint256 private _currentTokenId;
    uint256 public totalAccessTokens;
    
    // Access token storage
    mapping(uint256 => AccessToken) private _accessTokens;
    mapping(address => mapping(uint256 => uint256[])) private _userContentTokens;
    
    // Subscription plans
    struct SubscriptionPlan {
        address creator;
        uint256 priceUSDC;
        uint256 duration;
        string name;
        string description;
        uint256 maxSubscribers;
        uint256 currentSubscribers;
        bool active;
        uint256 createdAt;
    }
    
    uint256 private _currentPlanId;
    mapping(uint256 => SubscriptionPlan) private _subscriptionPlans;
    mapping(address => uint256[]) private _creatorPlans;
    
    // Statistics tracking
    uint256 public ppvCount;
    uint256 public subscriptionCount;
    uint256 public lifetimeCount;
    uint256 public rentalCount;
    
    // Events
    event SubscriptionPlanCreated(
        uint256 indexed planId,
        address indexed creator,
        uint256 priceUSDC,
        uint256 duration,
        string name,
        uint256 timestamp
    );
    
    event SubscriptionPlanUpdated(
        uint256 indexed planId,
        uint256 priceUSDC,
        uint256 duration,
        bool active,
        uint256 timestamp
    );
    
    event RentalExtended(
        address indexed user,
        uint256 indexed tokenId,
        uint256 indexed contentId,
        uint256 additionalDuration,
        uint256 newExpiresAt,
        uint256 timestamp
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the contract
     * @param _contentRegistry Address of the ContentRegistry contract
     * @param _creatorRegistry Address of the CreatorRegistry contract
     */
    function initialize(
        address _contentRegistry,
        address _creatorRegistry
    ) public initializer {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_creatorRegistry != address(0), "Invalid creator registry");
        
        __ERC1155_init("https://api.reelverse.com/nft/{id}.json");
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        contentRegistry = IContentRegistry(_contentRegistry);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        _currentTokenId = 1;
        _currentPlanId = 1;
    }
    
    /**
     * @dev Mint PPV access token
     * @param to Address to mint to
     * @param contentId ID of the content
     * @param quantity Number of tokens to mint
     */
    function mintPPV(
        address to,
        uint256 contentId,
        uint256 quantity
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(quantity > 0, "Quantity must be greater than 0");
        require(_contentExists(contentId), "Content does not exist");
        
        uint256 tokenId = _currentTokenId++;
        
        _accessTokens[tokenId] = AccessToken({
            contentId: contentId,
            accessType: AccessType.PPV,
            expiresAt: 0, // PPV doesn't expire
            price: 0, // Price stored in ContentRegistry
            active: true
        });
        
        _userContentTokens[to][contentId].push(tokenId);
        totalAccessTokens++;
        ppvCount++;
        
        _mint(to, tokenId, quantity, "");
        
        emit AccessMinted(
            to,
            tokenId,
            contentId,
            AccessType.PPV,
            quantity,
            0,
            block.timestamp
        );
    }
    
    /**
     * @dev Mint subscription access token
     * @param to Address to mint to
     * @param planId Subscription plan ID
     * @param duration Duration in seconds
     */
    function mintSubscription(
        address to,
        uint256 planId,
        uint256 duration
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(_subscriptionPlanExists(planId), "Subscription plan does not exist");
        
        SubscriptionPlan storage plan = _subscriptionPlans[planId];
        require(plan.active, "Subscription plan not active");
        require(plan.currentSubscribers < plan.maxSubscribers, "Subscription plan full");
        
        uint256 tokenId = _currentTokenId++;
        uint256 expiresAt = block.timestamp + duration;
        
        _accessTokens[tokenId] = AccessToken({
            contentId: planId, // For subscriptions, we store planId as contentId
            accessType: AccessType.SUBSCRIPTION,
            expiresAt: expiresAt,
            price: plan.priceUSDC,
            active: true
        });
        
        _userContentTokens[to][planId].push(tokenId);
        plan.currentSubscribers++;
        totalAccessTokens++;
        subscriptionCount++;
        
        _mint(to, tokenId, 1, "");
        
        emit AccessMinted(
            to,
            tokenId,
            planId,
            AccessType.SUBSCRIPTION,
            1,
            expiresAt,
            block.timestamp
        );
    }
    
    /**
     * @dev Mint lifetime access token
     * @param to Address to mint to
     * @param contentId ID of the content
     */
    function mintLifetime(
        address to,
        uint256 contentId
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(_contentExists(contentId), "Content does not exist");
        
        uint256 tokenId = _currentTokenId++;
        
        _accessTokens[tokenId] = AccessToken({
            contentId: contentId,
            accessType: AccessType.LIFETIME,
            expiresAt: 0, // Lifetime doesn't expire
            price: 0,
            active: true
        });
        
        _userContentTokens[to][contentId].push(tokenId);
        totalAccessTokens++;
        lifetimeCount++;
        
        _mint(to, tokenId, 1, "");
        
        emit AccessMinted(
            to,
            tokenId,
            contentId,
            AccessType.LIFETIME,
            1,
            0,
            block.timestamp
        );
    }
    
    /**
     * @dev Mint rental access token
     * @param to Address to mint to
     * @param contentId ID of the content
     * @param duration Rental duration in seconds
     */
    function mintRental(
        address to,
        uint256 contentId,
        uint256 duration
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(duration > 0, "Duration must be greater than 0");
        require(duration <= MAX_RENTAL_DURATION, "Rental duration too long");
        require(_contentExists(contentId), "Content does not exist");
        
        uint256 tokenId = _currentTokenId++;
        uint256 expiresAt = block.timestamp + duration;
        
        _accessTokens[tokenId] = AccessToken({
            contentId: contentId,
            accessType: AccessType.RENTAL,
            expiresAt: expiresAt,
            price: 0,
            active: true
        });
        
        _userContentTokens[to][contentId].push(tokenId);
        totalAccessTokens++;
        rentalCount++;
        
        _mint(to, tokenId, 1, "");
        
        emit AccessMinted(
            to,
            tokenId,
            contentId,
            AccessType.RENTAL,
            1,
            expiresAt,
            block.timestamp
        );
    }
    
    /**
     * @dev Revoke access token
     * @param from Address to revoke from
     * @param tokenId Token ID to revoke
     */
    function revokeAccess(
        address from,
        uint256 tokenId
    ) external onlyRole(BURNER_ROLE) {
        require(balanceOf(from, tokenId) > 0, "User does not own token");
        
        AccessToken storage token = _accessTokens[tokenId];
        token.active = false;
        
        // Update subscription count if it's a subscription token
        if (token.accessType == AccessType.SUBSCRIPTION) {
            SubscriptionPlan storage plan = _subscriptionPlans[token.contentId];
            if (plan.currentSubscribers > 0) {
                plan.currentSubscribers--;
            }
        }
        
        _burn(from, tokenId, balanceOf(from, tokenId));
        
        emit AccessRevoked(from, tokenId, block.timestamp);
    }
    
    /**
     * @dev Check if user has access to content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return bool Whether user has access
     */
    function hasAccess(address user, uint256 contentId) external view returns (bool) {
        uint256[] memory userTokens = _userContentTokens[user][contentId];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            uint256 tokenId = userTokens[i];
            if (balanceOf(user, tokenId) > 0 && _accessTokens[tokenId].active) {
                AccessToken memory token = _accessTokens[tokenId];
                
                // Check if token is not expired
                if (token.expiresAt == 0 || token.expiresAt > block.timestamp) {
                    return true;
                }
            }
        }
        
        // Check subscription access
        return _hasSubscriptionAccess(user, contentId);
    }
    
    /**
     * @dev Get access type for user and content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return string Access type
     */
    function getAccessType(address user, uint256 contentId) external view returns (string memory) {
        uint256[] memory userTokens = _userContentTokens[user][contentId];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            uint256 tokenId = userTokens[i];
            if (balanceOf(user, tokenId) > 0 && _accessTokens[tokenId].active) {
                AccessToken memory token = _accessTokens[tokenId];
                
                // Check if token is not expired
                if (token.expiresAt == 0 || token.expiresAt > block.timestamp) {
                    if (token.accessType == AccessType.PPV) return "ppv";
                    if (token.accessType == AccessType.LIFETIME) return "lifetime";
                    if (token.accessType == AccessType.RENTAL) return "rental";
                }
            }
        }
        
        // Check subscription access
        if (_hasSubscriptionAccess(user, contentId)) {
            return "subscription";
        }
        
        return "none";
    }
    
    /**
     * @dev Get access token information
     * @param tokenId Token ID
     * @return AccessToken struct with token information
     */
    function getAccessToken(uint256 tokenId) external view returns (AccessToken memory) {
        return _accessTokens[tokenId];
    }
    
    /**
     * @dev Check if access token is expired
     * @param tokenId Token ID
     * @return bool Whether token is expired
     */
    function isExpired(uint256 tokenId) external view returns (bool) {
        AccessToken memory token = _accessTokens[tokenId];
        return token.expiresAt > 0 && token.expiresAt <= block.timestamp;
    }
    
    /**
     * @dev Get user's access tokens for content
     * @param user Address of the user
     * @param contentId ID of the content
     * @return uint256[] Array of token IDs
     */
    function getUserAccessTokens(address user, uint256 contentId) external view returns (uint256[] memory) {
        return _userContentTokens[user][contentId];
    }
    
    /**
     * @dev Create subscription plan
     * @param priceUSDC Price in USDC (6 decimals)
     * @param duration Duration in seconds
     * @param name Plan name
     * @param description Plan description
     * @param maxSubscribers Maximum number of subscribers
     * @return uint256 Plan ID
     */
    function createSubscriptionPlan(
        uint256 priceUSDC,
        uint256 duration,
        string calldata name,
        string calldata description,
        uint256 maxSubscribers
    ) external returns (uint256) {
        require(priceUSDC > 0, "Price must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(maxSubscribers > 0, "Max subscribers must be greater than 0");
        
        uint256 planId = _currentPlanId++;
        
        _subscriptionPlans[planId] = SubscriptionPlan({
            creator: msg.sender,
            priceUSDC: priceUSDC,
            duration: duration,
            name: name,
            description: description,
            maxSubscribers: maxSubscribers,
            currentSubscribers: 0,
            active: true,
            createdAt: block.timestamp
        });
        
        _creatorPlans[msg.sender].push(planId);
        
        emit SubscriptionPlanCreated(
            planId,
            msg.sender,
            priceUSDC,
            duration,
            name,
            block.timestamp
        );
        
        return planId;
    }
    
    /**
     * @dev Update subscription plan
     * @param planId Plan ID
     * @param priceUSDC New price in USDC
     * @param duration New duration in seconds
     * @param active New active status
     */
    function updateSubscriptionPlan(
        uint256 planId,
        uint256 priceUSDC,
        uint256 duration,
        bool active
    ) external {
        require(_subscriptionPlanExists(planId), "Subscription plan does not exist");
        
        SubscriptionPlan storage plan = _subscriptionPlans[planId];
        require(plan.creator == msg.sender, "Not plan creator");
        
        plan.priceUSDC = priceUSDC;
        plan.duration = duration;
        plan.active = active;
        
        emit SubscriptionPlanUpdated(
            planId,
            priceUSDC,
            duration,
            active,
            block.timestamp
        );
    }
    
    /**
     * @dev Get subscription plan
     * @param planId Plan ID
     * @return SubscriptionPlan struct
     */
    function getSubscriptionPlan(uint256 planId) external view returns (SubscriptionPlan memory) {
        return _subscriptionPlans[planId];
    }
    
    /**
     * @dev Get creator's subscription plans
     * @param creator Creator address
     * @return uint256[] Array of plan IDs
     */
    function getCreatorPlans(address creator) external view returns (uint256[] memory) {
        return _creatorPlans[creator];
    }
    
    /**
     * @dev Extend rental duration
     * @param user User address
     * @param contentId Content ID
     * @param additionalDuration Additional duration in seconds
     */
    function extendRental(
        address user,
        uint256 contentId,
        uint256 additionalDuration
    ) external onlyRole(MINTER_ROLE) {
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        
        uint256[] memory userTokens = _userContentTokens[user][contentId];
        bool found = false;
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            uint256 tokenId = userTokens[i];
            AccessToken storage token = _accessTokens[tokenId];
            
            if (token.accessType == AccessType.RENTAL && 
                token.active && 
                balanceOf(user, tokenId) > 0) {
                
                token.expiresAt += additionalDuration;
                found = true;
                
                emit RentalExtended(
                    user,
                    tokenId,
                    contentId,
                    additionalDuration,
                    token.expiresAt,
                    block.timestamp
                );
                break;
            }
        }
        
        require(found, "No active rental found");
    }
    
    /**
     * @dev Get access statistics
     * @return uint256 PPV count
     * @return uint256 Subscription count
     * @return uint256 Lifetime count
     * @return uint256 Rental count
     */
    function getAccessStats() external view returns (uint256, uint256, uint256, uint256) {
        return (ppvCount, subscriptionCount, lifetimeCount, rentalCount);
    }
    
    /**
     * @dev Emergency burn function for admin
     * @param account Account to burn from
     * @param id Token ID
     * @param value Amount to burn
     */
    function emergencyBurn(
        address account,
        uint256 id,
        uint256 value
    ) external onlyRole(ADMIN_ROLE) {
        _accessTokens[id].active = false;
        _burn(account, id, value);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Set URI for metadata
     * @param newuri New URI
     */
    function setURI(string memory newuri) external onlyRole(ADMIN_ROLE) {
        _setURI(newuri);
    }
    
    /**
     * @dev Update registry addresses
     * @param _contentRegistry New content registry address
     * @param _creatorRegistry New creator registry address
     */
    function updateRegistries(
        address _contentRegistry,
        address _creatorRegistry
    ) external onlyRole(ADMIN_ROLE) {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_creatorRegistry != address(0), "Invalid creator registry");
        
        contentRegistry = IContentRegistry(_contentRegistry);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
    }
    
    /**
     * @dev Get contract version
     * @return string Version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
    
    // Internal functions
    
    /**
     * @dev Check if content exists
     * @param contentId Content ID
     * @return bool Whether content exists
     */
    function _contentExists(uint256 contentId) internal view returns (bool) {
        try contentRegistry.getContent(contentId) returns (IContentRegistry.Content memory) {
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Check if subscription plan exists
     * @param planId Plan ID
     * @return bool Whether plan exists
     */
    function _subscriptionPlanExists(uint256 planId) internal view returns (bool) {
        return _subscriptionPlans[planId].creator != address(0);
    }
    
    /**
     * @dev Check if user has subscription access to content
     * @param user User address
     * @param contentId Content ID
     * @return bool Whether user has subscription access
     */
    function _hasSubscriptionAccess(address user, uint256 contentId) internal view returns (bool) {
        // Get content creator
        try contentRegistry.getContent(contentId) returns (IContentRegistry.Content memory content) {
            address creator = content.creator;
            
            // Check all creator's subscription plans
            uint256[] memory creatorPlans = _creatorPlans[creator];
            
            for (uint256 i = 0; i < creatorPlans.length; i++) {
                uint256 planId = creatorPlans[i];
                uint256[] memory userTokens = _userContentTokens[user][planId];
                
                for (uint256 j = 0; j < userTokens.length; j++) {
                    uint256 tokenId = userTokens[j];
                    if (balanceOf(user, tokenId) > 0 && _accessTokens[tokenId].active) {
                        AccessToken memory token = _accessTokens[tokenId];
                        
                        if (token.accessType == AccessType.SUBSCRIPTION &&
                            (token.expiresAt == 0 || token.expiresAt > block.timestamp)) {
                            return true;
                        }
                    }
                }
            }
        } catch {
            return false;
        }
        
        return false;
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
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlUpgradeable, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}