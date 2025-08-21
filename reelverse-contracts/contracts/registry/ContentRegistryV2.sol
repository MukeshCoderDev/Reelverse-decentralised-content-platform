// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ContentRegistryV2 - Minimal authoritative registry (no unbounded loops)
contract ContentRegistryV2 is AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    enum Status { Inactive, Active, Paused, ModerationHold, Removed }

    struct Content {
        address creator;
        address splitter;
        uint64  priceUsdCents;
        uint32  geoMask;
        bytes32 metaHash;
        Status  status;
    }

    mapping(uint256 => Content) private _content;

    event ContentRegistered(
        uint256 indexed contentId,
        address indexed creator,
        address indexed splitter,
        uint64  priceUsdCents,
        uint32  geoMask,
        bytes32 metaHash,
        uint8   status
    );

    event ContentUpdated(
        uint256 indexed contentId,
        uint64  priceUsdCents,
        uint32  geoMask,
        bytes32 metaHash
    );

    event ModerationUpdated(
        uint256 indexed contentId,
        uint8   oldStatus,
      uint8   newStatus,
        string  reason
    );

    event ContentSale(
        uint256 indexed contentId,
        address indexed buyer,
        uint64  priceUsdCents,
        bytes32 txRef,
        uint256 timestamp
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function registerContent(
        uint256 contentId,
        address creator,
        address splitter,
        uint64  priceUsdCents,
        uint32  geoMask,
        bytes32 metaHash
    ) external whenNotPaused onlyRole(PUBLISHER_ROLE) {
        require(contentId != 0, "contentId=0");
        Content storage c = _content[contentId];
        require(c.creator == address(0), "exists");
        require(creator != address(0), "creator=0");
        c.creator = creator;
        c.splitter = splitter;
        c.priceUsdCents = priceUsdCents;
        c.geoMask = geoMask;
        c.metaHash = metaHash;
        c.status = Status.Active;

        emit ContentRegistered(contentId, creator, splitter, priceUsdCents, geoMask, metaHash, uint8(c.status));
    }

    function setPrice(uint256 contentId, uint64 priceUsdCents) external {
        Content storage c = _must(contentId);
        _requireCreatorOrAdmin(c.creator);
        c.priceUsdCents = priceUsdCents;
        emit ContentUpdated(contentId, c.priceUsdCents, c.geoMask, c.metaHash);
    }

    function setMetaHash(uint256 contentId, bytes32 metaHash) external {
        Content storage c = _must(contentId);
        _requireCreatorOrAdmin(c.creator);
        c.metaHash = metaHash;
        emit ContentUpdated(contentId, c.priceUsdCents, c.geoMask, c.metaHash);
    }

    function setGeoMask(uint256 contentId, uint32 geoMask) external {
        Content storage c = _must(contentId);
        _requireCreatorOrAdmin(c.creator);
        c.geoMask = geoMask;
        emit ContentUpdated(contentId, c.priceUsdCents, c.geoMask, c.metaHash);
    }

    function setSplitter(uint256 contentId, address splitter) external onlyRole(ADMIN_ROLE) {
        Content storage c = _must(contentId);
        c.splitter = splitter;
        emit ContentUpdated(contentId, c.priceUsdCents, c.geoMask, c.metaHash);
    }

    function setModerationStatus(uint256 contentId, Status newStatus, string calldata reason)
        external onlyRole(MODERATOR_ROLE)
    {
        Content storage c = _must(contentId);
        Status old = c.status;
        c.status = newStatus;
        emit ModerationUpdated(contentId, uint8(old), uint8(newStatus), reason);
    }

    function recordSale(
        uint256 contentId,
        address buyer,
        uint64  priceUsdCents,
        bytes32 txRef
    ) external whenNotPaused onlyRole(PUBLISHER_ROLE) {
        _must(contentId);
        emit ContentSale(contentId, buyer, priceUsdCents, txRef, block.timestamp);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function getContent(uint256 contentId)
        external view returns (
            address creator,
            address splitter,
            uint64  priceUsdCents,
            uint32  geoMask,
            bytes32 metaHash,
            uint8   status
        )
    {
        Content storage c = _content[contentId];
        require(c.creator != address(0), "not found");
        return (c.creator, c.splitter, c.priceUsdCents, c.geoMask, c.metaHash, uint8(c.status));
    }

    function exists(uint256 contentId) external view returns (bool) {
        return _content[contentId].creator != address(0);
    }

    // internals
    function _must(uint256 contentId) internal view returns (Content storage) {
        Content storage c = _content[contentId];
        require(c.creator != address(0), "not found");
        return c;
    }
    function _requireCreatorOrAdmin(address creator) internal view {
        if (msg.sender != creator) require(hasRole(ADMIN_ROLE, msg.sender), "not creator/admin");
    }
}