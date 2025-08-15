import React, { useState, useEffect } from 'react';
import Button from '../Button';
import Icon from '../Icon';
import { useWallet } from '../../contexts/WalletContext';

export interface SplitRecipient {
  id: string;
  wallet: string;
  name?: string;
  basisPoints: number; // 10000 = 100%
  isCreator?: boolean;
}

export interface RevenueSplit {
  id: string;
  name: string;
  description?: string;
  recipients: SplitRecipient[];
  totalBasisPoints: number;
  contractAddress?: string;
  createdAt: string;
  isActive: boolean;
}

interface SplitEditorProps {
  split?: RevenueSplit;
  onSave: (split: RevenueSplit) => void;
  onCancel: () => void;
  minCreatorShare: number; // 9000 = 90%
}

const SplitEditor: React.FC<SplitEditorProps> = ({
  split,
  onSave,
  onCancel,
  minCreatorShare = 9000
}) => {
  const { account } = useWallet();
  const [splitName, setSplitName] = useState(split?.name || '');
  const [splitDescription, setSplitDescription] = useState(split?.description || '');
  const [recipients, setRecipients] = useState<SplitRecipient[]>(
    split?.recipients || [
      {
        id: 'creator',
        wallet: account || '',
        name: 'Creator (You)',
        basisPoints: minCreatorShare,
        isCreator: true
      }
    ]
  );
  const [newRecipient, setNewRecipient] = useState({
    wallet: '',
    name: '',
    basisPoints: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate total basis points
  const totalBasisPoints = recipients.reduce((sum, r) => sum + r.basisPoints, 0);
  const creatorShare = recipients.find(r => r.isCreator)?.basisPoints || 0;

  // Validation
  const isValid = () => {
    if (!splitName.trim()) return false;
    if (totalBasisPoints !== 10000) return false;
    if (creatorShare < minCreatorShare) return false;
    if (recipients.length === 0) return false;
    return true;
  };

  const addRecipient = () => {
    if (!newRecipient.wallet.trim()) {
      setError('Wallet address is required');
      return;
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newRecipient.wallet)) {
      setError('Invalid wallet address format');
      return;
    }

    // Check if recipient already exists
    if (recipients.some(r => r.wallet.toLowerCase() === newRecipient.wallet.toLowerCase())) {
      setError('Recipient already added');
      return;
    }

    // Validate basis points
    if (newRecipient.basisPoints <= 0 || newRecipient.basisPoints > 10000) {
      setError('Share must be between 0.01% and 100%');
      return;
    }

    const recipient: SplitRecipient = {
      id: `recipient_${Date.now()}`,
      wallet: newRecipient.wallet,
      name: newRecipient.name || undefined,
      basisPoints: newRecipient.basisPoints,
      isCreator: false
    };

    setRecipients(prev => [...prev, recipient]);
    setNewRecipient({ wallet: '', name: '', basisPoints: 0 });
    setError(null);
  };

  const removeRecipient = (id: string) => {
    // Don't allow removing the creator
    const recipient = recipients.find(r => r.id === id);
    if (recipient?.isCreator) {
      setError('Cannot remove creator from split');
      return;
    }

    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const updateRecipientShare = (id: string, basisPoints: number) => {
    if (basisPoints < 0 || basisPoints > 10000) return;

    setRecipients(prev => prev.map(r => 
      r.id === id ? { ...r, basisPoints } : r
    ));
  };

  const handleSave = async () => {
    if (!isValid()) {
      setError('Please fix validation errors before saving');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // TODO: Deploy split contract to blockchain
      // For now, simulate the deployment
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newSplit: RevenueSplit = {
        id: split?.id || `split_${Date.now()}`,
        name: splitName,
        description: splitDescription || undefined,
        recipients,
        totalBasisPoints,
        contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`, // Mock contract address
        createdAt: split?.createdAt || new Date().toISOString(),
        isActive: true
      };

      onSave(newSplit);
    } catch (error: any) {
      setError(error.message || 'Failed to save split. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPercentage = (basisPoints: number) => {
    return (basisPoints / 100).toFixed(2) + '%';
  };

  const parsePercentage = (percentage: string) => {
    const num = parseFloat(percentage.replace('%', ''));
    return Math.round(num * 100);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Split Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Split Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Split Name *
            </label>
            <input
              type="text"
              value={splitName}
              onChange={(e) => setSplitName(e.target.value)}
              placeholder="e.g., Video Collaboration Split"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={splitDescription}
              onChange={(e) => setSplitDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Revenue Recipients</h3>
        
        {/* Current Recipients */}
        <div className="space-y-3 mb-6">
          {recipients.map(recipient => (
            <div key={recipient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
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
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={(recipient.basisPoints / 100).toFixed(2)}
                    onChange={(e) => updateRecipientShare(recipient.id, parseFloat(e.target.value) * 100)}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    disabled={recipient.isCreator && creatorShare < minCreatorShare}
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
                
                {!recipient.isCreator && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeRecipient(recipient.id)}
                  >
                    <Icon name="trash-2" size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add New Recipient */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium mb-3">Add Collaborator</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div className="md:col-span-2">
              <input
                type="text"
                value={newRecipient.wallet}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, wallet: e.target.value }))}
                placeholder="Wallet address (0x...)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="text"
                value={newRecipient.name}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Name (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newRecipient.basisPoints / 100}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, basisPoints: parseFloat(e.target.value || '0') * 100 }))}
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
              <span className="text-sm text-gray-600">%</span>
            </div>
          </div>
          <Button onClick={addRecipient} size="sm">
            <Icon name="plus" size={16} className="mr-2" />
            Add Collaborator
          </Button>
        </div>

        {/* Split Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Total Allocation:</span>
            <span className={`font-medium ${
              totalBasisPoints === 10000 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercentage(totalBasisPoints)}
            </span>
          </div>
          
          {totalBasisPoints !== 10000 && (
            <p className="text-sm text-red-600">
              Total must equal 100%. Remaining: {formatPercentage(10000 - totalBasisPoints)}
            </p>
          )}
          
          {creatorShare < minCreatorShare && (
            <p className="text-sm text-red-600">
              Creator must receive at least {formatPercentage(minCreatorShare)} (platform requirement)
            </p>
          )}
          
          <div className="mt-3 pt-3 border-t border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">Revenue Distribution:</h4>
            <div className="space-y-1 text-sm">
              {recipients.map(recipient => (
                <div key={recipient.id} className="flex justify-between">
                  <span>{recipient.name || recipient.wallet}</span>
                  <span>{formatPercentage(recipient.basisPoints)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="alert-circle" size={20} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={!isValid() || isProcessing}
        >
          {isProcessing ? (
            <>
              <Icon name="loader" size={16} className="animate-spin mr-2" />
              {split ? 'Updating Split...' : 'Creating Split...'}
            </>
          ) : (
            <>
              <Icon name="check" size={16} className="mr-2" />
              {split ? 'Update Split' : 'Create Split'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SplitEditor;