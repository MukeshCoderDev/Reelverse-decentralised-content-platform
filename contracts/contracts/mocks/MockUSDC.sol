// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing with permit functionality
 */
contract MockUSDC is ERC20, ERC20Permit, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals

    constructor() 
        ERC20("Mock USD Coin", "USDC") 
        ERC20Permit("Mock USD Coin")
        Ownable(msg.sender)
    {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1000000 * 10**_decimals); // 1M USDC
    }

    /**
     * @dev Override decimals to match USDC
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens for testing (owner only)
     * @param to Address to mint to
     * @param amount Amount to mint (in token units, not wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10**_decimals);
    }

    /**
     * @dev Faucet function for testing - anyone can get 1000 USDC
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 1000 * 10**_decimals, "Already has enough USDC");
        _mint(msg.sender, 1000 * 10**_decimals);
    }

    /**
     * @dev Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}