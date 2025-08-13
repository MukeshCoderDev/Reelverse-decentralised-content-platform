// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IRevenueSplitter.sol";

/**
 * @title RevenueSplitter
 * @dev Factory for creating revenue splitter contracts with enforced creator minimum
 */
contract RevenueSplitter is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IRevenueSplitter
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SPLITTER_MANAGER_ROLE = keccak256("SPLITTER_MANAGER_ROLE");

    uint32 public constant MIN_CREATOR_BASIS_POINTS = 9000; // 90%
    uint32 public constant MAX_BASIS_POINTS = 10000; // 100%

    mapping(address => bool) private _splitters;
    mapping(address => SplitterData) private _splitterData;
    address[] private _splitterList;

    struct SplitterData {
        address creator;
        address[] payees;
        uint32[] basisPoints;
        mapping(address => mapping(address => uint256)) released; // token => payee => amount
        mapping(address => uint256) totalReleased; // token => total amount
        mapping(address => uint256) totalReceived; // token => total received amount
        uint256 createdAt;
    }

    event SplitterDeployed(
        address indexed splitter,
        address indexed creator,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SPLITTER_MANAGER_ROLE, msg.sender);
    }

    /**
     * @dev Create a new revenue splitter
     * @param payees Array of payee addresses
     * @param basisPoints Array of basis points (must sum to 10000)
     * @return splitter Address of the created splitter contract
     */
    function createSplitter(
        address[] calldata payees,
        uint32[] calldata basisPoints
    ) external override whenNotPaused nonReentrant returns (address splitter) {
        require(payees.length > 0, "No payees provided");
        require(payees.length == basisPoints.length, "Arrays length mismatch");
        require(payees.length <= 10, "Too many payees"); // Gas optimization

        // Validate configuration
        require(validateSplitterConfig(payees, basisPoints, msg.sender), "Invalid splitter config");

        // Create deterministic address for the splitter
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, payees, basisPoints, block.timestamp));
        splitter = address(new PaymentSplitter{salt: salt}());

        // Initialize the splitter data
        SplitterData storage data = _splitterData[splitter];
        data.creator = msg.sender;
        data.payees = payees;
        data.basisPoints = basisPoints;
        data.createdAt = block.timestamp;

        _splitters[splitter] = true;
        _splitterList.push(splitter);

        emit SplitterCreated(splitter, msg.sender, payees, basisPoints, block.timestamp);
        emit SplitterDeployed(splitter, msg.sender, block.timestamp);

        return splitter;
    }

    /**
     * @dev Release payments from a splitter
     * @param splitter Address of the splitter contract
     * @param token Address of the token to release (address(0) for ETH)
     */
    function release(address splitter, address token) external override nonReentrant {
        require(_splitters[splitter], "Invalid splitter");

        SplitterData storage data = _splitterData[splitter];
        uint256 totalReceived = _getTotalReceived(splitter, token);
        uint256 totalReleased = data.totalReleased[token];
        
        require(totalReceived > totalReleased, "No funds to release");

        uint256 totalPending = totalReceived - totalReleased;

        for (uint256 i = 0; i < data.payees.length; i++) {
            address payee = data.payees[i];
            uint256 payeeShare = (totalPending * data.basisPoints[i]) / MAX_BASIS_POINTS;
            
            if (payeeShare > 0) {
                data.released[token][payee] += payeeShare;
                data.totalReleased[token] += payeeShare;

                if (token == address(0)) {
                    // ETH transfer from splitter contract
                    PaymentSplitter(payable(splitter)).transferETH(payee, payeeShare);
                } else {
                    // ERC20 transfer from splitter contract
                    PaymentSplitter(payable(splitter)).transferToken(token, payee, payeeShare);
                }

                emit PaymentReleased(splitter, token, payee, payeeShare, block.timestamp);
            }
        }
    }

    /**
     * @dev Release payment to specific payee
     * @param splitter Address of the splitter contract
     * @param token Address of the token to release
     * @param payee Address of the payee
     */
    function releaseToPayee(address splitter, address token, address payee) external override nonReentrant {
        require(_splitters[splitter], "Invalid splitter");

        SplitterData storage data = _splitterData[splitter];
        
        // Find payee index
        uint256 payeeIndex = type(uint256).max;
        for (uint256 i = 0; i < data.payees.length; i++) {
            if (data.payees[i] == payee) {
                payeeIndex = i;
                break;
            }
        }
        require(payeeIndex != type(uint256).max, "Payee not found");

        uint256 totalReceived = _getTotalReceived(splitter, token);
        uint256 payeeShare = (totalReceived * data.basisPoints[payeeIndex]) / MAX_BASIS_POINTS;
        uint256 alreadyReleased = data.released[token][payee];
        
        require(payeeShare > alreadyReleased, "No funds to release for payee");

        uint256 payment = payeeShare - alreadyReleased;
        data.released[token][payee] = payeeShare;
        data.totalReleased[token] += payment;

        if (token == address(0)) {
            // ETH transfer from splitter contract
            PaymentSplitter(payable(splitter)).transferETH(payee, payment);
        } else {
            // ERC20 transfer from splitter contract
            PaymentSplitter(payable(splitter)).transferToken(token, payee, payment);
        }

        emit PaymentReleased(splitter, token, payee, payment, block.timestamp);
    }

    /**
     * @dev Get splitter information
     * @param splitter Address of the splitter contract
     * @return payees Array of payee addresses
     * @return basisPoints Array of basis points
     */
    function getSplitterInfo(address splitter) external view override returns (
        address[] memory payees,
        uint32[] memory basisPoints
    ) {
        require(_splitters[splitter], "Invalid splitter");
        
        SplitterData storage data = _splitterData[splitter];
        return (data.payees, data.basisPoints);
    }

    /**
     * @dev Get pending payment for payee
     * @param splitter Address of the splitter contract
     * @param token Address of the token
     * @param payee Address of the payee
     * @return uint256 Pending payment amount
     */
    function getPendingPayment(
        address splitter,
        address token,
        address payee
    ) external view override returns (uint256) {
        if (!_splitters[splitter]) return 0;

        SplitterData storage data = _splitterData[splitter];
        
        // Find payee index
        uint256 payeeIndex = type(uint256).max;
        for (uint256 i = 0; i < data.payees.length; i++) {
            if (data.payees[i] == payee) {
                payeeIndex = i;
                break;
            }
        }
        if (payeeIndex == type(uint256).max) return 0;

        uint256 totalReceived = _getTotalReceived(splitter, token);
        uint256 payeeShare = (totalReceived * data.basisPoints[payeeIndex]) / MAX_BASIS_POINTS;
        uint256 alreadyReleased = data.released[token][payee];

        return payeeShare > alreadyReleased ? payeeShare - alreadyReleased : 0;
    }

    /**
     * @dev Get total released amount
     * @param splitter Address of the splitter contract
     * @param token Address of the token
     * @return uint256 Total released amount
     */
    function getTotalReleased(address splitter, address token) external view override returns (uint256) {
        if (!_splitters[splitter]) return 0;
        return _splitterData[splitter].totalReleased[token];
    }

    /**
     * @dev Check if address is a valid splitter
     * @param splitter Address to check
     * @return bool Whether address is a splitter
     */
    function isSplitter(address splitter) external view override returns (bool) {
        return _splitters[splitter];
    }

    /**
     * @dev Validate splitter configuration
     * @param payees Array of payee addresses
     * @param basisPoints Array of basis points
     * @param creator Address of the creator (must have >= 90%)
     * @return bool Whether configuration is valid
     */
    function validateSplitterConfig(
        address[] calldata payees,
        uint32[] calldata basisPoints,
        address creator
    ) public pure override returns (bool) {
        if (payees.length == 0 || payees.length != basisPoints.length) {
            return false;
        }

        uint32 totalBasisPoints = 0;
        uint32 creatorBasisPoints = 0;
        bool creatorFound = false;

        for (uint256 i = 0; i < payees.length; i++) {
            if (payees[i] == address(0)) {
                return false; // Invalid address
            }
            
            if (basisPoints[i] == 0) {
                return false; // No zero shares
            }

            totalBasisPoints += basisPoints[i];
            
            if (payees[i] == creator) {
                creatorBasisPoints += basisPoints[i];
                creatorFound = true;
            }

            // Check for duplicate payees
            for (uint256 j = i + 1; j < payees.length; j++) {
                if (payees[i] == payees[j]) {
                    return false;
                }
            }
        }

        // Must sum to 100%
        if (totalBasisPoints != MAX_BASIS_POINTS) {
            return false;
        }

        // Creator must be included and have at least 90%
        if (!creatorFound || creatorBasisPoints < MIN_CREATOR_BASIS_POINTS) {
            return false;
        }

        return true;
    }

    /**
     * @dev Get total received amount for a splitter
     * @param splitter Address of the splitter
     * @param token Address of the token
     * @return uint256 Total received amount
     */
    function _getTotalReceived(address splitter, address token) internal view returns (uint256) {
        SplitterData storage data = _splitterData[splitter];
        uint256 currentBalance;
        
        if (token == address(0)) {
            currentBalance = splitter.balance;
        } else {
            currentBalance = IERC20(token).balanceOf(splitter);
        }
        
        // Total received = previously released + current balance
        return data.totalReleased[token] + currentBalance;
    }

    /**
     * @dev Get splitter creator
     * @param splitter Address of the splitter
     * @return address Creator address
     */
    function getSplitterCreator(address splitter) external view returns (address) {
        require(_splitters[splitter], "Invalid splitter");
        return _splitterData[splitter].creator;
    }

    /**
     * @dev Get all splitters for a creator
     * @param creator Address of the creator
     * @return address[] Array of splitter addresses
     */
    function getCreatorSplitters(address creator) external view returns (address[] memory) {
        uint256 count = 0;
        
        // Count splitters for this creator
        for (uint256 i = 0; i < _splitterList.length; i++) {
            if (_splitterData[_splitterList[i]].creator == creator) {
                count++;
            }
        }

        // Build result array
        address[] memory result = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _splitterList.length; i++) {
            if (_splitterData[_splitterList[i]].creator == creator) {
                result[index] = _splitterList[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Get total number of splitters
     * @return uint256 Total splitter count
     */
    function getTotalSplitters() external view returns (uint256) {
        return _splitterList.length;
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
     * @dev Get contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Receive function - factory doesn't accept direct payments
     */
    receive() external payable {
        revert("Direct payments not accepted");
    }
}

/**
 * @title PaymentSplitter
 * @dev Individual payment splitter contract
 */
contract PaymentSplitter {
    using SafeERC20 for IERC20;
    
    address public immutable factory;

    event PaymentReceived(address indexed from, uint256 amount, uint256 timestamp);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    /**
     * @dev Receive function to accept payments
     */
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Fallback function
     */
    fallback() external payable {
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Transfer ETH to payee (only factory)
     * @param payee Address to transfer to
     * @param amount Amount to transfer
     */
    function transferETH(address payee, uint256 amount) external onlyFactory {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        (bool success, ) = payee.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    /**
     * @dev Transfer ERC20 tokens to payee (only factory)
     * @param token Token contract address
     * @param payee Address to transfer to
     * @param amount Amount to transfer
     */
    function transferToken(address token, address payee, uint256 amount) external onlyFactory {
        IERC20(token).safeTransfer(payee, amount);
    }

    /**
     * @dev Get factory address
     * @return address Factory contract address
     */
    function getFactory() external view returns (address) {
        return factory;
    }
}