// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IUploadManager.sol";
import "../interfaces/IContentRegistry.sol";
import "../interfaces/ICreatorRegistry.sol";

/**
 * @title UploadManager
 * @dev Manages content upload pipeline orchestration
 * @notice Coordinates between frontend uploads and backend processing workers
 */
contract UploadManager is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IUploadManager
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE");

    // Registry contracts
    IContentRegistry public contentRegistry;
    ICreatorRegistry public creatorRegistry;

    // Upload tracking
    uint256 private _nextProvisionalId;
    mapping(uint256 => UploadRequest) private _uploadRequests;
    mapping(address => uint256[]) private _creatorUploads;
    
    // Worker management
    mapping(address => bool) private _authorizedWorkers;
    address[] private _workerList;
    
    // Statistics
    mapping(UploadStatus => uint256) private _statusCounts;
    uint256 public totalUploads;
    
    // Configuration
    uint256 public maxPendingUploads;
    uint256 public uploadTimeoutDuration;
    
    // Pending uploads queue
    uint256[] private _pendingQueue;
    mapping(uint256 => uint256) private _queueIndex; // provisionalId => index in queue

    event WorkerAdded(address indexed worker, uint256 timestamp);
    event WorkerRemoved(address indexed worker, uint256 timestamp);
    event UploadTimeout(uint256 indexed provisionalId, uint256 timestamp);
    event ConfigurationUpdated(
        uint256 maxPendingUploads,
        uint256 uploadTimeoutDuration,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param _contentRegistry Address of the ContentRegistry contract
     * @param _creatorRegistry Address of the CreatorRegistry contract
     */
    function initialize(
        address _contentRegistry,
        address _creatorRegistry
    ) public initializer {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_creatorRegistry != address(0), "Invalid creator registry");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        contentRegistry = IContentRegistry(_contentRegistry);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(WORKER_ROLE, msg.sender);

        _nextProvisionalId = 1;
        maxPendingUploads = 100; // Default limit
        uploadTimeoutDuration = 24 hours; // Default timeout
    }

    /**
     * @dev Request content upload processing
     * @param tempURI Temporary URI where raw content is stored
     * @param storageClass Storage class (0: Shreddable, 1: Permanent)
     * @return provisionalId Unique identifier for this upload request
     */
    function requestUpload(
        string calldata tempURI,
        uint8 storageClass
    ) external override whenNotPaused nonReentrant returns (uint256 provisionalId) {
        require(bytes(tempURI).length > 0, "Temp URI cannot be empty");
        require(storageClass <= 1, "Invalid storage class");
        require(creatorRegistry.isRegistered(msg.sender), "Creator not registered");
        require(_statusCounts[UploadStatus.REQUESTED] < maxPendingUploads, "Too many pending uploads");

        provisionalId = _nextProvisionalId++;

        _uploadRequests[provisionalId] = UploadRequest({
            creator: msg.sender,
            tempURI: tempURI,
            storageClass: storageClass,
            status: UploadStatus.REQUESTED,
            requestedAt: block.timestamp,
            completedAt: 0,
            contentId: 0
        });

        _creatorUploads[msg.sender].push(provisionalId);
        _statusCounts[UploadStatus.REQUESTED]++;
        totalUploads++;

        // Add to pending queue
        _addToPendingQueue(provisionalId);

        emit UploadRequested(
            msg.sender,
            provisionalId,
            tempURI,
            storageClass,
            block.timestamp
        );

        return provisionalId;
    }

    /**
     * @dev Update upload status (worker only)
     * @param provisionalId Upload request ID
     * @param status New status
     */
    function updateUploadStatus(
        uint256 provisionalId,
        UploadStatus status
    ) external override onlyRole(WORKER_ROLE) {
        require(_uploadExists(provisionalId), "Upload request does not exist");
        require(status != UploadStatus.COMPLETED, "Use finalizeUpload for completion");

        UploadRequest storage request = _uploadRequests[provisionalId];
        UploadStatus oldStatus = request.status;
        
        require(oldStatus != UploadStatus.COMPLETED, "Upload already completed");
        require(oldStatus != UploadStatus.CANCELLED, "Upload cancelled");

        // Update status counts
        _statusCounts[oldStatus]--;
        _statusCounts[status]++;

        request.status = status;

        // Remove from pending queue if moving to processing
        if (oldStatus == UploadStatus.REQUESTED && status == UploadStatus.PROCESSING) {
            _removeFromPendingQueue(provisionalId);
        }

        emit UploadStatusUpdated(provisionalId, oldStatus, status, block.timestamp);
    }

    /**
     * @dev Finalize upload and register content (worker only)
     * @param provisionalId Upload request ID
     * @param hlsURI Final HLS stream URI
     * @param perceptualHash Content perceptual hash
     * @return contentId ID of the registered content
     */
    function finalizeUpload(
        uint256 provisionalId,
        string calldata hlsURI,
        bytes32 perceptualHash
    ) external override onlyRole(WORKER_ROLE) nonReentrant returns (uint256 contentId) {
        require(_uploadExists(provisionalId), "Upload request does not exist");
        require(bytes(hlsURI).length > 0, "HLS URI cannot be empty");
        require(perceptualHash != bytes32(0), "Perceptual hash cannot be empty");

        UploadRequest storage request = _uploadRequests[provisionalId];
        require(request.status == UploadStatus.PROCESSING, "Upload not in processing state");

        // Register content in ContentRegistry
        // Note: This assumes the worker has the necessary roles in ContentRegistry
        contentId = contentRegistry.registerContent(
            hlsURI, // Using HLS URI as metadata URI for now
            perceptualHash,
            0, // Price will be set later by creator
            request.storageClass,
            request.creator, // Use creator as temporary splitter
            0xFFFFFFFF // Global availability by default
        );

        // Update request
        UploadStatus oldStatus = request.status;
        request.status = UploadStatus.COMPLETED;
        request.completedAt = block.timestamp;
        request.contentId = contentId;

        // Update statistics
        _statusCounts[oldStatus]--;
        _statusCounts[UploadStatus.COMPLETED]++;

        emit UploadFinalized(
            provisionalId,
            contentId,
            hlsURI,
            perceptualHash,
            block.timestamp
        );

        return contentId;
    }

    /**
     * @dev Mark upload as failed (worker only)
     * @param provisionalId Upload request ID
     * @param reason Failure reason
     */
    function failUpload(
        uint256 provisionalId,
        string calldata reason
    ) external override onlyRole(WORKER_ROLE) {
        require(_uploadExists(provisionalId), "Upload request does not exist");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        UploadRequest storage request = _uploadRequests[provisionalId];
        UploadStatus oldStatus = request.status;
        
        require(oldStatus != UploadStatus.COMPLETED, "Upload already completed");
        require(oldStatus != UploadStatus.CANCELLED, "Upload cancelled");

        // Update status
        request.status = UploadStatus.FAILED;
        request.completedAt = block.timestamp;

        // Update statistics
        _statusCounts[oldStatus]--;
        _statusCounts[UploadStatus.FAILED]++;

        // Remove from pending queue if it was there
        if (oldStatus == UploadStatus.REQUESTED) {
            _removeFromPendingQueue(provisionalId);
        }

        emit UploadFailed(provisionalId, reason, block.timestamp);
        emit UploadStatusUpdated(provisionalId, oldStatus, UploadStatus.FAILED, block.timestamp);
    }

    /**
     * @dev Cancel upload request (creator or admin only)
     * @param provisionalId Upload request ID
     */
    function cancelUpload(uint256 provisionalId) external override {
        require(_uploadExists(provisionalId), "Upload request does not exist");

        UploadRequest storage request = _uploadRequests[provisionalId];
        
        // Only creator or admin can cancel
        require(
            msg.sender == request.creator || hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized to cancel upload"
        );

        UploadStatus oldStatus = request.status;
        require(oldStatus != UploadStatus.COMPLETED, "Cannot cancel completed upload");
        require(oldStatus != UploadStatus.CANCELLED, "Upload already cancelled");

        // Update status
        request.status = UploadStatus.CANCELLED;
        request.completedAt = block.timestamp;

        // Update statistics
        _statusCounts[oldStatus]--;
        // Note: CANCELLED is not tracked in status counts

        // Remove from pending queue if it was there
        if (oldStatus == UploadStatus.REQUESTED) {
            _removeFromPendingQueue(provisionalId);
        }

        emit UploadStatusUpdated(provisionalId, oldStatus, UploadStatus.CANCELLED, block.timestamp);
    }

    /**
     * @dev Get upload request information
     * @param provisionalId Upload request ID
     * @return UploadRequest struct with request information
     */
    function getUploadRequest(uint256 provisionalId) external view override returns (UploadRequest memory) {
        require(_uploadExists(provisionalId), "Upload request does not exist");
        return _uploadRequests[provisionalId];
    }

    /**
     * @dev Get upload requests by creator
     * @param creator Address of the creator
     * @param offset Pagination offset
     * @param limit Maximum number of results
     * @return uint256[] Array of provisional IDs
     */
    function getCreatorUploads(
        address creator,
        uint256 offset,
        uint256 limit
    ) external view override returns (uint256[] memory) {
        uint256[] storage creatorUploads = _creatorUploads[creator];
        uint256 total = creatorUploads.length;
        
        if (offset >= total) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = creatorUploads[i];
        }
        
        return result;
    }

    /**
     * @dev Get pending upload requests (worker only)
     * @param limit Maximum number of results
     * @return uint256[] Array of provisional IDs
     */
    function getPendingUploads(uint256 limit) external view override onlyRole(WORKER_ROLE) returns (uint256[] memory) {
        uint256 total = _pendingQueue.length;
        
        if (total == 0) {
            return new uint256[](0);
        }
        
        uint256 resultLength = limit > total ? total : limit;
        uint256[] memory result = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = _pendingQueue[i];
        }
        
        return result;
    }

    /**
     * @dev Check if address is authorized worker
     * @param worker Address to check
     * @return bool Whether address is authorized worker
     */
    function isAuthorizedWorker(address worker) external view override returns (bool) {
        return hasRole(WORKER_ROLE, worker);
    }

    /**
     * @dev Add authorized worker (admin only)
     * @param worker Address to authorize
     */
    function addWorker(address worker) external override onlyRole(ADMIN_ROLE) {
        require(worker != address(0), "Invalid worker address");
        require(!hasRole(WORKER_ROLE, worker), "Worker already authorized");

        _grantRole(WORKER_ROLE, worker);
        _authorizedWorkers[worker] = true;
        _workerList.push(worker);

        emit WorkerAdded(worker, block.timestamp);
    }

    /**
     * @dev Remove authorized worker (admin only)
     * @param worker Address to remove
     */
    function removeWorker(address worker) external override onlyRole(ADMIN_ROLE) {
        require(hasRole(WORKER_ROLE, worker), "Worker not authorized");

        _revokeRole(WORKER_ROLE, worker);
        _authorizedWorkers[worker] = false;

        // Remove from worker list
        for (uint256 i = 0; i < _workerList.length; i++) {
            if (_workerList[i] == worker) {
                _workerList[i] = _workerList[_workerList.length - 1];
                _workerList.pop();
                break;
            }
        }

        emit WorkerRemoved(worker, block.timestamp);
    }

    /**
     * @dev Get list of authorized workers
     * @return address[] Array of worker addresses
     */
    function getAuthorizedWorkers() external view returns (address[] memory) {
        return _workerList;
    }

    /**
     * @dev Get total upload count
     * @return uint256 Total number of upload requests
     */
    function getTotalUploads() external view override returns (uint256) {
        return totalUploads;
    }

    /**
     * @dev Get upload statistics
     * @return requested Number of requested uploads
     * @return processing Number of processing uploads
     * @return completed Number of completed uploads
     * @return failed Number of failed uploads
     */
    function getUploadStats() external view override returns (
        uint256 requested,
        uint256 processing,
        uint256 completed,
        uint256 failed
    ) {
        return (
            _statusCounts[UploadStatus.REQUESTED],
            _statusCounts[UploadStatus.PROCESSING],
            _statusCounts[UploadStatus.COMPLETED],
            _statusCounts[UploadStatus.FAILED]
        );
    }

    /**
     * @dev Clean up timed out uploads (admin or worker only)
     * @param limit Maximum number of uploads to check
     * @return uint256 Number of uploads timed out
     */
    function cleanupTimedOutUploads(uint256 limit) external returns (uint256) {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(WORKER_ROLE, msg.sender),
            "Unauthorized"
        );

        // Prevent underflow if uploadTimeoutDuration is greater than current timestamp
        uint256 timeoutThreshold = block.timestamp > uploadTimeoutDuration 
            ? block.timestamp - uploadTimeoutDuration 
            : 0;
        uint256 cleanedUp = 0;
        uint256 checked = 0;

        // Collect timed out uploads first to avoid array manipulation during iteration
        uint256[] memory timedOutUploads = new uint256[](limit);
        uint256 timedOutCount = 0;
        
        // Check pending uploads for timeouts
        for (uint256 i = 0; i < _pendingQueue.length && checked < limit && timedOutCount < limit; i++) {
            uint256 provisionalId = _pendingQueue[i];
            UploadRequest storage request = _uploadRequests[provisionalId];

            if (request.requestedAt < timeoutThreshold) {
                timedOutUploads[timedOutCount] = provisionalId;
                timedOutCount++;
            }
            checked++;
        }
        
        // Process timed out uploads
        for (uint256 i = 0; i < timedOutCount; i++) {
            uint256 provisionalId = timedOutUploads[i];
            UploadRequest storage request = _uploadRequests[provisionalId];
            
            UploadStatus oldStatus = request.status;
            request.status = UploadStatus.FAILED;
            request.completedAt = block.timestamp;

            _statusCounts[oldStatus]--;
            _statusCounts[UploadStatus.FAILED]++;

            _removeFromPendingQueue(provisionalId);

            emit UploadTimeout(provisionalId, block.timestamp);
            emit UploadFailed(provisionalId, "Upload timeout", block.timestamp);

            cleanedUp++;
        }

        return cleanedUp;
    }

    /**
     * @dev Update configuration (admin only)
     * @param _maxPendingUploads New maximum pending uploads
     * @param _uploadTimeoutDuration New upload timeout duration
     */
    function updateConfiguration(
        uint256 _maxPendingUploads,
        uint256 _uploadTimeoutDuration
    ) external onlyRole(ADMIN_ROLE) {
        require(_maxPendingUploads > 0, "Max pending uploads must be greater than 0");
        require(_uploadTimeoutDuration > 0, "Timeout duration must be greater than 0");
        require(_uploadTimeoutDuration <= 7 days, "Timeout duration too long");

        maxPendingUploads = _maxPendingUploads;
        uploadTimeoutDuration = _uploadTimeoutDuration;

        emit ConfigurationUpdated(
            _maxPendingUploads,
            _uploadTimeoutDuration,
            block.timestamp
        );
    }

    /**
     * @dev Get pending queue length
     * @return uint256 Number of uploads in pending queue
     */
    function getPendingQueueLength() external view returns (uint256) {
        return _pendingQueue.length;
    }

    /**
     * @dev Update registry addresses (admin only)
     * @param _contentRegistry New content registry address
     * @param _creatorRegistry New creator registry address
     */
    function updateRegistries(
        address _contentRegistry,
        address _creatorRegistry
    ) external onlyRole(ADMIN_ROLE) {
        require(_contentRegistry != address(0), "Invalid content registry");
        require(_creatorRegistry != address(0), "Invalid creator registry");

        contentRegistry = IContentRegistry(_contentRegistry);
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
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

    // Internal functions

    /**
     * @dev Check if upload request exists
     * @param provisionalId Upload request ID
     * @return bool Whether upload exists
     */
    function _uploadExists(uint256 provisionalId) internal view returns (bool) {
        return provisionalId > 0 && provisionalId < _nextProvisionalId && 
               _uploadRequests[provisionalId].creator != address(0);
    }

    /**
     * @dev Add upload to pending queue
     * @param provisionalId Upload request ID
     */
    function _addToPendingQueue(uint256 provisionalId) internal {
        _pendingQueue.push(provisionalId);
        _queueIndex[provisionalId] = _pendingQueue.length - 1;
    }

    /**
     * @dev Remove upload from pending queue
     * @param provisionalId Upload request ID
     */
    function _removeFromPendingQueue(uint256 provisionalId) internal {
        uint256 index = _queueIndex[provisionalId];
        uint256 lastIndex = _pendingQueue.length - 1;

        if (index != lastIndex) {
            uint256 lastProvisionalId = _pendingQueue[lastIndex];
            _pendingQueue[index] = lastProvisionalId;
            _queueIndex[lastProvisionalId] = index;
        }

        _pendingQueue.pop();
        delete _queueIndex[provisionalId];
    }

    /**
     * @dev Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}

    /**
     * @dev Override supportsInterface to include all interfaces
     * @param interfaceId Interface ID
     * @return bool Whether interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}