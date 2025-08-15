
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useWallet } from '../../contexts/WalletContext';
import { AgeVerificationService, AgeVerificationStatus } from '../../services/ageVerificationService';

interface TalentVerificationStatus {
  status: 'none' | 'pending' | 'verified' | 'failed';
  submittedAt?: string;
  verifiedAt?: string;
  failureReason?: string;
  sbTokenId?: string;
}

const StudioVerifyPage: React.FC = () => {
    const { isConnected, account, isAuthenticated } = useWallet();
    const [ageStatus, setAgeStatus] = useState<AgeVerificationStatus | null>(null);
    const [talentStatus, setTalentStatus] = useState<TalentVerificationStatus>({ status: 'none' });
    const [isLoadingAge, setIsLoadingAge] = useState(false);
    const [isLoadingTalent, setIsLoadingTalent] = useState(false);
    const [isStartingVerification, setIsStartingVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ageVerificationService = AgeVerificationService.getInstance();

    // Load verification statuses when wallet connects
    useEffect(() => {
        if (isConnected && account && isAuthenticated) {
            loadVerificationStatuses();
        } else {
            setAgeStatus(null);
            setTalentStatus({ status: 'none' });
        }
    }, [isConnected, account, isAuthenticated]);

    const loadVerificationStatuses = async () => {
        if (!account) return;

        try {
            setError(null);
            
            // Load age verification status
            setIsLoadingAge(true);
            const ageResult = await ageVerificationService.getVerificationStatus(account);
            setAgeStatus(ageResult);

            // Load talent verification status (mock for now - will be implemented with backend)
            setIsLoadingTalent(true);
            // TODO: Replace with actual talent verification service call
            const mockTalentStatus: TalentVerificationStatus = { status: 'none' };
            setTalentStatus(mockTalentStatus);

        } catch (error) {
            console.error('Failed to load verification statuses:', error);
            setError('Failed to load verification status. Please try again.');
        } finally {
            setIsLoadingAge(false);
            setIsLoadingTalent(false);
        }
    };

    const handleStartAgeVerification = async () => {
        if (!account) return;

        try {
            setIsStartingVerification(true);
            setError(null);

            const result = await ageVerificationService.completeVerification(
                account,
                (status) => {
                    setAgeStatus(status);
                }
            );

            setAgeStatus(result);
            
            if (result.status === 'verified') {
                // Reload to get updated status
                setTimeout(() => loadVerificationStatuses(), 1000);
            }
        } catch (error: any) {
            console.error('Age verification failed:', error);
            setError(error.message || 'Age verification failed. Please try again.');
        } finally {
            setIsStartingVerification(false);
        }
    };

    const handleStartTalentVerification = async () => {
        if (!account || !ageStatus || ageStatus.status !== 'verified') return;

        try {
            setIsStartingVerification(true);
            setError(null);

            // TODO: Implement talent verification flow
            // This would integrate with KYC provider for identity verification
            // For now, show a placeholder
            alert('Talent verification will redirect to KYC provider. This feature is coming soon!');
            
        } catch (error: any) {
            console.error('Talent verification failed:', error);
            setError(error.message || 'Talent verification failed. Please try again.');
        } finally {
            setIsStartingVerification(false);
        }
    };

    const getStatusBadge = (status: string, isLoading: boolean) => {
        if (isLoading) {
            return (
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                    <Icon name="loader" size={16} className="animate-spin" />
                    <span>Loading...</span>
                </div>
            );
        }

        switch (status) {
            case 'verified':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <Icon name="shield-check" size={16} />
                        <span>Verified</span>
                    </div>
                );
            case 'pending':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        <Icon name="clock" size={16} />
                        <span>Pending</span>
                    </div>
                );
            case 'failed':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        <Icon name="shield-alert" size={16} />
                        <span>Failed</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                        <Icon name="shield" size={16} />
                        <span>Not Started</span>
                    </div>
                );
        }
    };

    if (!isConnected || !account) {
        return (
            <div>
                <PageHeader id="studioVerify" title="Creator Verification" />
                <EmptyState 
                    icon="wallet"
                    title="Connect Your Wallet" 
                    subtitle="Connect your wallet to manage your creator verification status." 
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div>
                <PageHeader id="studioVerify" title="Creator Verification" />
                <EmptyState 
                    icon="shield-alert"
                    title="Authentication Required" 
                    subtitle="Please authenticate with your wallet to access verification features." 
                />
            </div>
        );
    }

    return (
        <div>
            <PageHeader id="studioVerify" title="Creator Verification" />
            
            <div className="space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-700">
                            <Icon name="alert-circle" size={20} />
                            <span className="font-medium">Error</span>
                        </div>
                        <p className="text-red-600 mt-1">{error}</p>
                    </div>
                )}

                {/* Age Verification Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Icon name="shield-check" size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Age Verification</h3>
                                <p className="text-sm text-gray-600">Required for all creators on the platform</p>
                            </div>
                        </div>
                        {getStatusBadge(ageStatus?.status || 'none', isLoadingAge)}
                    </div>

                    <div className="space-y-3">
                        <p className="text-gray-700">
                            Age verification is required to create and publish content on our platform. 
                            This is a one-time process that helps us comply with legal requirements.
                        </p>
                        
                        {ageStatus?.status === 'verified' ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-green-700 mb-2">
                                    <Icon name="check-circle" size={20} />
                                    <span className="font-medium">Age Verification Complete</span>
                                </div>
                                <p className="text-green-600 text-sm">
                                    Verified on {ageStatus.verifiedAt ? new Date(ageStatus.verifiedAt).toLocaleDateString() : 'Unknown date'}
                                </p>
                                {ageStatus.sbTokenId && (
                                    <p className="text-green-600 text-sm">
                                        SBT Token ID: {ageStatus.sbTokenId}
                                    </p>
                                )}
                            </div>
                        ) : ageStatus?.status === 'failed' ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-700 mb-2">
                                    <Icon name="x-circle" size={20} />
                                    <span className="font-medium">Age Verification Failed</span>
                                </div>
                                <p className="text-red-600 text-sm">
                                    {ageStatus.failureReason || 'Verification could not be completed. Please try again.'}
                                </p>
                            </div>
                        ) : ageStatus?.status === 'pending' ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                                    <Icon name="clock" size={20} />
                                    <span className="font-medium">Age Verification In Progress</span>
                                </div>
                                <p className="text-yellow-600 text-sm">
                                    Your verification is being processed. This usually takes a few minutes.
                                </p>
                            </div>
                        ) : (
                            <Button 
                                onClick={handleStartAgeVerification}
                                disabled={isStartingVerification}
                                className="w-full sm:w-auto"
                            >
                                {isStartingVerification ? (
                                    <>
                                        <Icon name="loader" size={16} className="animate-spin mr-2" />
                                        Starting Verification...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="shield-check" size={16} className="mr-2" />
                                        Start Age Verification
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Talent Verification Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Icon name="star" size={24} className="text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Talent Verification</h3>
                                <p className="text-sm text-gray-600">Optional identity verification for verified creator badge</p>
                            </div>
                        </div>
                        {getStatusBadge(talentStatus.status, isLoadingTalent)}
                    </div>

                    <div className="space-y-3">
                        <p className="text-gray-700">
                            Talent verification provides an additional layer of trust and authenticity. 
                            Verified creators receive a special badge and may access premium features.
                        </p>

                        {!ageStatus || ageStatus.status !== 'verified' ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-gray-600 mb-2">
                                    <Icon name="info" size={20} />
                                    <span className="font-medium">Age Verification Required</span>
                                </div>
                                <p className="text-gray-600 text-sm">
                                    Complete age verification first to unlock talent verification.
                                </p>
                            </div>
                        ) : talentStatus.status === 'verified' ? (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-purple-700 mb-2">
                                    <Icon name="check-circle" size={20} />
                                    <span className="font-medium">Talent Verification Complete</span>
                                </div>
                                <p className="text-purple-600 text-sm">
                                    Verified on {talentStatus.verifiedAt ? new Date(talentStatus.verifiedAt).toLocaleDateString() : 'Unknown date'}
                                </p>
                                {talentStatus.sbTokenId && (
                                    <p className="text-purple-600 text-sm">
                                        SBT Token ID: {talentStatus.sbTokenId}
                                    </p>
                                )}
                            </div>
                        ) : talentStatus.status === 'failed' ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-700 mb-2">
                                    <Icon name="x-circle" size={20} />
                                    <span className="font-medium">Talent Verification Failed</span>
                                </div>
                                <p className="text-red-600 text-sm">
                                    {talentStatus.failureReason || 'Verification could not be completed. Please try again.'}
                                </p>
                            </div>
                        ) : talentStatus.status === 'pending' ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                                    <Icon name="clock" size={20} />
                                    <span className="font-medium">Talent Verification In Progress</span>
                                </div>
                                <p className="text-yellow-600 text-sm">
                                    Your verification is being processed. This may take 1-3 business days.
                                </p>
                            </div>
                        ) : (
                            <Button 
                                onClick={handleStartTalentVerification}
                                disabled={isStartingVerification}
                                variant="outline"
                                className="w-full sm:w-auto"
                            >
                                {isStartingVerification ? (
                                    <>
                                        <Icon name="loader" size={16} className="animate-spin mr-2" />
                                        Starting Verification...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="star" size={16} className="mr-2" />
                                        Start Talent Verification
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Benefits Section */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Verification Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-blue-100 rounded">
                                <Icon name="shield-check" size={16} className="text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">Age Verification</h4>
                                <p className="text-sm text-gray-600">Required to publish content and access platform features</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-purple-100 rounded">
                                <Icon name="star" size={16} className="text-purple-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">Talent Verification</h4>
                                <p className="text-sm text-gray-600">Verified badge, priority support, and premium features</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-green-100 rounded">
                                <Icon name="users" size={16} className="text-green-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">Trust & Safety</h4>
                                <p className="text-sm text-gray-600">Build trust with your audience through verified identity</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-yellow-100 rounded">
                                <Icon name="trending-up" size={16} className="text-yellow-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">Enhanced Visibility</h4>
                                <p className="text-sm text-gray-600">Verified creators get better discoverability</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudioVerifyPage;
