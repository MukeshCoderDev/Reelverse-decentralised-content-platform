// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ICreatorRegistry
 * @dev Interface for managing creator profiles and verification status
 */
interface ICreatorRegistry {
    struct Creator {
        address wallet;
        bool ageVerified;
        bool talentVerified;
        uint256 totalEarnings;
        uint32 contentCount;
        uint256 registeredAt;
    }

    event CreatorRegistered(address indexed creator, uint256 timestamp);
    event VerificationStatusUpdated(
        address indexed creator,
        bool ageVerified,
        bool talentVerified,
        uint256 timestamp
    );
    event EarningsUpdated(
        address indexed creator,
        uint256 newTotal,
        uint256 added,
        uint256 timestamp
    );

    /**
     * @dev Register a new creator
     * @param creator Address of the creator to register
     */
    function registerCreator(address creator) external;

    /**
     * @dev Update verification status for a creator
     * @param creator Address of the creator
     * @param ageVerified Whether the creator is age verified
     * @param talentVerified Whether the creator is talent verified
     */
    function setVerificationStatus(
        address creator,
        bool ageVerified,
        bool talentVerified
    ) external;

    /**
     * @dev Add earnings to a creator's total
     * @param creator Address of the creator
     * @param amount Amount to add to earnings
     */
    function addEarnings(address creator, uint256 amount) external;

    /**
     * @dev Increment content count for a creator
     * @param creator Address of the creator
     */
    function incrementContentCount(address creator) external;

    /**
     * @dev Add content ID to creator's content list
     * @param creator Address of the creator
     * @param contentId ID of the content
     */
    function addCreatorContent(address creator, uint256 contentId) external;

    /**
     * @dev Get creator information
     * @param creator Address of the creator
     * @return Creator struct with all information
     */
    function getCreator(address creator) external view returns (Creator memory);

    /**
     * @dev Check if creator has specific verification
     * @param creator Address of the creator
     * @param verificationType 0 = age, 1 = talent
     * @return bool Whether creator has the verification
     */
    function isVerified(address creator, uint8 verificationType) external view returns (bool);

    /**
     * @dev Check if creator is registered
     * @param creator Address to check
     * @return bool Whether creator is registered
     */
    function isRegistered(address creator) external view returns (bool);
}