// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 private immutable _dec = 6;
    constructor() ERC20("USD Coin", "USDC") { _mint(msg.sender, 1_000_000_000 * 10**_dec); }
    function decimals() public view override returns (uint8) { return _dec; }
}