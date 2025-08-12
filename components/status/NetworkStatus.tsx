import React from 'react';
import { NetworkInfo } from '../../pages/StatusPage';
import Icon from '../Icon';

interface NetworkStatusProps {
    networks: NetworkInfo[];
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ networks }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'text-green-500 bg-green-500';
            case 'congested':
                return 'text-yellow-500 bg-yellow-500';
            case 'unstable':
                return 'text-red-500 bg-red-500';
            default:
                return 'text-gray-500 bg-gray-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'Healthy';
            case 'congested':
                return 'Congested';
            case 'unstable':
                return 'Unstable';
            default:
                return 'Unknown';
        }
    };

    const getNetworkIcon = (networkId: string) => {
        switch (networkId) {
            case 'ethereum':
                return 'diamond';
            case 'polygon':
                return 'cpu';
            case 'arbitrum':
                return 'trending-up';
            case 'base':
                return 'activity';
            default:
                return 'cpu';
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const getTimeSinceLastBlock = (lastBlock: Date) => {
        const seconds = Math.floor((Date.now() - lastBlock.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {networks.map((network) => (
                <div key={network.id} className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
                    {/* Network Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <Icon name={getNetworkIcon(network.id) as any} size={20} className="text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">{network.name}</h3>
                                <p className="text-xs text-muted-foreground">Chain ID: {network.chainId}</p>
                            </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(network.status).split(' ')[1]} animate-pulse`}></div>
                            <span className={`text-sm font-medium ${getStatusColor(network.status).split(' ')[0]}`}>
                                {getStatusText(network.status)}
                            </span>
                        </div>
                    </div>

                    {/* Network Metrics - Etherscan style */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <div className="text-xs text-muted-foreground">Block Height</div>
                                <div className="text-sm font-mono">
                                    #{formatNumber(network.blockHeight)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Gas Price</div>
                                <div className="text-sm font-semibold">
                                    {network.gasPrice} Gwei
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <div className="text-xs text-muted-foreground">TPS</div>
                                <div className="text-sm font-semibold">
                                    {network.tps.toFixed(1)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Last Block</div>
                                <div className="text-sm">
                                    {getTimeSinceLastBlock(network.lastBlock)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gas Price Indicator */}
                    <div className="mt-4 pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Gas Price Level</span>
                            <div className="flex items-center gap-1">
                                {network.gasPrice < 20 && (
                                    <>
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-xs text-green-500">Low</span>
                                    </>
                                )}
                                {network.gasPrice >= 20 && network.gasPrice < 50 && (
                                    <>
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                        <span className="text-xs text-yellow-500">Medium</span>
                                    </>
                                )}
                                {network.gasPrice >= 50 && (
                                    <>
                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                        <span className="text-xs text-red-500">High</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Network-specific alerts */}
                    {network.status === 'congested' && (
                        <div className="mt-3 p-2 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded text-xs">
                            Network is experiencing high traffic. Transactions may take longer to confirm.
                        </div>
                    )}
                    {network.status === 'unstable' && (
                        <div className="mt-3 p-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded text-xs">
                            Network is experiencing instability. Some transactions may fail.
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};