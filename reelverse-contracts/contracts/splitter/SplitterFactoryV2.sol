// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PaymentSplitterClone.sol";
import "./ISplitterPolicy.sol";

/// @title SplitterFactoryV2 - USDC-only deterministic splitters, creator >= 90%
contract SplitterFactoryV2 is AccessControl, Pausable, ReentrancyGuard, ISplitterPolicy {
    using Clones for address;

    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    uint16 public constant MAX_BPS = 10000;

    address public immutable implementation;
    address public immutable USDC;          // per-network USDC set at deploy
    uint16  public minCreatorBps = 9000;

    mapping(uint256 => address) public splitterOf; // contentId => splitter

    event SplitterCreated(
        uint256 indexed contentId,
        address indexed splitter,
        address indexed creator,
        uint32  creatorBps,
        address[] payees,
        uint32[] bps
    );
    event MinCreatorBpsUpdated(uint16 oldVal, uint16 newVal);

    constructor(address admin, address usdc_) {
        require(usdc_ != address(0), "usdc=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        implementation = address(new PaymentSplitterClone());
        USDC = usdc_;
    }

    // Policy interface
    function usdc() external view override returns (address) { return USDC; }

    function setMinCreatorBps(uint16 bps) external onlyRole(ADMIN_ROLE) {
        require(bps <= MAX_BPS && bps >= 9000, "invalid bps");
        uint16 old = minCreatorBps;
        minCreatorBps = bps;
        emit MinCreatorBpsUpdated(old, bps);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function createSplitterForContent(
        uint256 contentId,
        address creator,
        address[] calldata payees,
        uint32[]  calldata bps,
        bytes32 saltHint
    ) external whenNotPaused onlyRole(PUBLISHER_ROLE) nonReentrant returns (address splitter) {
        require(contentId != 0, "contentId=0");
        require(splitterOf[contentId] == address(0), "exists");
        require(payees.length == bps.length && payees.length > 0, "bad lengths");

        uint256 total;
        bool hasCreator = false;
        uint32 creatorShare = 0;
        for (uint256 i = 0; i < payees.length; i++) {
            total += bps[i];
            if (payees[i] == creator) { hasCreator = true; creatorShare = bps[i]; }
        }
        require(total == MAX_BPS, "sum!=100%");
        require(hasCreator, "creator missing");
        require(creatorShare >= minCreatorBps, "creator<bps");

        bytes32 salt = keccak256(abi.encodePacked(contentId, creator, saltHint));
        splitter = implementation.cloneDeterministic(salt);
        PaymentSplitterClone(payable(splitter)).init(payees, bps, address(this));
        splitterOf[contentId] = splitter;

        emit SplitterCreated(contentId, splitter, creator, creatorShare, payees, bps);
    }

    function predictSplitterAddress(
        uint256 contentId,
        address creator,
        bytes32 saltHint
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(contentId, creator, saltHint));
        predicted = implementation.predictDeterministicAddress(salt, address(this));
    }
}