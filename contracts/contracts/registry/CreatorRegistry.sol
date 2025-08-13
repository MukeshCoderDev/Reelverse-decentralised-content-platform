// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/ICreatorRegistry.sol";
import "../tokens/AgeVerifiedSBT.sol";
import "../tokens/VerifiedTalentSBT.sol";

/**
 * @title CreatorRegistry
 * @dev Registry for managing creator profiles and verification status
 */
contract CreatorRegistry is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ICreatorRegistry
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant STATS_UPDATER_ROLE = keccak256("STATS_UPDATER_ROLE");

    AgeVerifiedSBT public ageVerifiedSBT;
    VerifiedTalentSBT public verifiedTalentSBT;

    mapping(address => Creator) private _creators;
    mapping(address => bool) private _registered;
    
    address[] private _creatorList;
    uint256 public totalCreators;
    uint256 public totalVerifiedCreators;
    uint256 public totalAgeVerifiedCreators;

    // Statistics tracking
    mapping(address => uint256[]) private _creatorContent; // contentId[]
    mapping(address => uint256) private _lastActivityTime;

    event CreatorProfileUpdated(
        address indexed creator,
        string profileURI,
        uint256 timestamp
    );

    event CreatorStatusChanged(
        address indexed creator,
        bool active,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ageVerifiedSBT,
        address _verifiedTalentSBT
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_ageVerifiedSBT != address(0), "Invalid age SBT address");
        require(_verifiedTalentSBT != address(0), "Invalid talent SBT address");

        ageVerifiedSBT = AgeVerifiedSBT(_ageVerifiedSBT);
        verifiedTalentSBT = VerifiedTalentSBT(_verifiedTalentSBT);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(STATS_UPDATER_ROLE, msg.sender);
    }

    /**
     * @dev Register a new creator
     * @param creator Address of the creator to register
     */
    function registerCreator(address creator) external override whenNotPaused nonReentrant {
        require(creator != address(0), "Invalid creator address");
        require(!_registered[creator], "Creator already registered");
        require(msg.sender == creator || hasRole(ADMIN_ROLE, msg.sender), "Unauthorized registration");

        _creators[creator] = Creator({
            wallet: creator,
            ageVerified: false,
            talentVerified: false,
            totalEarnings: 0,
            contentCount: 0,
            registeredAt: block.timestamp
        });

        _registered[creator] = true;
        _creatorList.push(creator);
        _lastActivityTime[creator] = block.timestamp;
        
        totalCreators++;

        emit CreatorRegistered(creator, block.timestamp);
    }

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
    ) external override onlyRole(VERIFIER_ROLE) whenNotPaused {
        require(_registered[creator], "Creator not registered");

        Creator storage creatorData = _creators[creator];
        bool wasAgeVerified = creatorData.ageVerified;
        bool wasTalentVerified = creatorData.talentVerified;
        bool wasVerified = wasAgeVerified && wasTalentVerified;

        // Update verification status based on SBT ownership
        creatorData.ageVerified = ageVerified && ageVerifiedSBT.hasVerification(creator);
        creatorData.talentVerified = talentVerified && verifiedTalentSBT.hasVerification(creator);

        // Update counters
        if (!wasAgeVerified && creatorData.ageVerified) {
            totalAgeVerifiedCreators++;
        } else if (wasAgeVerified && !creatorData.ageVerified) {
            totalAgeVerifiedCreators--;
        }

        bool isNowVerified = creatorData.ageVerified && creatorData.talentVerified;
        if (!wasVerified && isNowVerified) {
            totalVerifiedCreators++;
        } else if (wasVerified && !isNowVerified) {
            totalVerifiedCreators--;
        }

        emit VerificationStatusUpdated(
            creator,
            creatorData.ageVerified,
            creatorData.talentVerified,
            block.timestamp
        );
    }

    /**
     * @dev Add earnings to a creator's total
     * @param creator Address of the creator
     * @param amount Amount to add to earnings
     */
    function addEarnings(address creator, uint256 amount) external override onlyRole(STATS_UPDATER_ROLE) {
        require(_registered[creator], "Creator not registered");
        require(amount > 0, "Amount must be greater than 0");

        Creator storage creatorData = _creators[creator];
        creatorData.totalEarnings += amount;
        
        _lastActivityTime[creator] = block.timestamp;

        // Update talent SBT stats if creator has one
        if (verifiedTalentSBT.hasVerification(creator)) {
            verifiedTalentSBT.updateStats(creator, creatorData.contentCount, creatorData.totalEarnings);
        }

        emit EarningsUpdated(creator, creatorData.totalEarnings, amount, block.timestamp);
    }

    /**
     * @dev Increment content count for a creator
     * @param creator Address of the creator
     */
    function incrementContentCount(address creator) external override onlyRole(STATS_UPDATER_ROLE) {
        require(_registered[creator], "Creator not registered");

        Creator storage creatorData = _creators[creator];
        creatorData.contentCount++;
        
        _lastActivityTime[creator] = block.timestamp;

        // Update talent SBT stats if creator has one
        if (verifiedTalentSBT.hasVerification(creator)) {
            verifiedTalentSBT.updateStats(creator, creatorData.contentCount, creatorData.totalEarnings);
        }
    }

    /**
     * @dev Add content ID to creator's content list
     * @param creator Address of the creator
     * @param contentId ID of the content
     */
    function addCreatorContent(address creator, uint256 contentId) external onlyRole(STATS_UPDATER_ROLE) {
        require(_registered[creator], "Creator not registered");
        
        _creatorContent[creator].push(contentId);
        
        // Increment content count directly
        Creator storage creatorData = _creators[creator];
        creatorData.contentCount++;
        
        _lastActivityTime[creator] = block.timestamp;

        // Update talent SBT stats if creator has one
        if (verifiedTalentSBT.hasVerification(creator)) {
            verifiedTalentSBT.updateStats(creator, creatorData.contentCount, creatorData.totalEarnings);
        }
    }

    /**
     * @dev Get creator information
     * @param creator Address of the creator
     * @return Creator struct with all information
     */
    function getCreator(address creator) external view override returns (Creator memory) {
        require(_registered[creator], "Creator not registered");
        
        Creator memory creatorData = _creators[creator];
        
        // Update verification status based on current SBT ownership
        creatorData.ageVerified = ageVerifiedSBT.hasVerification(creator);
        creatorData.talentVerified = verifiedTalentSBT.hasVerification(creator);
        
        return creatorData;
    }

    /**
     * @dev Check if creator has specific verification
     * @param creator Address of the creator
     * @param verificationType 0 = age, 1 = talent
     * @return bool Whether creator has the verification
     */
    function isVerified(address creator, uint8 verificationType) external view override returns (bool) {
        if (!_registered[creator]) return false;
        
        if (verificationType == 0) {
            return ageVerifiedSBT.hasVerification(creator);
        } else if (verificationType == 1) {
            return verifiedTalentSBT.hasVerification(creator);
        }
        
        return false;
    }

    /**
     * @dev Check if creator is registered
     * @param creator Address to check
     * @return bool Whether creator is registered
     */
    function isRegistered(address creator) external view override returns (bool) {
        return _registered[creator];
    }

    /**
     * @dev Get creator's content list
     * @param creator Address of the creator
     * @return uint256[] Array of content IDs
     */
    function getCreatorContent(address creator) external view returns (uint256[] memory) {
        require(_registered[creator], "Creator not registered");
        return _creatorContent[creator];
    }

    /**
     * @dev Get creator's last activity time
     * @param creator Address of the creator
     * @return uint256 Last activity timestamp
     */
    function getLastActivityTime(address creator) external view returns (uint256) {
        require(_registered[creator], "Creator not registered");
        return _lastActivityTime[creator];
    }

    /**
     * @dev Get paginated list of creators
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return creators Array of creator addresses
     * @return total Total number of creators
     */
    function getCreators(uint256 offset, uint256 limit) external view returns (
        address[] memory creators,
        uint256 total
    ) {
        total = totalCreators;
        
        if (offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        creators = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            creators[i - offset] = _creatorList[i];
        }
    }

    /**
     * @dev Get verified creators only
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return creators Array of verified creator addresses
     * @return total Total number of verified creators
     */
    function getVerifiedCreators(uint256 offset, uint256 limit) external view returns (
        address[] memory creators,
        uint256 total
    ) {
        // Count verified creators
        address[] memory verifiedList = new address[](totalVerifiedCreators);
        uint256 verifiedCount = 0;
        
        for (uint256 i = 0; i < _creatorList.length; i++) {
            address creator = _creatorList[i];
            if (ageVerifiedSBT.hasVerification(creator) && verifiedTalentSBT.hasVerification(creator)) {
                if (verifiedCount < totalVerifiedCreators) {
                    verifiedList[verifiedCount] = creator;
                    verifiedCount++;
                }
            }
        }
        
        total = verifiedCount;
        
        if (offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        creators = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            creators[i - offset] = verifiedList[i];
        }
    }

    /**
     * @dev Get platform statistics
     * @return totalCreators_ Total number of creators
     * @return totalVerified Total number of fully verified creators
     * @return totalAgeVerified Total number of age verified creators
     * @return totalEarnings Total platform earnings
     */
    function getPlatformStats() external view returns (
        uint256 totalCreators_,
        uint256 totalVerified,
        uint256 totalAgeVerified,
        uint256 totalEarnings
    ) {
        totalCreators_ = totalCreators;
        totalVerified = totalVerifiedCreators;
        totalAgeVerified = totalAgeVerifiedCreators;
        
        // Calculate total platform earnings
        for (uint256 i = 0; i < _creatorList.length; i++) {
            totalEarnings += _creators[_creatorList[i]].totalEarnings;
        }
    }

    /**
     * @dev Update creator profile URI
     * @param creator Address of the creator
     * @param profileURI IPFS URI for creator profile
     */
    function updateCreatorProfile(address creator, string calldata profileURI) external {
        require(_registered[creator], "Creator not registered");
        require(msg.sender == creator || hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        require(bytes(profileURI).length > 0, "Profile URI cannot be empty");

        _lastActivityTime[creator] = block.timestamp;

        emit CreatorProfileUpdated(creator, profileURI, block.timestamp);
    }

    /**
     * @dev Set creator active/inactive status
     * @param creator Address of the creator
     * @param active Whether creator is active
     */
    function setCreatorStatus(address creator, bool active) external {
        require(_registered[creator], "Creator not registered");
        require(msg.sender == creator || hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");

        if (active) {
            _lastActivityTime[creator] = block.timestamp;
        }

        emit CreatorStatusChanged(creator, active, block.timestamp);
    }

    /**
     * @dev Emergency function to sync verification status with SBTs
     * @param creator Address of the creator
     */
    function syncVerificationStatus(address creator) external onlyRole(ADMIN_ROLE) {
        require(_registered[creator], "Creator not registered");

        Creator storage creatorData = _creators[creator];
        bool wasAgeVerified = creatorData.ageVerified;
        bool wasTalentVerified = creatorData.talentVerified;
        bool wasVerified = wasAgeVerified && wasTalentVerified;

        // Sync with actual SBT ownership
        creatorData.ageVerified = ageVerifiedSBT.hasVerification(creator);
        creatorData.talentVerified = verifiedTalentSBT.hasVerification(creator);

        // Update counters
        if (!wasAgeVerified && creatorData.ageVerified) {
            totalAgeVerifiedCreators++;
        } else if (wasAgeVerified && !creatorData.ageVerified) {
            totalAgeVerifiedCreators--;
        }

        bool isNowVerified = creatorData.ageVerified && creatorData.talentVerified;
        if (!wasVerified && isNowVerified) {
            totalVerifiedCreators++;
        } else if (wasVerified && !isNowVerified) {
            totalVerifiedCreators--;
        }

        emit VerificationStatusUpdated(
            creator,
            creatorData.ageVerified,
            creatorData.talentVerified,
            block.timestamp
        );
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
     * @dev Update SBT contract addresses (admin only)
     * @param _ageVerifiedSBT New age verified SBT address
     * @param _verifiedTalentSBT New verified talent SBT address
     */
    function updateSBTContracts(
        address _ageVerifiedSBT,
        address _verifiedTalentSBT
    ) external onlyRole(ADMIN_ROLE) {
        require(_ageVerifiedSBT != address(0), "Invalid age SBT address");
        require(_verifiedTalentSBT != address(0), "Invalid talent SBT address");

        ageVerifiedSBT = AgeVerifiedSBT(_ageVerifiedSBT);
        verifiedTalentSBT = VerifiedTalentSBT(_verifiedTalentSBT);
    }

    /**
     * @dev Get contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}