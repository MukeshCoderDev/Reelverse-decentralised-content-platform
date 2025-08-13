// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgeVerifiedSBT
 * @dev Soul Bound Token for age verification - non-transferable ERC721
 * Implements ERC-5192 (Minimal Soulbound NFTs) standard
 */
contract AgeVerifiedSBT is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ERC-5192 events
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    struct VerificationData {
        uint256 verifiedAt;
        string provider; // "persona", "veriff", etc.
        bytes32 proofHash; // Hash of verification proof (no PII stored)
        bool revoked;
    }

    mapping(uint256 => VerificationData) private _verificationData;
    mapping(address => uint256) private _userTokens; // One token per user
    
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    event AgeVerified(
        address indexed user,
        uint256 indexed tokenId,
        string provider,
        bytes32 proofHash,
        uint256 timestamp
    );

    event VerificationRevoked(
        address indexed user,
        uint256 indexed tokenId,
        string reason,
        uint256 timestamp
    );

    constructor() ERC721("Reelverse Age Verified", "REELAGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint age verification SBT to user
     * @param to Address to mint to
     * @param provider Verification provider name
     * @param proofHash Hash of verification proof
     */
    function mintVerification(
        address to,
        string calldata provider,
        bytes32 proofHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(to != address(0), "Cannot mint to zero address");
        require(!hasVerification(to), "User already has age verification");
        require(bytes(provider).length > 0, "Provider cannot be empty");
        require(proofHash != bytes32(0), "Proof hash cannot be empty");

        uint256 tokenId = _nextTokenId++;
        
        _verificationData[tokenId] = VerificationData({
            verifiedAt: block.timestamp,
            provider: provider,
            proofHash: proofHash,
            revoked: false
        });

        _userTokens[to] = tokenId;
        _safeMint(to, tokenId);

        // ERC-5192: Token is locked (soulbound) upon minting
        emit Locked(tokenId);

        emit AgeVerified(to, tokenId, provider, proofHash, block.timestamp);
    }

    /**
     * @dev Revoke age verification (admin only)
     * @param tokenId Token ID to revoke
     * @param reason Reason for revocation
     */
    function revokeVerification(
        uint256 tokenId,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!_verificationData[tokenId].revoked, "Already revoked");

        address owner = ownerOf(tokenId);
        _verificationData[tokenId].revoked = true;
        delete _userTokens[owner];

        emit VerificationRevoked(owner, tokenId, reason, block.timestamp);
    }

    /**
     * @dev Check if user has valid age verification
     * @param user Address to check
     * @return bool Whether user has valid verification
     */
    function hasVerification(address user) public view returns (bool) {
        uint256 tokenId = _userTokens[user];
        if (tokenId == 0) return false;
        
        return _ownerOf(tokenId) == user && !_verificationData[tokenId].revoked;
    }

    /**
     * @dev Get user's verification token ID
     * @param user Address to check
     * @return uint256 Token ID (0 if no verification)
     */
    function getUserTokenId(address user) external view returns (uint256) {
        return hasVerification(user) ? _userTokens[user] : 0;
    }

    /**
     * @dev Get verification data for token
     * @param tokenId Token ID
     * @return VerificationData struct
     */
    function getVerificationData(uint256 tokenId) external view returns (VerificationData memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _verificationData[tokenId];
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
     * @dev Get total number of verified users
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
        delete _userTokens[owner];
        delete _verificationData[tokenId];
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