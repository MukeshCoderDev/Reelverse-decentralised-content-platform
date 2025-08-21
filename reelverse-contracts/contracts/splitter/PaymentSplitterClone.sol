// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ISplitterPolicy.sol";

/// @title PaymentSplitterClone - USDC-only pull-based splitter (EIP-1167 clone)
contract PaymentSplitterClone is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AlreadyInitialized();
    error NotFactory();
    error BadConfig();
    error NoPaymentDue();
    error TokenNotUSDC();
    error EthDisabled();

    uint16 public constant MAX_BPS = 10000;

    address public factory;       // SplitterFactoryV2
    bool    private _initialized;

    address[] private _payees;
    mapping(address => uint32) private _bpsOf;

    mapping(address => uint256) public totalReleased;               // token => total released
    mapping(address => mapping(address => uint256)) public released; // token => payee => released

    event Initialized(address factory, address[] payees, uint32[] bps);
    event PaymentReceived(address indexed from, address indexed token, uint256 amount);
    event PaymentReleased(address indexed token, address indexed payee, uint256 amount);
    event SweptWrongToken(address token, address to, uint256 amount);

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    receive() external payable { revert EthDisabled(); }

    function init(address[] calldata payees_, uint32[] calldata bps_, address factory_) external {
        if (_initialized) revert AlreadyInitialized();
        if (payees_.length == 0 || payees_.length != bps_.length) revert BadConfig();
        factory = factory_;
        _initialized = true;

        uint256 total;
        for (uint256 i = 0; i < payees_.length; i++) {
            address p = payees_[i];
            uint32  b = bps_[i];
            require(p != address(0) && b > 0, "zero payee/bps");
            require(_bpsOf[p] == 0, "dup payee");
            _bpsOf[p] = b;
            _payees.push(p);
            total += b;
        }
        require(total == MAX_BPS, "sum!=100%");
        emit Initialized(factory_, payees_, bps_);
    }

    // views
    function payees() external view returns (address[] memory) { return _payees; }
    function bpsOf(address payee) external view returns (uint32) { return _bpsOf[payee]; }

    function _usdc() internal view returns (address) {
        return ISplitterPolicy(factory).usdc();
    }

    function totalReceived(address token) public view returns (uint256) {
        if (token != _usdc()) revert TokenNotUSDC();
        return IERC20(token).balanceOf(address(this)) + totalReleased[token];
    }

    function pending(address token, address payee) public view returns (uint256) {
        if (token != _usdc()) revert TokenNotUSDC();
        uint32 bps = _bpsOf[payee];
        if (bps == 0) return 0;
        uint256 entitled = (totalReceived(token) * bps) / MAX_BPS;
        uint256 already  = released[token][payee];
        if (entitled <= already) return 0;
        return entitled - already;
    }

    // payouts
    function release(address token, address payee) public nonReentrant {
        if (token != _usdc()) revert TokenNotUSDC();
        uint256 amount = pending(token, payee);
        if (amount == 0) revert NoPaymentDue();
        released[token][payee] += amount;
        totalReleased[token] += amount;
        IERC20(token).safeTransfer(payee, amount);
        emit PaymentReleased(token, payee, amount);
    }

    function release(address token) external { release(token, msg.sender); }

    // deposits
    function depositUSDC(uint256 amount) external {
        address token = _usdc();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit PaymentReceived(msg.sender, token, amount);
    }

    /// @notice Rescue any non-USDC tokens accidentally sent to the splitter
    function sweepWrongToken(address token, address to) external onlyFactory {
        require(token != _usdc(), "not-wrong");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).safeTransfer(to, bal);
        emit SweptWrongToken(token, to, bal);
    }
}