import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnectModal } from '../components/wallet/WalletConnectModal';

const WalletPage: React.FC = () => {
    const { isConnected, account, chainId, balance, disconnect } = useWallet();
    const [activeTab, setActiveTab] = useState<'tokens' | 'nfts' | 'activity'>('tokens');
    const [showConnectModal, setShowConnectModal] = useState(false);

    // Mock data for demonstration (will be replaced with real data later)
    const mockTokens = [
        { symbol: 'ETH', name: 'Ethereum', balance: balance || '0', value: '$0.00', change: '+0.0%', color: 'from-blue-400 to-blue-600', icon: '⟠' },
        { symbol: 'MATIC', name: 'Polygon', balance: '0', value: '$0.00', change: '+0.0%', color: 'from-purple-400 to-purple-600', icon: '⬟' },
        { symbol: 'USDC', name: 'USD Coin', balance: '0', value: '$0.00', change: '0.0%', color: 'from-green-400 to-green-600', icon: '💵' },
    ];

    const mockNfts = [
        { name: 'Reelverse Creator #1234', collection: 'Reelverse Creators', image: 'https://picsum.photos/seed/nft1/200/200' },
        { name: 'Web3 Pioneer Badge', collection: 'Achievement NFTs', image: 'https://picsum.photos/seed/nft2/200/200' },
        { name: 'First Upload Commemorative', collection: 'Milestone NFTs', image: 'https://picsum.photos/seed/nft3/200/200' },
    ];

    const mockTransactions = [
        { type: 'received', amount: '+0.05 ETH', from: 'Tip from @cryptofan', time: '2 hours ago', status: 'confirmed' },
        { type: 'sent', amount: '-0.02 ETH', to: 'Gas fee', time: '1 day ago', status: 'confirmed' },
        { type: 'received', amount: '+150 MATIC', from: 'Creator rewards', time: '3 days ago', status: 'confirmed' },
        { type: 'sent', amount: '-50 USDC', to: 'Storage payment', time: '1 week ago', status: 'confirmed' },
    ];

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background p-6">
                <PageHeader id="wallet" title="Wallet" />
                
                {/* Real wallet connection interface */}
                <div className="max-w-md mx-auto mt-12">
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <Icon name="wallet" size={40} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                        <p className="text-muted-foreground">
                            Connect your wallet to manage your crypto assets and NFTs
                        </p>
                    </div>

                    <Button 
                        onClick={() => setShowConnectModal(true)}
                        className="w-full h-14 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                        <Icon name="wallet" className="mr-3" size={20} />
                        <div>
                            <div className="font-semibold">Connect Wallet</div>
                            <div className="text-xs opacity-80">Choose from multiple wallet providers</div>
                        </div>
                    </Button>

                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                            <Icon name="shield-check" size={20} className="text-blue-500 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-blue-500 mb-1">Secure Connection</p>
                                <p className="text-muted-foreground">
                                    Your wallet connection is encrypted and secure. We never store your private keys.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <WalletConnectModal
                    isOpen={showConnectModal}
                    onClose={() => setShowConnectModal(false)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header with real wallet integration */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <PageHeader id="wallet" title="Wallet" />
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                                <Icon name="credit-card" className="mr-2" size={16} />
                                Buy Crypto
                            </Button>
                            <Button variant="outline" size="sm">
                                <Icon name="banknote" className="mr-2" size={16} />
                                Send
                            </Button>
                        </div>
                    </div>

                    {/* Real wallet info */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-xl border border-purple-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                <Icon name="wallet" size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-mono text-sm text-muted-foreground">
                                    {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
                                </p>
                                <p className="text-2xl font-bold">{balance ? `${balance} ETH` : '$0.00'}</p>
                            </div>
                            <div className="ml-auto">
                                <Button variant="ghost" size="sm" onClick={disconnect}>
                                    <Icon name="unlink" size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6">

                {/* Tabs */}
                <div className="flex items-center gap-1 mb-6 bg-secondary rounded-lg p-1">
                    {(['tokens', 'nfts', 'activity'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                                activeTab === tab
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content based on active tab */}
                {activeTab === 'tokens' && (
                    <div className="space-y-3">
                        {mockTokens.map((token, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors cursor-pointer">
                                <div className={`w-12 h-12 bg-gradient-to-br ${token.color} rounded-full flex items-center justify-center text-white text-xl font-bold`}>
                                    {token.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{token.symbol}</span>
                                        <span className="text-sm text-muted-foreground">{token.name}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {token.balance} {token.symbol}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold">{token.value}</div>
                                    <div className={`text-sm ${token.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                                        {token.change}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'nfts' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mockNfts.map((nft, index) => (
                            <div key={index} className="bg-secondary rounded-xl overflow-hidden hover:bg-secondary/80 transition-colors cursor-pointer">
                                <div className="aspect-square">
                                    <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-sm mb-1">{nft.name}</h3>
                                    <p className="text-xs text-muted-foreground">{nft.collection}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-3">
                        {mockTransactions.map((tx, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    tx.type === 'received' ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}>
                                    <Icon 
                                        name={tx.type === 'received' ? 'trending-up' : 'trending-down'} 
                                        size={16} 
                                        className={tx.type === 'received' ? 'text-green-500' : 'text-red-500'} 
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-sm">{tx.amount}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {tx.type === 'received' ? tx.from : tx.to}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">{tx.time}</div>
                                    <div className="flex items-center gap-1 text-xs text-green-500">
                                        <Icon name="shield-check" size={12} />
                                        {tx.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletPage;