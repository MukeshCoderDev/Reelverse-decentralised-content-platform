
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useWallet } from '../../contexts/WalletContext';

interface ModerationItem {
  id: string;
  type: 'content_report' | 'dmca_claim' | 'comment_report' | 'user_report';
  contentId?: string;
  contentTitle?: string;
  reportedBy: string;
  reportedAt: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  resolvedAt?: string;
  resolution?: string;
  blockchainTxHash?: string;
  perceptualHashMatch?: boolean;
  evidenceUrls?: string[];
}

interface DMCAMatch {
  id: string;
  contentId: string;
  contentTitle: string;
  originalHash: string;
  matchedHash: string;
  similarity: number;
  claimantInfo: {
    name: string;
    email: string;
    organization?: string;
  };
  submittedAt: string;
  status: 'pending' | 'verified' | 'disputed' | 'resolved';
}

interface AuditLogEntry {
  id: string;
  action: 'content_flagged' | 'content_approved' | 'content_removed' | 'dmca_processed' | 'user_banned';
  moderator: string;
  targetId: string;
  targetType: 'content' | 'user' | 'comment';
  reason: string;
  timestamp: string;
  blockchainTxHash?: string;
  reversible: boolean;
}

const StudioModerationPage: React.FC = () => {
    const { isConnected, account, isAuthenticated } = useWallet();
    const [activeTab, setActiveTab] = useState<'queue' | 'dmca' | 'audit'>('queue');
    const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);
    const [dmcaMatches, setDmcaMatches] = useState<DMCAMatch[]>([]);
    const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [decision, setDecision] = useState<'approve' | 'reject' | 'escalate'>('approve');
    const [decisionReason, setDecisionReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Load moderation data when wallet connects
    useEffect(() => {
        if (isConnected && account && isAuthenticated) {
            loadModerationData();
        } else {
            setModerationQueue([]);
            setDmcaMatches([]);
            setAuditLog([]);
        }
    }, [isConnected, account, isAuthenticated]);

    const loadModerationData = async () => {
        try {
            setIsLoading(true);
            
            // TODO: Load from API
            // Mock data for demonstration
            const mockQueue: ModerationItem[] = [
                {
                    id: 'mod_1',
                    type: 'content_report',
                    contentId: 'content_123',
                    contentTitle: 'Reported Video Title',
                    reportedBy: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF',
                    reportedAt: '2024-01-16T10:30:00Z',
                    reason: 'inappropriate_content',
                    description: 'Content violates community guidelines',
                    status: 'pending',
                    priority: 'medium',
                    evidenceUrls: ['https://example.com/evidence1.jpg']
                },
                {
                    id: 'mod_2',
                    type: 'dmca_claim',
                    contentId: 'content_456',
                    contentTitle: 'DMCA Claimed Video',
                    reportedBy: 'dmca@example.com',
                    reportedAt: '2024-01-15T14:20:00Z',
                    reason: 'copyright_infringement',
                    description: 'Unauthorized use of copyrighted material',
                    status: 'reviewing',
                    priority: 'high',
                    perceptualHashMatch: true
                }
            ];

            const mockDMCA: DMCAMatch[] = [
                {
                    id: 'dmca_1',
                    contentId: 'content_456',
                    contentTitle: 'DMCA Claimed Video',
                    originalHash: '0xabc123...',
                    matchedHash: '0xdef456...',
                    similarity: 0.95,
                    claimantInfo: {
                        name: 'John Smith',
                        email: 'john@example.com',
                        organization: 'Example Studios'
                    },
                    submittedAt: '2024-01-15T14:20:00Z',
                    status: 'pending'
                }
            ];

            const mockAudit: AuditLogEntry[] = [
                {
                    id: 'audit_1',
                    action: 'content_approved',
                    moderator: account || '',
                    targetId: 'content_789',
                    targetType: 'content',
                    reason: 'Content complies with guidelines',
                    timestamp: '2024-01-14T09:15:00Z',
                    blockchainTxHash: '0x123abc...',
                    reversible: true
                },
                {
                    id: 'audit_2',
                    action: 'content_removed',
                    moderator: account || '',
                    targetId: 'content_101',
                    targetType: 'content',
                    reason: 'DMCA takedown request',
                    timestamp: '2024-01-13T16:45:00Z',
                    blockchainTxHash: '0x456def...',
                    reversible: false
                }
            ];

            setModerationQueue(mockQueue);
            setDmcaMatches(mockDMCA);
            setAuditLog(mockAudit);
        } catch (error) {
            console.error('Failed to load moderation data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModerationDecision = async () => {
        if (!selectedItem || !decisionReason.trim()) return;

        try {
            setIsProcessing(true);

            // TODO: Process moderation decision on blockchain
            // Simulate blockchain transaction
            await new Promise(resolve => setTimeout(resolve, 2000));

            const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;

            // Update moderation queue
            setModerationQueue(prev => prev.map(item => 
                item.id === selectedItem.id 
                    ? { 
                        ...item, 
                        status: decision === 'escalate' ? 'escalated' : (decision === 'approve' ? 'approved' : 'rejected'),
                        resolution: decisionReason,
                        resolvedAt: new Date().toISOString(),
                        blockchainTxHash: txHash
                    }
                    : item
            ));

            // Add to audit log
            const auditEntry: AuditLogEntry = {
                id: `audit_${Date.now()}`,
                action: decision === 'approve' ? 'content_approved' : 'content_removed',
                moderator: account || '',
                targetId: selectedItem.contentId || selectedItem.id,
                targetType: 'content',
                reason: decisionReason,
                timestamp: new Date().toISOString(),
                blockchainTxHash: txHash,
                reversible: decision !== 'reject'
            };

            setAuditLog(prev => [auditEntry, ...prev]);
            setShowDecisionModal(false);
            setSelectedItem(null);
            setDecisionReason('');
        } catch (error) {
            console.error('Failed to process moderation decision:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDMCAAction = async (dmcaId: string, action: 'verify' | 'dispute' | 'resolve') => {
        try {
            setIsProcessing(true);

            // TODO: Process DMCA action on blockchain
            await new Promise(resolve => setTimeout(resolve, 1500));

            setDmcaMatches(prev => prev.map(match => 
                match.id === dmcaId 
                    ? { ...match, status: action === 'verify' ? 'verified' : action === 'dispute' ? 'disputed' : 'resolved' }
                    : match
            ));

            // Add to audit log
            const auditEntry: AuditLogEntry = {
                id: `audit_${Date.now()}`,
                action: 'dmca_processed',
                moderator: account || '',
                targetId: dmcaId,
                targetType: 'content',
                reason: `DMCA claim ${action}d`,
                timestamp: new Date().toISOString(),
                blockchainTxHash: `0x${Math.random().toString(16).substr(2, 64)}`,
                reversible: action !== 'resolve'
            };

            setAuditLog(prev => [auditEntry, ...prev]);
        } catch (error) {
            console.error('Failed to process DMCA action:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'reviewing': return 'bg-blue-100 text-blue-700';
            case 'approved': return 'bg-green-100 text-green-700';
            case 'rejected': return 'bg-red-100 text-red-700';
            case 'escalated': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-red-600';
            case 'high': return 'text-orange-600';
            case 'medium': return 'text-yellow-600';
            case 'low': return 'text-green-600';
            default: return 'text-gray-600';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
    };

    if (!isConnected || !account) {
        return (
            <div>
                <PageHeader id="studioModeration" title="Comments & Moderation" />
                <EmptyState 
                    icon="wallet"
                    title="Connect Your Wallet" 
                    subtitle="Connect your wallet to access moderation tools and manage content compliance." 
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div>
                <PageHeader id="studioModeration" title="Comments & Moderation" />
                <EmptyState 
                    icon="shield-alert"
                    title="Authentication Required" 
                    subtitle="Please authenticate with your wallet to access moderation features." 
                />
            </div>
        );
    }

    return (
        <div>
            <PageHeader id="studioModeration" title="Comments & Moderation" />

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'queue'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Moderation Queue ({moderationQueue.filter(item => item.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('dmca')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'dmca'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        DMCA Protection ({dmcaMatches.filter(match => match.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'audit'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Audit Trail
                    </button>
                </nav>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Icon name="loader" size={32} className="animate-spin text-gray-400" />
                </div>
            ) : (
                <>
                    {/* Moderation Queue Tab */}
                    {activeTab === 'queue' && (
                        <div className="space-y-4">
                            {moderationQueue.length === 0 ? (
                                <EmptyState 
                                    icon="shield-check"
                                    title="No Pending Moderation" 
                                    subtitle="All content is currently compliant. New reports will appear here for review." 
                                />
                            ) : (
                                moderationQueue.map(item => (
                                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-medium">{item.contentTitle || 'Moderation Item'}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                    <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                                                        {item.priority.toUpperCase()}
                                                    </span>
                                                    {item.perceptualHashMatch && (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                                            Hash Match
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-600 mb-2">{item.description}</p>
                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                    <span>Reported by: {item.reportedBy}</span>
                                                    <span>Type: {item.type.replace('_', ' ')}</span>
                                                    <span>Date: {formatDate(item.reportedAt)}</span>
                                                </div>
                                                {item.evidenceUrls && item.evidenceUrls.length > 0 && (
                                                    <div className="mt-2">
                                                        <span className="text-sm text-gray-600">Evidence: </span>
                                                        {item.evidenceUrls.map((url, index) => (
                                                            <a 
                                                                key={index}
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                                                            >
                                                                Evidence {index + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {item.status === 'pending' && (
                                                <Button
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setShowDecisionModal(true);
                                                    }}
                                                >
                                                    <Icon name="gavel" size={16} className="mr-2" />
                                                    Review
                                                </Button>
                                            )}
                                        </div>

                                        {item.resolution && (
                                            <div className="bg-gray-50 rounded-lg p-3 mt-4">
                                                <h4 className="font-medium text-gray-900 mb-1">Resolution</h4>
                                                <p className="text-gray-700 text-sm">{item.resolution}</p>
                                                {item.blockchainTxHash && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Blockchain TX: {item.blockchainTxHash}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* DMCA Protection Tab */}
                    {activeTab === 'dmca' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Icon name="shield" size={20} className="text-blue-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-blue-800 mb-1">Perceptual Hash Protection</h4>
                                        <p className="text-blue-700 text-sm">
                                            Our system automatically detects potential copyright infringement using perceptual hashing. 
                                            Matches above 90% similarity are flagged for review.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {dmcaMatches.length === 0 ? (
                                <EmptyState 
                                    icon="shield-check"
                                    title="No DMCA Claims" 
                                    subtitle="No copyright infringement detected. Your content is protected by our perceptual hash system." 
                                />
                            ) : (
                                dmcaMatches.map(match => (
                                    <div key={match.id} className="bg-white border border-gray-200 rounded-lg p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-medium">{match.contentTitle}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(match.status)}`}>
                                                        {match.status}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                                        {(match.similarity * 100).toFixed(1)}% Match
                                                    </span>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 mb-1">Claimant Information</h4>
                                                        <p className="text-sm text-gray-600">{match.claimantInfo.name}</p>
                                                        <p className="text-sm text-gray-600">{match.claimantInfo.email}</p>
                                                        {match.claimantInfo.organization && (
                                                            <p className="text-sm text-gray-600">{match.claimantInfo.organization}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 mb-1">Hash Information</h4>
                                                        <p className="text-xs text-gray-600">Original: {match.originalHash}</p>
                                                        <p className="text-xs text-gray-600">Matched: {match.matchedHash}</p>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Submitted: {formatDate(match.submittedAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {match.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDMCAAction(match.id, 'dispute')}
                                                        disabled={isProcessing}
                                                    >
                                                        Dispute
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDMCAAction(match.id, 'verify')}
                                                        disabled={isProcessing}
                                                    >
                                                        {isProcessing ? (
                                                            <Icon name="loader" size={14} className="animate-spin" />
                                                        ) : (
                                                            'Verify & Remove'
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Audit Trail Tab */}
                    {activeTab === 'audit' && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Icon name="file-text" size={20} className="text-green-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-green-800 mb-1">Blockchain Audit Trail</h4>
                                        <p className="text-green-700 text-sm">
                                            All moderation actions are recorded on the blockchain for transparency and compliance. 
                                            This creates an immutable record for legal purposes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {auditLog.length === 0 ? (
                                <EmptyState 
                                    icon="file-text"
                                    title="No Audit Records" 
                                    subtitle="Moderation actions will be recorded here with blockchain verification." 
                                />
                            ) : (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr className="border-b">
                                                <th className="p-3 text-left font-medium text-gray-700">Action</th>
                                                <th className="p-3 text-left font-medium text-gray-700">Target</th>
                                                <th className="p-3 text-left font-medium text-gray-700">Moderator</th>
                                                <th className="p-3 text-left font-medium text-gray-700">Reason</th>
                                                <th className="p-3 text-left font-medium text-gray-700">Date</th>
                                                <th className="p-3 text-left font-medium text-gray-700">Blockchain</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditLog.map(entry => (
                                                <tr key={entry.id} className="border-t border-gray-200 hover:bg-gray-50">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <Icon 
                                                                name={entry.action.includes('approved') ? 'check-circle' : 
                                                                      entry.action.includes('removed') ? 'x-circle' : 
                                                                      'shield'} 
                                                                size={16} 
                                                                className={entry.action.includes('approved') ? 'text-green-600' : 
                                                                          entry.action.includes('removed') ? 'text-red-600' : 
                                                                          'text-blue-600'}
                                                            />
                                                            <span className="capitalize">{entry.action.replace('_', ' ')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div>
                                                            <span className="font-medium">{entry.targetType}</span>
                                                            <p className="text-xs text-gray-500">{entry.targetId}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-xs text-gray-600">{entry.moderator}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-gray-700">{entry.reason}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-gray-600">{formatDate(entry.timestamp)}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        {entry.blockchainTxHash ? (
                                                            <div className="flex items-center gap-1">
                                                                <Icon name="link" size={12} className="text-green-600" />
                                                                <span className="text-xs text-green-600">Verified</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">Pending</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Moderation Decision Modal */}
            {showDecisionModal && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Moderation Decision</h3>
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowDecisionModal(false)}
                            >
                                <Icon name="x" size={20} />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-2">Content: {selectedItem.contentTitle}</p>
                                <p className="text-sm text-gray-600">Reason: {selectedItem.reason}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Decision
                                </label>
                                <select
                                    value={decision}
                                    onChange={(e) => setDecision(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="approve">Approve Content</option>
                                    <option value="reject">Remove Content</option>
                                    <option value="escalate">Escalate for Review</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason *
                                </label>
                                <textarea
                                    value={decisionReason}
                                    onChange={(e) => setDecisionReason(e.target.value)}
                                    rows={3}
                                    placeholder="Explain your decision..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-blue-700 text-sm">
                                    <Icon name="info" size={16} />
                                    <span>This decision will be recorded on the blockchain for audit purposes.</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowDecisionModal(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleModerationDecision}
                                disabled={isProcessing || !decisionReason.trim()}
                                className="flex-1"
                            >
                                {isProcessing ? (
                                    <>
                                        <Icon name="loader" size={16} className="animate-spin mr-2" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="check" size={16} className="mr-2" />
                                        Submit Decision
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudioModerationPage;
