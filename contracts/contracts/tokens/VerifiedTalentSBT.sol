// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VerifiedTalentSBT
 * @dev Soul Bound Token for creator talent verification - non-transferable ERC721
 * Implements ERC-5192 (Minimal Soulbound NFTs) standard
 */
contract VerifiedTalentSBT is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ERC-5192 events
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    enum TalentTier {
        VERIFIED,    // Basic verification
        PREMIUM,     // Premium creator
        ELITE,       // Elite creator
        LEGENDARY    // Legendary creator
    }

    struct TalentData {
        uint256 verifiedAt;
        string kycProvider; // "persona", "veriff", etc.
        bytes32 kycHash; // Hash of KYC data (no PII stored)
        TalentTier tier;
        uint256 contentCount;
        uint256 totalEarnings;
        bool revoked;
        string[] specializations; // e.g., ["adult", "gaming", "music"]
    }

    mapping(uint256 => TalentData) private _talentData;
    mapping(address => uint256) private _creatorTokens; // One token per creator
    mapping(TalentTier => uint256) private _tierCounts;
    
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    event TalentVerified(
        address indexed creator,
        uint256 indexed tokenId,
        string kycProvider,
        TalentTier tier,
        uint256 timestamp
    );

    event TalentUpgraded(
        address indexed creator,
        uint256 indexed tokenId,
        TalentTier oldTier,
        TalentTier newTier,
        uint256 timestamp
    );

    event TalentRevoked(
        address indexed creator,
        uint256 indexed tokenId,
        string reason,
        uint256 timestamp
    );

    event StatsUpdated(
        address indexed creator,
        uint256 indexed tokenId,
        uint256 contentCount,
        uint256 totalEarnings,
        uint256 timestamp
    );

    constructor() ERC721("Reelverse Verified Talent", "REELTALENT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint talent verification SBT to creator
     * @param to Address to mint to
     * @param kycProvider KYC provider name
     * @param kycHash Hash of KYC data
     * @param specializations Array of creator specializations
     */
    function mintVerification(
        address to,
        string calldata kycProvider,
        bytes32 kycHash,
        string[] calldata specializations
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(to != address(0), "Cannot mint to zero address");
        require(!hasVerification(to), "Creator already has talent verification");
        require(bytes(kycProvider).length > 0, "KYC provider cannot be empty");
        require(kycHash != bytes32(0), "KYC hash cannot be empty");

        uint256 tokenId = _nextTokenId++;
        TalentTier initialTier = TalentTier.VERIFIED;
        
        _talentData[tokenId] = TalentData({
            verifiedAt: block.timestamp,
            kycProvider: kycProvider,
            kycHash: kycHash,
            tier: initialTier,
            contentCount: 0,
            totalEarnings: 0,
            revoked: false,
            specializations: specializations
        });

        _creatorTokens[to] = tokenId;
        _tierCounts[initialTier]++;
        
        _safeMint(to, tokenId);

        // ERC-5192: Token is locked (soulbound) upon minting
        emit Locked(tokenId);

        emit TalentVerified(to, tokenId, kycProvider, initialTier, block.timestamp);
    }

    /**
     * @dev Update creator statistics
     * @param creator Address of the creator
     * @param contentCount New content count
     * @param totalEarnings New total earnings
     */
    function updateStats(
        address creator,
        uint256 contentCount,
        uint256 totalEarnings
    ) external onlyRole(MINTER_ROLE) {
        require(hasVerification(creator), "Creator not verified");
        
        uint256 tokenId = _creatorTokens[creator];
        TalentData storage data = _talentData[tokenId];
        
        data.contentCount = contentCount;
        data.totalEarnings = totalEarnings;

        // Auto-upgrade tier based on performance
        TalentTier newTier = _calculateTier(contentCount, totalEarnings);
        if (newTier != data.tier) {
            _upgradeTier(creator, tokenId, newTier);
        }

        emit StatsUpdated(creator, tokenId, contentCount, totalEarnings, block.timestamp);
    }

    /**
     * @dev Upgrade creator tier
     * @param creator Address of the creator
     * @param tokenId Token ID
     * @param newTier New tier to upgrade to
     */
    function _upgradeTier(address creator, uint256 tokenId, TalentTier newTier) internal {
        TalentData storage data = _talentData[tokenId];
        TalentTier oldTier = data.tier;
        
        // Update tier counts
        _tierCounts[oldTier]--;
        _tierCounts[newTier]++;
        
        data.tier = newTier;

        emit TalentUpgraded(creator, tokenId, oldTier, newTier, block.timestamp);
    }

    /**
     * @dev Calculate tier based on performance metrics
     * @param contentCount Number of content pieces
     * @param totalEarnings Total earnings in USDC (6 decimals)
     * @return TalentTier Calculated tier
     */
    function _calculateTier(uint256 contentCount, uint256 totalEarnings) internal pure returns (TalentTier) {
        // Convert earnings to USDC (assuming 6 decimals)
        uint256 earningsUSDC = totalEarnings / 1e6;
        
        if (contentCount >= 1000 && earningsUSDC >= 100000) {
            return TalentTier.LEGENDARY; // 1000+ content, $100k+ earnings
        } else if (contentCount >= 500 && earningsUSDC >= 50000) {
            return TalentTier.ELITE; // 500+ content, $50k+ earnings
        } else if (contentCount >= 100 && earningsUSDC >= 10000) {
            return TalentTier.PREMIUM; // 100+ content, $10k+ earnings
        } else {
            return TalentTier.VERIFIED; // Basic verification
        }
    }

    /**
     * @dev Manually upgrade creator tier (admin only)
     * @param creator Address of the creator
     * @param newTier New tier
     */
    function upgradeTier(address creator, TalentTier newTier) external onlyRole(ADMIN_ROLE) {
        require(hasVerification(creator), "Creator not verified");
        
        uint256 tokenId = _creatorTokens[creator];
        TalentData storage data = _talentData[tokenId];
        
        require(newTier > data.tier, "Can only upgrade tier");
        
        _upgradeTier(creator, tokenId, newTier);
    }

    /**
     * @dev Revoke talent verification (admin only)
     * @param tokenId Token ID to revoke
     * @param reason Reason for revocation
     */
    function revokeVerification(
        uint256 tokenId,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!_talentData[tokenId].revoked, "Already revoked");

        address owner = ownerOf(tokenId);
        TalentData storage data = _talentData[tokenId];
        
        data.revoked = true;
        _tierCounts[data.tier]--;
        delete _creatorTokens[owner];

        emit TalentRevoked(owner, tokenId, reason, block.timestamp);
    }

    /**
     * @dev Check if creator has valid talent verification
     * @param creator Address to check
     * @return bool Whether creator has valid verification
     */
    function hasVerification(address creator) public view returns (bool) {
        uint256 tokenId = _creatorTokens[creator];
        if (tokenId == 0) return false;
        
        return _ownerOf(tokenId) == creator && !_talentData[tokenId].revoked;
    }

    /**
     * @dev Get creator's verification token ID
     * @param creator Address to check
     * @return uint256 Token ID (0 if no verification)
     */
    function getCreatorTokenId(address creator) external view returns (uint256) {
        return hasVerification(creator) ? _creatorTokens[creator] : 0;
    }

    /**
     * @dev Get talent data for token
     * @param tokenId Token ID
     * @return TalentData struct
     */
    function getTalentData(uint256 tokenId) external view returns (TalentData memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _talentData[tokenId];
    }

    /**
     * @dev Get creator's tier
     * @param creator Address of the creator
     * @return TalentTier Creator's tier
     */
    function getCreatorTier(address creator) external view returns (TalentTier) {
        require(hasVerification(creator), "Creator not verified");
        uint256 tokenId = _creatorTokens[creator];
        return _talentData[tokenId].tier;
    }

    /**
     * @dev Get tier statistics
     * @return verified Count of verified creators
     * @return premium Count of premium creators
     * @return elite Count of elite creators
     * @return legendary Count of legendary creators
     */
    function getTierStats() external view returns (
        uint256 verified,
        uint256 premium,
        uint256 elite,
        uint256 legendary
    ) {
        return (
            _tierCounts[TalentTier.VERIFIED],
            _tierCounts[TalentTier.PREMIUM],
            _tierCounts[TalentTier.ELITE],
            _tierCounts[TalentTier.LEGENDARY]
        );
    }

    /**
     * @dev ERC-5192: Check if token is locked (always true for SBTs)
     * @param tokenId Token ID
     * @return bool Always true
     */
    function locked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return true; // All tokens are soulbound
    }

    /**
     * @dev Override transfer functions to make tokens non-transferable
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Disallow transfers between addresses
        if (from != address(0) && to != address(0)) {
            revert("Soulbound tokens cannot be transferred");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Set base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string calldata baseURI) external onlyRole(ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Get base URI for token metadata
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
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
     * @dev Get total number of verified creators
     * @return uint256 Count of active verifications
     */
    function getTotalVerified() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @dev Emergency burn function (admin only)
     * @param tokenId Token ID to burn
     */
    function emergencyBurn(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        address owner = ownerOf(tokenId);
        TalentData storage data = _talentData[tokenId];
        
        _tierCounts[data.tier]--;
        delete _creatorTokens[owner];
        delete _talentData[tokenId];
        _burn(tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}