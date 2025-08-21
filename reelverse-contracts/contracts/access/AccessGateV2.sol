// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/IContentRegistryV2.sol";

/// @title AccessGateV2 - EIP-712 typed playback permits with scoped session usage
contract AccessGateV2 is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    IContentRegistryV2 public immutable registry;

    // struct PlaybackPermit { address viewer; uint256 contentId; bytes32 session; uint256 expiresAt; }
    bytes32 public constant PLAYBACK_TYPEHASH =
        keccak256("PlaybackPermit(address viewer,uint256 contentId,bytes32 session,uint256 expiresAt)");

    mapping(bytes32 => bool) private _used; // keccak256(contentId, session)

    event PlaybackConsumed(address indexed viewer, uint256 indexed contentId, bytes32 indexed session, uint256 expiresAt, address signer);

    constructor(address admin, address registry_) EIP712("ReelverseAccess", "2") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        registry = IContentRegistryV2(registry_);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function checkAccess(address /*viewer*/, uint256 contentId) external view returns (bool) {
        (, , , , , uint8 status) = registry.getContent(contentId);
        return status == 1;
    }

    function isUsed(uint256 contentId, bytes32 session) external view returns (bool) {
        return _used[keccak256(abi.encodePacked(contentId, session))];
    }

    function verifyTyped(
        address viewer,
        uint256 contentId,
        bytes32 session,
        uint256 expiresAt,
        bytes calldata signature
    ) public view returns (bool) {
        if (block.timestamp > expiresAt) return false;
        if (_used[keccak256(abi.encodePacked(contentId, session))]) return false;
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(PLAYBACK_TYPEHASH, viewer, contentId, session, expiresAt))
        );
        address signer = ECDSA.recover(digest, signature);
        return hasRole(SIGNER_ROLE, signer);
    }

    /// Restrict consumption to SIGNER_ROLE (backend) to prevent griefing
    function consume(
        address viewer,
        uint256 contentId,
        bytes32 session,
        uint256 expiresAt,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRole(SIGNER_ROLE) {
        require(verifyTyped(viewer, contentId, session, expiresAt, signature), "invalid permit");
        _used[keccak256(abi.encodePacked(contentId, session))] = true;

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(PLAYBACK_TYPEHASH, viewer, contentId, session, expiresAt))
        );
        address signer = ECDSA.recover(digest, signature);
        emit PlaybackConsumed(viewer, contentId, session, expiresAt, signer);
    }
}