import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/auth/AuthProvider';
import Icon from '../Icon';

interface SplitPayee {
  id?: string;
  userId?: string;
  name: string;
  email: string;
  percentage: number;
  isVerified?: boolean;
}

interface SplitPolicy {
  id: string;
  name: string;
  description: string;
  payees: SplitPayee[];
  totalPercentage: number;
  status: 'draft' | 'active' | 'archived';
  videoCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface SplitsManagerProps {
  className?: string;
  onPolicyChange?: (policy: SplitPolicy) => void;
}

/**
 * SplitsManager Component
 * 
 * Manages revenue split policies for creators:
 * - Create and edit split policies
 * - Add/remove payees with validation
 * - Percentage calculation and validation
 * - Policy versioning for immutable historical splits
 * - Payee verification status
 * - Applied video tracking
 */
export default function SplitsManager({ 
  className = '', 
  onPolicyChange 
}: SplitsManagerProps) {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SplitPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<SplitPolicy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Form state for creating/editing policies
  const [policyForm, setPolicyForm] = useState({
    name: '',
    description: '',
    payees: [{ name: '', email: '', percentage: 100 }] as SplitPayee[]
  });

  // Load user's split policies
  useEffect(() => {
    if (user) {
      loadPolicies();
    }
  }, [user]);

  const loadPolicies = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch('/api/splits/policies', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || []);
        
        // Select first active policy by default
        const activePolicy = data.policies?.find((p: SplitPolicy) => p.status === 'active');
        if (activePolicy) {
          setSelectedPolicy(activePolicy);
        }
      } else {
        setError('Failed to load split policies');
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
      setError('Failed to load split policies');
    } finally {
      setLoading(false);
    }
  };

  // Validate policy form
  const validatePolicy = (form: typeof policyForm): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Policy name is required';
    }

    if (!form.description.trim()) {
      errors.description = 'Policy description is required';
    }

    if (form.payees.length === 0) {
      errors.payees = 'At least one payee is required';
    }

    const totalPercentage = form.payees.reduce((sum, payee) => sum + payee.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.percentage = `Total percentage must equal 100% (currently ${totalPercentage.toFixed(2)}%)`;
    }

    form.payees.forEach((payee, index) => {
      if (!payee.name.trim()) {
        errors[`payee_${index}_name`] = 'Payee name is required';
      }

      if (!payee.email.trim()) {
        errors[`payee_${index}_email`] = 'Payee email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payee.email)) {
        errors[`payee_${index}_email`] = 'Invalid email format';
      }

      if (payee.percentage <= 0 || payee.percentage > 100) {
        errors[`payee_${index}_percentage`] = 'Percentage must be between 0.01% and 100%';
      }
    });

    return errors;
  };

  // Handle policy creation
  const handleCreatePolicy = async () => {
    const errors = validatePolicy(policyForm);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const response = await fetch('/api/splits/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: policyForm.name,
          description: policyForm.description,
          payees: policyForm.payees
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newPolicy: SplitPolicy = data.policy;
        
        setPolicies(prev => [...prev, newPolicy]);
        setSelectedPolicy(newPolicy);
        setIsCreating(false);
        setPolicyForm({
          name: '',
          description: '',
          payees: [{ name: '', email: '', percentage: 100 }]
        });

        if (onPolicyChange) {
          onPolicyChange(newPolicy);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create policy');
      }
    } catch (err) {
      console.error('Failed to create policy:', err);
      setError('Failed to create policy');
    }
  };

  // Handle adding payee
  const handleAddPayee = () => {
    const newPayee: SplitPayee = { name: '', email: '', percentage: 0 };
    setPolicyForm(prev => ({
      ...prev,
      payees: [...prev.payees, newPayee]
    }));
  };

  // Handle removing payee
  const handleRemovePayee = (index: number) => {
    if (policyForm.payees.length === 1) return; // Keep at least one payee
    
    setPolicyForm(prev => ({
      ...prev,
      payees: prev.payees.filter((_, i) => i !== index)
    }));
  };

  // Handle payee field changes
  const handlePayeeChange = (index: number, field: keyof SplitPayee, value: string | number) => {
    setPolicyForm(prev => ({
      ...prev,
      payees: prev.payees.map((payee, i) => 
        i === index ? { ...payee, [field]: value } : payee
      )
    }));

    // Clear validation error for this field
    const errorKey = `payee_${index}_${field}`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Auto-distribute percentages evenly
  const handleDistributeEvenly = () => {
    const percentage = Math.round(10000 / policyForm.payees.length) / 100; // Round to 2 decimals
    const lastPercentage = 100 - (percentage * (policyForm.payees.length - 1));

    setPolicyForm(prev => ({
      ...prev,
      payees: prev.payees.map((payee, index) => ({
        ...payee,
        percentage: index === prev.payees.length - 1 ? lastPercentage : percentage
      }))
    }));
  };

  // Calculate total percentage
  const totalPercentage = policyForm.payees.reduce((sum, payee) => sum + payee.percentage, 0);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded"></div>
          <div className="h-32 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Revenue Splits</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage how tip and subscription revenue is distributed to collaborators
          </p>
        </div>
        
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Icon name="plus" size={16} />
            New Policy
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || isEditing) && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            {isCreating ? 'Create Split Policy' : 'Edit Split Policy'}
          </h3>

          <div className="space-y-4">
            {/* Policy Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Policy Name
              </label>
              <input
                type="text"
                value={policyForm.name}
                onChange={(e) => setPolicyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Band Split, Producer Collab"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
              {validationErrors.name && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.name}</p>
              )}
            </div>

            {/* Policy Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={policyForm.description}
                onChange={(e) => setPolicyForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this split policy..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
              {validationErrors.description && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.description}</p>
              )}
            </div>

            {/* Payees */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-300">
                  Payees ({policyForm.payees.length})
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleDistributeEvenly}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Distribute Evenly
                  </button>
                  <button
                    onClick={handleAddPayee}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    + Add Payee
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {policyForm.payees.map((payee, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    {/* Name */}
                    <div>
                      <input
                        type="text"
                        value={payee.name}
                        onChange={(e) => handlePayeeChange(index, 'name', e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none text-sm"
                      />
                      {validationErrors[`payee_${index}_name`] && (
                        <p className="text-red-400 text-xs mt-1">{validationErrors[`payee_${index}_name`]}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <input
                        type="email"
                        value={payee.email}
                        onChange={(e) => handlePayeeChange(index, 'email', e.target.value)}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none text-sm"
                      />
                      {validationErrors[`payee_${index}_email`] && (
                        <p className="text-red-400 text-xs mt-1">{validationErrors[`payee_${index}_email`]}</p>
                      )}
                    </div>

                    {/* Percentage */}
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          value={payee.percentage}
                          onChange={(e) => handlePayeeChange(index, 'percentage', parseFloat(e.target.value) || 0)}
                          min="0.01"
                          max="100"
                          step="0.01"
                          className="w-full px-3 py-2 pr-8 bg-slate-800 border border-slate-600 rounded text-slate-100 focus:border-violet-500 focus:outline-none text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                      </div>
                      {validationErrors[`payee_${index}_percentage`] && (
                        <p className="text-red-400 text-xs mt-1">{validationErrors[`payee_${index}_percentage`]}</p>
                      )}
                    </div>

                    {/* Remove Button */}
                    <div className="flex items-center">
                      {policyForm.payees.length > 1 && (
                        <button
                          onClick={() => handleRemovePayee(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition-colors"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Percentage */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                <span className="text-sm text-slate-400">Total Percentage:</span>
                <span className={`text-sm font-medium ${
                  Math.abs(totalPercentage - 100) < 0.01 
                    ? 'text-emerald-400' 
                    : 'text-red-400'
                }`}>
                  {totalPercentage.toFixed(2)}%
                </span>
              </div>

              {validationErrors.percentage && (
                <p className="text-red-400 text-sm">{validationErrors.percentage}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreatePolicy}
                disabled={Object.keys(validatePolicy(policyForm)).length > 0}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Create Policy' : 'Save Changes'}
              </button>
              
              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                  setPolicyForm({
                    name: '',
                    description: '',
                    payees: [{ name: '', email: '', percentage: 100 }]
                  });
                  setValidationErrors({});
                }}
                className="px-6 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Policies */}
      {!isCreating && policies.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Your Split Policies</h3>
          
          <div className="grid gap-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedPolicy?.id === policy.id
                    ? 'bg-violet-600/20 border-violet-600/50'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                }`}
                onClick={() => setSelectedPolicy(policy)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-slate-100">{policy.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${
                        policy.status === 'active'
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : policy.status === 'draft'
                          ? 'bg-yellow-600/20 text-yellow-400'
                          : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {policy.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-400 mb-3">{policy.description}</p>
                    
                    <div className="space-y-1">
                      {policy.payees.map((payee, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{payee.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{payee.percentage}%</span>
                            {payee.isVerified && (
                              <Icon name="check-circle" size={14} className="text-emerald-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {policy.videoCount !== undefined && (
                      <p className="text-xs text-slate-500 mt-2">
                        Applied to {policy.videoCount} video{policy.videoCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement edit functionality
                        console.log('Edit policy:', policy.id);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isCreating && policies.length === 0 && (
        <div className="text-center py-12">
          <Icon name="users" size={48} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Split Policies</h3>
          <p className="text-slate-400 mb-6">
            Create split policies to automatically distribute tip and subscription revenue to collaborators
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Icon name="plus" size={16} />
            Create Your First Policy
          </button>
        </div>
      )}
    </div>
  );
}