// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice USDC-only policy interface exposed by the factory to its clones
interface ISplitterPolicy {
    function usdc() external view returns (address);
}