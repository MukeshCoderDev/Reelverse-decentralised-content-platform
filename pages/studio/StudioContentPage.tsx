
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { ContentTable, ContentRow } from '../../components/studio/ContentTable';
import { EmptyState } from '../../components/shared/EmptyState';
import UploadWizard from '../../components/studio/UploadWizard';
import BulkUploadWizard from '../../components/studio/BulkUploadWizard';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useWallet } from '../../contexts/WalletContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { AgeVerificationService, AgeVerificationStatus } from '../../services/ageVerificationService';

const StudioContentPage: React.FC = () => {
    const navigate = useNavigate();
    const { isConnected, account, isAuthenticated } = useWallet();
    const { currentOrganization, canUploadContent } = useOrganization();
    const [ageStatus, setAgeStatus] = useState<AgeVerificationStatus | null>(null);
    const [isLoadingVerification, setIsLoadingVerification] = useState(false);
    const [showVerificationWarning, setShowVerificationWarning] = useState(false);
    const [showUploadWizard, setShowUploadWizard] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [contentRows, setContentRows] = useState<ContentRow[]>([]);

    // Mock feature flag for requiring verified talent for publishing
    const requireVerifiedTalentForPublish = false; // This would come from feature flags service

    // Initialize with mock data - in real app this would come from API
    useEffect(() => {
        const mockRows: ContentRow[] = [
            { 
                id: "1", 
                title: "How to build on Lens", 
                status: "READY", 
                views: 12345,
                storageClass: 'shreddable',
                encrypted: true,
                watermarked: true,
                blockchainId: '0x123...abc',
                earnings: 245.67,
                createdAt: '2024-01-15',
                consentStatus: 'completed',
                participantCount: 2
            },
            { 
                id: "2", 
                title: "Web3 Storage Deep Dive", 
                status: "PAID", 
                views: 6789,
                storageClass: 'permanent',
                encrypted: true,
                watermarked: true,
                blockchainId: '0x456...def',
                earnings: 89.23,
                createdAt: '2024-01-14',
                consentStatus: 'none'
            },
            { 
                id: "3", 
                title: "My first Reelverse Reel!", 
                status: "PROCESSING", 
                views: 102,
                storageClass: 'shreddable',
                encrypted: false,
                watermarked: false,
                earnings: 0,
                createdAt: '2024-01-16',
                consentStatus: 'pending',
                participantCount: 1
            }
        ];
        setContentRows(mockRows);
    }, []);

    // Load verification status when wallet connects
    useEffect(() => {
        if (isConnected && account && isAuthenticated) {
            loadVerificationStatus();
        } else {
            setAgeStatus(null);
        }
    }, [isConnected, account, isAuthenticated]);

    const loadVerificationStatus = async () => {
        if (!account) return;

        try {
            setIsLoadingVerification(true);
            const ageVerificationService = AgeVerificationService.getInstance();
            const status = await ageVerificationService.getVerificationStatus(account);
            setAgeStatus(status);
        } catch (error) {
            console.error('Failed to load verification status:', error);
            setAgeStatus(null);
        } finally {
            setIsLoadingVerification(false);
        }
    };

    const handleUploadClick = () => {
        // Check verification requirements
        if (!ageStatus || ageStatus.status !== 'verified') {
            setShowVerificationWarning(true);
            return;
        }

        // TODO: If requireVerifiedTalentForPublish is enabled, also check talent verification
        if (requireVerifiedTalentForPublish) {
            // This would check talent verification status
            // For now, we'll skip this check since talent verification is not fully implemented
        }

        // Show upload wizard
        setShowUploadWizard(true);
    };

    const handleUploadComplete = (contentId: string) => {
        // Add new content to the list with processing status
        const newContent: ContentRow = {
            id: contentId,
            title: 'New Upload',
            status: 'PROCESSING',
            views: 0,
            storageClass: 'shreddable',
            encrypted: true,
            watermarked: true,
            earnings: 0,
            createdAt: new Date().toISOString().split('T')[0]
        };

        setContentRows(prev => [newContent, ...prev]);
        setShowUploadWizard(false);

        // Simulate processing completion after 5 seconds
        setTimeout(() => {
            setContentRows(prev => prev.map(row => 
                row.id === contentId 
                    ? { ...row, status: 'READY' as const, blockchainId: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 3)}` }
                    : row
            ));
        }, 5000);
    };

    const handleUploadCancel = () => {
        setShowUploadWizard(false);
    };

    const handleBulkUploadComplete = (contentIds: string[]) => {
        // Add new content items to the list
        const newContent: ContentRow[] = contentIds.map((id, index) => ({
            id,
            title: `Bulk Upload ${index + 1}`,
            status: 'PROCESSING' as const,
            views: 0,
            storageClass: 'shreddable',
            encrypted: true,
            watermarked: true,
            earnings: 0,
            createdAt: new Date().toISOString().split('T')[0]
        }));

        setContentRows(prev => [...newContent, ...prev]);
        setShowBulkUpload(false);

        // Simulate processing completion
        setTimeout(() => {
            setContentRows(prev => prev.map(row => 
                contentIds.includes(row.id)
                    ? { ...row, status: 'READY' as const, blockchainId: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 3)}` }
                    : row
            ));
        }, 10000);
    };

    const handleBulkUploadCancel = () => {
        setShowBulkUpload(false);
    };

    const handleEditContent = (id: string) => {
        // TODO: Implement content editing
        alert(`Edit content ${id} - This feature will be implemented later`);
    };

    const handleDeleteContent = (id: string) => {
        if (confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
            setContentRows(prev => prev.filter(row => row.id !== id));
        }
    };

    const handleViewBlockchain = (blockchainId: string) => {
        // TODO: Open blockchain explorer or show blockchain details
        alert(`View blockchain details for ${blockchainId}`);
    };

    const handleGoToVerification = () => {
        navigate('/studio/verify');
    };

    if (!isConnected || !account) {
        return (
            <div>
                <PageHeader id="studioContent" title="Content Manager" />
                <EmptyState 
                    icon="wallet"
                    title="Connect Your Wallet" 
                    subtitle="Connect your wallet to manage your content." 
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div>
                <PageHeader id="studioContent" title="Content Manager" />
                <EmptyState 
                    icon="shield-alert"
                    title="Authentication Required" 
                    subtitle="Please authenticate with your wallet to access content management." 
                />
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                id="studioContent"
                title="Content Manager"
                actions={
                    <div className="flex gap-2">
                        <Button 
                            onClick={handleUploadClick}
                            disabled={isLoadingVerification}
                        >
                            {isLoadingVerification ? (
                                <>
                                    <Icon name="loader" size={16} className="animate-spin mr-2" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Icon name="upload" size={16} className="mr-2" />
                                    Upload
                                </>
                            )}
                        </Button>
                        
                        {currentOrganization && currentOrganization.type !== 'individual' && canUploadContent() && (
                            <Button 
                                variant="outline"
                                onClick={() => setShowBulkUpload(true)}
                                disabled={isLoadingVerification}
                            >
                                <Icon name="folder-up" size={16} className="mr-2" />
                                Bulk Upload
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Verification Warning Modal */}
            {showVerificationWarning && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Icon name="shield-alert" size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Verification Required</h3>
                                <p className="text-sm text-gray-600">Age verification is required to upload content</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                            <p className="text-gray-700">
                                To upload and publish content on our platform, you must complete age verification. 
                                This is a one-time process that helps us comply with legal requirements.
                            </p>
                            
                            {ageStatus?.status === 'pending' && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-yellow-700 text-sm">
                                        Your age verification is currently being processed. Please wait for completion.
                                    </p>
                                </div>
                            )}
                            
                            {ageStatus?.status === 'failed' && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-red-700 text-sm">
                                        Your age verification failed. Please try the verification process again.
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-3">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowVerificationWarning(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleGoToVerification}
                                className="flex-1"
                            >
                                <Icon name="shield-check" size={16} className="mr-2" />
                                Verify Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Status Banner */}
            {ageStatus && ageStatus.status !== 'verified' && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="shield-alert" size={20} className="text-yellow-600" />
                            <div>
                                <h4 className="font-medium text-yellow-800">
                                    {ageStatus.status === 'pending' ? 'Age Verification Pending' : 'Age Verification Required'}
                                </h4>
                                <p className="text-sm text-yellow-700">
                                    {ageStatus.status === 'pending' 
                                        ? 'Your verification is being processed. You cannot upload content until verification is complete.'
                                        : 'Complete age verification to start uploading content to the platform.'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleGoToVerification}
                        >
                            {ageStatus.status === 'pending' ? 'Check Status' : 'Verify Now'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Talent Verification Requirement Banner (when feature flag is enabled) */}
            {requireVerifiedTalentForPublish && ageStatus?.status === 'verified' && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="star" size={20} className="text-purple-600" />
                            <div>
                                <h4 className="font-medium text-purple-800">Talent Verification Required</h4>
                                <p className="text-sm text-purple-700">
                                    This platform requires talent verification for content publishing. Complete your identity verification to continue.
                                </p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleGoToVerification}
                        >
                            Verify Identity
                        </Button>
                    </div>
                </div>
            )}

            {/* Upload Wizard Modal */}
            {showUploadWizard && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Upload Content</h2>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleUploadCancel}
                                >
                                    <Icon name="x" size={20} />
                                </Button>
                            </div>
                            <UploadWizard 
                                onComplete={handleUploadComplete}
                                onCancel={handleUploadCancel}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Wizard Modal */}
            {showBulkUpload && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Bulk Upload</h2>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleBulkUploadCancel}
                                >
                                    <Icon name="x" size={20} />
                                </Button>
                            </div>
                            <BulkUploadWizard 
                                onComplete={handleBulkUploadComplete}
                                onCancel={handleBulkUploadCancel}
                            />
                        </div>
                    </div>
                </div>
            )}

            <ContentTable 
                rows={contentRows}
                onEdit={handleEditContent}
                onDelete={handleDeleteContent}
                onViewBlockchain={handleViewBlockchain}
            />
        </div>
    );
};

export default StudioContentPage;
