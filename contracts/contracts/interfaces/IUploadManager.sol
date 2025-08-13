// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUploadManager
 * @dev Interface for managing content upload pipeline orchestration
 */
interface IUploadManager {
    enum UploadStatus {
        REQUESTED,
        PROCESSING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    struct UploadRequest {
        address creator;
        string tempURI;
        uint8 storageClass;
        UploadStatus status;
        uint256 requestedAt;
        uint256 completedAt;
        uint256 contentId; // Set when finalized
    }

    event UploadRequested(
        address indexed creator,
        uint256 indexed provisionalId,
        string tempURI,
        uint8 storageClass,
        uint256 timestamp
    );

    event UploadStatusUpdated(
        uint256 indexed provisionalId,
        UploadStatus oldStatus,
        UploadStatus newStatus,
        uint256 timestamp
    );

    event UploadFinalized(
        uint256 indexed provisionalId,
        uint256 indexed contentId,
        string hlsURI,
        bytes32 perceptualHash,
        uint256 timestamp
    );

    event UploadFailed(
        uint256 indexed provisionalId,
        string reason,
        uint256 timestamp
    );

    /**
     * @dev Request content upload processing
     * @param tempURI Temporary URI where raw content is stored
     * @param storageClass Storage class (0: Shreddable, 1: Permanent)
     * @return provisionalId Unique identifier for this upload request
     */
    function requestUpload(
        string calldata tempURI,
        uint8 storageClass
    ) external returns (uint256 provisionalId);

    /**
     * @dev Update upload status (worker only)
     * @param provisionalId Upload request ID
     * @param status New status
     */
    function updateUploadStatus(uint256 provisionalId, UploadStatus status) external;

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
    ) external returns (uint256 contentId);

    /**
     * @dev Mark upload as failed (worker only)
     * @param provisionalId Upload request ID
     * @param reason Failure reason
     */
    function failUpload(uint256 provisionalId, string calldata reason) external;

    /**
     * @dev Cancel upload request (creator or admin only)
     * @param provisionalId Upload request ID
     */
    function cancelUpload(uint256 provisionalId) external;

    /**
     * @dev Get upload request information
     * @param provisionalId Upload request ID
     * @return UploadRequest struct with request information
     */
    function getUploadRequest(uint256 provisionalId) external view returns (UploadRequest memory);

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
    ) external view returns (uint256[] memory);

    /**
     * @dev Get pending upload requests (worker only)
     * @param limit Maximum number of results
     * @return uint256[] Array of provisional IDs
     */
    function getPendingUploads(uint256 limit) external view returns (uint256[] memory);

    /**
     * @dev Check if address is authorized worker
     * @param worker Address to check
     * @return bool Whether address is authorized worker
     */
    function isAuthorizedWorker(address worker) external view returns (bool);

    /**
     * @dev Add authorized worker (admin only)
     * @param worker Address to authorize
     */
    function addWorker(address worker) external;

    /**
     * @dev Remove authorized worker (admin only)
     * @param worker Address to remove
     */
    function removeWorker(address worker) external;

    /**
     * @dev Get total upload count
     * @return uint256 Total number of upload requests
     */
    function getTotalUploads() external view returns (uint256);

    /**
     * @dev Get upload statistics
     * @return requested Number of requested uploads
     * @return processing Number of processing uploads
     * @return completed Number of completed uploads
     * @return failed Number of failed uploads
     */
    function getUploadStats() external view returns (
        uint256 requested,
        uint256 processing,
        uint256 completed,
        uint256 failed
    );
}