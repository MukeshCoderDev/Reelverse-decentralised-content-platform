// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenueSplitter
 * @dev Interface for revenue splitting with enforced creator minimum
 */
interface IRevenueSplitter {
    struct Split {
        address payee;
        uint32 basisPoints; // Out of 10000 (100.00%)
    }

    event SplitterCreated(
        address indexed splitter,
        address indexed creator,
        address[] payees,
        uint32[] basisPoints,
        uint256 timestamp
    );

    event PaymentReleased(
        address indexed splitter,
        address indexed token,
        address indexed payee,
        uint256 amount,
        uint256 timestamp
    );

    event PaymentReceived(
        address indexed splitter,
        address indexed from,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Create a new revenue splitter
     * @param payees Array of payee addresses
     * @param basisPoints Array of basis points (must sum to 10000)
     * @return splitter Address of the created splitter contract
     */
    function createSplitter(
        address[] calldata payees,
        uint32[] calldata basisPoints
    ) external returns (address splitter);

    /**
     * @dev Release payments from a splitter
     * @param splitter Address of the splitter contract
     * @param token Address of the token to release (address(0) for ETH)
     */
    function release(address splitter, address token) external;

    /**
     * @dev Release payment to specific payee
     * @param splitter Address of the splitter contract
     * @param token Address of the token to release
     * @param payee Address of the payee
     */
    function releaseToPayee(address splitter, address token, address payee) external;

    /**
     * @dev Get splitter information
     * @param splitter Address of the splitter contract
     * @return payees Array of payee addresses
     * @return basisPoints Array of basis points
     */
    function getSplitterInfo(address splitter) external view returns (
        address[] memory payees,
        uint32[] memory basisPoints
    );

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
    ) external view returns (uint256);

    /**
     * @dev Get total released amount
     * @param splitter Address of the splitter contract
     * @param token Address of the token
     * @return uint256 Total released amount
     */
    function getTotalReleased(address splitter, address token) external view returns (uint256);

    /**
     * @dev Check if address is a valid splitter
     * @param splitter Address to check
     * @return bool Whether address is a splitter
     */
    function isSplitter(address splitter) external view returns (bool);

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
    ) external pure returns (bool);
}