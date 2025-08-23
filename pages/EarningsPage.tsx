
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useAuth } from '../src/auth/AuthProvider';

interface EarningsData {
  totalEarnings: number;
  usdcBalance: number;
  fiatBalance: number;
  pendingPayouts: number;
  monthlyEarnings: Array<{
    month: string;
    amount: number;
    source: 'subscriptions' | 'ppv' | 'tips' | 'splits';
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'earning' | 'withdrawal' | 'split';
    amount: number;
    currency: 'USDC' | 'USD';
    description: string;
    date: string;
    status: 'completed' | 'pending' | 'failed';
  }>;
}

interface PayoutMethod {
  id: string;
  type: 'crypto' | 'fiat';
  name: string;
  details: string;
  isDefault: boolean;
}

const EarningsPage: React.FC = () => {
    const { user, openSignInModal } = useAuth();
    const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
    const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState('');
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load earnings data when user is authenticated
    useEffect(() => {
        if (user) {
            loadEarningsData();
            loadPayoutMethods();
        } else {
            setEarningsData(null);
            setPayoutMethods([]);
        }
    }, [user]);

    const loadEarningsData = async () => {
        try {
            setIsLoading(true);
            // TODO: Load from API
            // Mock data for demonstration
            const mockData: EarningsData = {
                totalEarnings: 2847.32,
                usdcBalance: 156.78,
                fiatBalance: 2690.54,
                pendingPayouts: 0,
                monthlyEarnings: [
                    { month: 'Jan 2024', amount: 1245.67, source: 'subscriptions' },
                    { month: 'Feb 2024', amount: 987.43, source: 'ppv' },
                    { month: 'Mar 2024', amount: 614.22, source: 'tips' }
                ],
                recentTransactions: [
                    {
                        id: 'tx_1',
                        type: 'earning',
                        amount: 25.50,
                        currency: 'USDC',
                        description: 'PPV purchase - "Video Title"',
                        date: '2024-01-16T10:30:00Z',
                        status: 'completed'
                    },
                    {
                        id: 'tx_2',
                        type: 'withdrawal',
                        amount: 100.00,
                        currency: 'USD',
                        description: 'Paxum withdrawal',
                        date: '2024-01-15T14:20:00Z',
                        status: 'completed'
                    },
                    {
                        id: 'tx_3',
                        type: 'split',
                        amount: 45.25,
                        currency: 'USDC',
                        description: 'Revenue split - Collaboration #1',
                        date: '2024-01-14T09:15:00Z',
                        status: 'completed'
                    }
                ]
            };
            setEarningsData(mockData);
        } catch (error) {
            console.error('Failed to load earnings data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPayoutMethods = async () => {
        try {
            // TODO: Load from API
            // Mock data for demonstration
            const mockMethods: PayoutMethod[] = [
                {
                    id: 'crypto_1',
                    type: 'crypto',
                    name: 'USDC Wallet',
                    details: user?.uid || '',
                    isDefault: true
                },
                {
                    id: 'fiat_1',
                    type: 'fiat',
                    name: 'Paxum Account',
                    details: 'user@example.com',
                    isDefault: false
                }
            ];
            setPayoutMethods(mockMethods);
        } catch (error) {
            console.error('Failed to load payout methods:', error);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawAmount || !withdrawMethod) {
            setError('Please enter amount and select payout method');
            return;
        }

        const amount = parseFloat(withdrawAmount);
        if (amount <= 0) {
            setError('Amount must be greater than 0');
            return;
        }

        const method = payoutMethods.find(m => m.id === withdrawMethod);
        if (!method) {
            setError('Invalid payout method');
            return;
        }

        // Check balance
        const availableBalance = method.type === 'crypto' ? earningsData?.usdcBalance : earningsData?.fiatBalance;
        if (amount > (availableBalance || 0)) {
            setError('Insufficient balance');
            return;
        }

        try {
            setIsProcessingWithdraw(true);
            setError(null);

            // TODO: Process withdrawal
            // For crypto: instant transfer
            // For fiat: initiate Paxum transfer
            await new Promise(resolve => setTimeout(resolve, method.type === 'crypto' ? 1000 : 3000));

            // Update balances
            if (earningsData) {
                setEarningsData(prev => prev ? {
                    ...prev,
                    usdcBalance: method.type === 'crypto' ? prev.usdcBalance - amount : prev.usdcBalance,
                    fiatBalance: method.type === 'fiat' ? prev.fiatBalance - amount : prev.fiatBalance,
                    recentTransactions: [
                        {
                            id: `tx_${Date.now()}`,
                            type: 'withdrawal',
                            amount,
                            currency: method.type === 'crypto' ? 'USDC' : 'USD',
                            description: `${method.name} withdrawal`,
                            date: new Date().toISOString(),
                            status: method.type === 'crypto' ? 'completed' : 'pending'
                        },
                        ...prev.recentTransactions
                    ]
                } : null);
            }

            setShowWithdrawModal(false);
            setWithdrawAmount('');
            setWithdrawMethod('');
        } catch (error: any) {
            setError(error.message || 'Withdrawal failed. Please try again.');
        } finally {
            setIsProcessingWithdraw(false);
        }
    };

    const formatCurrency = (amount: number, currency: 'USD' | 'USDC' = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === 'USDC' ? 'USD' : currency,
        }).format(amount) + (currency === 'USDC' ? ' USDC' : '');
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'earning': return 'trending-up';
            case 'withdrawal': return 'arrow-down';
            case 'split': return 'git-merge';
            default: return 'circle';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600';
            case 'pending': return 'text-yellow-600';
            case 'failed': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    if (!user) {
        return (
            <div className="p-6">
                <PageHeader id="earnings" title="Earnings & Payouts" />
                <EmptyState 
                    icon="credit-card"
                    title="Sign in Required" 
                    subtitle="Sign in to view your earnings and manage payouts. No wallet required." 
                />
                <div className="flex justify-center mt-4">
                    <Button onClick={() => openSignInModal()}>
                        Sign in to Reelverse
                    </Button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-6">
                <PageHeader id="earnings" title="Earnings & Payouts" />
                <div className="flex items-center justify-center py-12">
                    <Icon name="loader" size={32} className="animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    if (!earningsData) {
        return (
            <div className="p-6">
                <PageHeader id="earnings" title="Earnings & Payouts" />
                <EmptyState 
                    icon="banknote"
                    title="No Earnings Yet" 
                    subtitle="Start creating content to begin earning revenue from subscriptions, pay-per-view, and tips." 
                />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <PageHeader 
                id="earnings" 
                title="Earnings & Payouts"
                actions={
                    <Button onClick={() => setShowWithdrawModal(true)}>
                        <Icon name="arrow-down" size={16} className="mr-2" />
                        Withdraw
                    </Button>
                }
            />

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Icon name="dollar-sign" size={20} className="text-green-600" />
                        </div>
                        <h3 className="font-medium text-gray-900">Total Earnings</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(earningsData.totalEarnings)}
                    </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Icon name="coins" size={20} className="text-blue-600" />
                        </div>
                        <h3 className="font-medium text-gray-900">USDC Balance</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(earningsData.usdcBalance, 'USDC')}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Instant withdrawal available</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Icon name="banknote" size={20} className="text-purple-600" />
                        </div>
                        <h3 className="font-medium text-gray-900">Fiat Balance</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(earningsData.fiatBalance)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">48-hour withdrawal</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Icon name="clock" size={20} className="text-yellow-600" />
                        </div>
                        <h3 className="font-medium text-gray-900">Pending</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(earningsData.pendingPayouts)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Processing payouts</p>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
                <div className="space-y-3">
                    {earningsData.recentTransactions.map(transaction => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <Icon name={getTransactionIcon(transaction.type)} size={16} className="text-gray-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{transaction.description}</p>
                                    <p className="text-sm text-gray-600">
                                        {new Date(transaction.date).toLocaleDateString()} at {new Date(transaction.date).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-gray-900">
                                    {transaction.type === 'withdrawal' ? '-' : '+'}
                                    {formatCurrency(transaction.amount, transaction.currency)}
                                </p>
                                <p className={`text-sm capitalize ${getStatusColor(transaction.status)}`}>
                                    {transaction.status}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Withdraw Funds</h3>
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowWithdrawModal(false)}
                            >
                                <Icon name="x" size={20} />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payout Method
                                </label>
                                <select
                                    value={withdrawMethod}
                                    onChange={(e) => setWithdrawMethod(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select payout method</option>
                                    {payoutMethods.map(method => (
                                        <option key={method.id} value={method.id}>
                                            {method.name} - {method.details}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {withdrawMethod && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-blue-700 text-sm">
                                        <Icon name="info" size={16} />
                                        <span>
                                            {payoutMethods.find(m => m.id === withdrawMethod)?.type === 'crypto'
                                                ? 'Instant transfer (60 seconds)'
                                                : 'Fiat transfer (48 hours)'
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-red-700 text-sm">
                                        <Icon name="alert-circle" size={16} />
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowWithdrawModal(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleWithdraw}
                                disabled={isProcessingWithdraw || !withdrawAmount || !withdrawMethod}
                                className="flex-1"
                            >
                                {isProcessingWithdraw ? (
                                    <>
                                        <Icon name="loader" size={16} className="animate-spin mr-2" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="arrow-down" size={16} className="mr-2" />
                                        Withdraw
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

export default EarningsPage;
