// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IContentRegistryV2 {
    function getContent(uint256 contentId)
        external view
        returns (
            address creator,
            address splitter,
            uint64  priceUsdCents,
            uint32  geoMask,
            bytes32 metaHash,
            uint8   status
        );
    function exists(uint256 contentId) external view returns (bool);
}