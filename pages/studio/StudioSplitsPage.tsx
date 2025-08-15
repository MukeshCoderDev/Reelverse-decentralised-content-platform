
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import SplitEditor, { RevenueSplit } from '../../components/studio/SplitEditor';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useWallet } from '../../contexts/WalletContext';

const StudioSplitsPage: React.FC = () => {
    const { isConnected, account, isAuthenticated } = useWallet();
    const [splits, setSplits] = useState<RevenueSplit[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingSplit, setEditingSplit] = useState<RevenueSplit | undefined>();
    const [isLoading, setIsLoading] = useState(false);

    // Load existing splits when wallet connects
    useEffect(() => {
        if (isConnected && account && isAuthenticated) {
            loadSplits();
        } else {
            setSplits([]);
        }
    }, [isConnected, account, isAuthenticated]);

    const loadSplits = async () => {
        try {
            setIsLoading(true);
            // TODO: Load splits from API/blockchain
            // For now, use mock data
            const mockSplits: RevenueSplit[] = [
                {
                    id: 'split_1',
                    name: 'Video Collaboration #1',
                    description: 'Split for collaborative video with Jane',
                    recipients: [
                        {
                            id: 'creator',
                            wallet: account || '',
                            name: 'Creator (You)',
                            basisPoints: 9000,
                            isCreator: true
                        },
                        {
                            id: 'collab_1',
                            wallet: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF',
                            name: 'Jane Doe',
                            basisPoints: 1000,
                            isCreator: false
                        }
                    ],
                    totalBasisPoints: 10000,
                    contractAddress: '0x123...abc',
                    createdAt: '2024-01-15T10:00:00Z',
                    isActive: true
                }
            ];
            setSplits(mockSplits);
        } catch (error) {
            console.error('Failed to load splits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSplit = () => {
        setEditingSplit(undefined);
        setShowEditor(true);
    };

    const handleEditSplit = (split: RevenueSplit) => {
        setEditingSplit(split);
        setShowEditor(true);
    };

    const handleSaveSplit = (split: RevenueSplit) => {
        if (editingSplit) {
            // Update existing split
            setSplits(prev => prev.map(s => s.id === split.id ? split : s));
        } else {
            // Add new split
            setSplits(prev => [...prev, split]);
        }
        setShowEditor(false);
        setEditingSplit(undefined);
    };

    const handleCancelEdit = () => {
        setShowEditor(false);
        setEditingSplit(undefined);
    };

    const handleDeactivateSplit = (splitId: string) => {
        if (confirm('Are you sure you want to deactivate this split? This will stop future revenue distributions.')) {
            setSplits(prev => prev.map(s => 
                s.id === splitId ? { ...s, isActive: false } : s
            ));
        }
    };

    const formatPercentage = (basisPoints: number) => {
        return (basisPoints / 100).toFixed(1) + '%';
    };

    if (!isConnected || !account) {
        return (
            <div>
                <PageHeader id="studioSplits" title="Collabs & Splits" />
                <EmptyState 
                    icon="wallet"
                    title="Connect Your Wallet" 
                    subtitle="Connect your wallet to manage revenue splits and collaborations." 
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div>
                <PageHeader id="studioSplits" title="Collabs & Splits" />
                <EmptyState 
                    icon="shield-alert"
                    title="Authentication Required" 
                    subtitle="Please authenticate with your wallet to access split management." 
                />
            </div>
        );
    }

    if (showEditor) {
        return (
            <div>
                <PageHeader 
                    id="studioSplits" 
                    title={editingSplit ? 'Edit Revenue Split' : 'Create Revenue Split'} 
                />
                <SplitEditor
                    split={editingSplit}
                    onSave={handleSaveSplit}
                    onCancel={handleCancelEdit}
                    minCreatorShare={9000} // 90% minimum for creator
                />
            </div>
        );
    }

    return (
        <div>
            <PageHeader 
                id="studioSplits" 
                title="Collabs & Splits"
                actions={
                    <Button onClick={handleCreateSplit}>
                        <Icon name="plus" size={16} className="mr-2" />
                        Create Split
                    </Button>
                }
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Icon name="loader" size={32} className="animate-spin text-gray-400" />
                </div>
            ) : splits.length === 0 ? (
                <EmptyState 
                    icon="git-merge"
                    title="No Revenue Splits Yet" 
                    subtitle="Create your first revenue split to collaborate with other creators and automatically distribute earnings on-chain." 
                />
            ) : (
                <div className="space-y-6">
                    {/* Platform Revenue Share Notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Icon name="info" size={20} className="text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-800 mb-1">Platform Revenue Share</h4>
                                <p className="text-blue-700 text-sm">
                                    All revenue splits enforce a minimum 90% share for the content creator. 
                                    The platform takes a 10% fee, and creators can distribute their 90% among collaborators.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Splits List */}
                    <div className="grid gap-6">
                        {splits.map(split => (
                            <div key={split.id} className="bg-white border border-gray-200 rounded-lg p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-medium">{split.name}</h3>
                                            {split.isActive ? (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        {split.description && (
                                            <p className="text-gray-600 text-sm">{split.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                            <span>Created {new Date(split.createdAt).toLocaleDateString()}</span>
                                            <span>{split.recipients.length} recipients</span>
                                            {split.contractAddress && (
                                                <span className="flex items-center gap-1">
                                                    <Icon name="link" size={12} />
                                                    On-chain
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditSplit(split)}
                                        >
                                            <Icon name="edit" size={14} className="mr-1" />
                                            Edit
                                        </Button>
                                        {split.isActive && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeactivateSplit(split.id)}
                                                className="text-red-600 hover:text-red-700 hover:border-red-300"
                                            >
                                                <Icon name="pause" size={14} className="mr-1" />
                                                Deactivate
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Recipients */}
                                <div>
                                    <h4 className="font-medium mb-3">Revenue Distribution</h4>
                                    <div className="grid gap-2">
                                        {split.recipients.map(recipient => (
                                            <div key={recipient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {recipient.name || recipient.wallet}
                                                        </span>
                                                        {recipient.isCreator && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                                Creator
                                                            </span>
                                                        )}
                                                    </div>
                                                    {recipient.name && (
                                                        <p className="text-sm text-gray-600">{recipient.wallet}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-medium">
                                                        {formatPercentage(recipient.basisPoints)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudioSplitsPage;
