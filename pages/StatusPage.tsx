
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { SystemOverview } from '../components/status/SystemOverview';
import { ServiceStatus } from '../components/status/ServiceStatus';
import { NetworkStatus } from '../components/status/NetworkStatus';
import { IncidentReports } from '../components/status/IncidentReports';
import { UptimeHistory } from '../components/status/UptimeHistory';
import { PerformanceMetrics } from '../components/status/PerformanceMetrics';
import Icon from '../components/Icon';

export interface ServiceHealth {
    id: string;
    name: string;
    status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
    uptime: number;
    responseTime: number;
    lastChecked: Date;
    description: string;
}

export interface NetworkInfo {
    id: string;
    name: string;
    chainId: number;
    blockHeight: number;
    gasPrice: number;
    tps: number;
    status: 'healthy' | 'congested' | 'unstable';
    lastBlock: Date;
}

export interface Incident {
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    severity: 'minor' | 'major' | 'critical';
    startTime: Date;
    endTime?: Date;
    updates: IncidentUpdate[];
    affectedServices: string[];
}

export interface IncidentUpdate {
    id: string;
    timestamp: Date;
    status: string;
    message: string;
}

const StatusPage: React.FC = () => {
    const [services, setServices] = useState<ServiceHealth[]>([]);
    const [networks, setNetworks] = useState<NetworkInfo[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        const loadStatusData = async () => {
            // Simulate loading status data
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock services data - Statuspage style
            setServices([
                {
                    id: 'api',
                    name: 'API Gateway',
                    status: 'operational',
                    uptime: 99.98,
                    responseTime: 145,
                    lastChecked: new Date(),
                    description: 'Core API services for content delivery'
                },
                {
                    id: 'streaming',
                    name: 'Video Streaming',
                    status: 'operational',
                    uptime: 99.95,
                    responseTime: 89,
                    lastChecked: new Date(),
                    description: 'Live and on-demand video streaming'
                },
                {
                    id: 'storage',
                    name: 'Content Storage',
                    status: 'degraded',
                    uptime: 98.7,
                    responseTime: 234,
                    lastChecked: new Date(),
                    description: 'Distributed content storage network'
                },
                {
                    id: 'auth',
                    name: 'Authentication',
                    status: 'operational',
                    uptime: 99.99,
                    responseTime: 67,
                    lastChecked: new Date(),
                    description: 'User authentication and authorization'
                },
                {
                    id: 'payments',
                    name: 'Payment Processing',
                    status: 'operational',
                    uptime: 99.92,
                    responseTime: 178,
                    lastChecked: new Date(),
                    description: 'Cryptocurrency and fiat payment processing'
                },
                {
                    id: 'notifications',
                    name: 'Push Notifications',
                    status: 'partial_outage',
                    uptime: 97.3,
                    responseTime: 456,
                    lastChecked: new Date(),
                    description: 'Real-time push notification delivery'
                }
            ]);

            // Mock network data - Etherscan style
            setNetworks([
                {
                    id: 'ethereum',
                    name: 'Ethereum Mainnet',
                    chainId: 1,
                    blockHeight: 18750234,
                    gasPrice: 25.4,
                    tps: 13.2,
                    status: 'healthy',
                    lastBlock: new Date(Date.now() - 12000)
                },
                {
                    id: 'polygon',
                    name: 'Polygon',
                    chainId: 137,
                    blockHeight: 50123456,
                    gasPrice: 0.03,
                    tps: 45.8,
                    status: 'healthy',
                    lastBlock: new Date(Date.now() - 2000)
                },
                {
                    id: 'arbitrum',
                    name: 'Arbitrum One',
                    chainId: 42161,
                    blockHeight: 156789012,
                    gasPrice: 0.12,
                    tps: 78.3,
                    status: 'congested',
                    lastBlock: new Date(Date.now() - 8000)
                },
                {
                    id: 'base',
                    name: 'Base',
                    chainId: 8453,
                    blockHeight: 8234567,
                    gasPrice: 0.008,
                    tps: 92.1,
                    status: 'healthy',
                    lastBlock: new Date(Date.now() - 1500)
                }
            ]);

            // Mock incidents data
            setIncidents([
                {
                    id: 'inc-001',
                    title: 'Intermittent Push Notification Delays',
                    status: 'monitoring',
                    severity: 'minor',
                    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
                    affectedServices: ['notifications'],
                    updates: [
                        {
                            id: 'upd-001',
                            timestamp: new Date(Date.now() - 30 * 60 * 1000),
                            status: 'monitoring',
                            message: 'We have implemented a fix and are monitoring the situation. Notification delivery should be back to normal.'
                        },
                        {
                            id: 'upd-002',
                            timestamp: new Date(Date.now() - 90 * 60 * 1000),
                            status: 'identified',
                            message: 'We have identified the root cause as a configuration issue in our notification queue system.'
                        },
                        {
                            id: 'upd-003',
                            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                            status: 'investigating',
                            message: 'We are investigating reports of delayed push notifications affecting some users.'
                        }
                    ]
                }
            ]);

            setIsLoading(false);
        };

        loadStatusData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            setLastUpdated(new Date());
            // In a real app, this would refetch the data
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const overallStatus = React.useMemo(() => {
        const hasOutage = services.some(s => s.status === 'major_outage');
        const hasPartialOutage = services.some(s => s.status === 'partial_outage');
        const hasDegraded = services.some(s => s.status === 'degraded');

        if (hasOutage) return 'major_outage';
        if (hasPartialOutage) return 'partial_outage';
        if (hasDegraded) return 'degraded';
        return 'operational';
    }, [services]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="p-6">
                    <PageHeader id="status" title="System Status" />
                    <div className="animate-pulse space-y-6">
                        <div className="h-32 bg-muted rounded-lg"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-24 bg-muted rounded-lg"></div>
                            ))}
                        </div>
                        <div className="h-64 bg-muted rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <PageHeader id="status" title="System Status" />
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span>Auto-refresh enabled</span>
                            </div>
                            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* System Overview */}
                <SystemOverview 
                    overallStatus={overallStatus}
                    services={services}
                    networks={networks}
                    activeIncidents={incidents.filter(i => i.status !== 'resolved').length}
                />

                {/* Service Status Grid */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Icon name="activity" size={20} />
                        Service Status
                    </h2>
                    <ServiceStatus services={services} />
                </div>

                {/* Network Status - Etherscan style */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Icon name="cpu" size={20} />
                        Network Status
                    </h2>
                    <NetworkStatus networks={networks} />
                </div>

                {/* Performance Metrics */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Icon name="chart" size={20} />
                        Performance Metrics
                    </h2>
                    <PerformanceMetrics services={services} />
                </div>

                {/* Uptime History */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Icon name="clock" size={20} />
                        90-Day Uptime History
                    </h2>
                    <UptimeHistory services={services} />
                </div>

                {/* Incident Reports */}
                {incidents.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Icon name="info" size={20} />
                            Recent Incidents
                        </h2>
                        <IncidentReports incidents={incidents} />
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-8 text-sm text-muted-foreground border-t border-border">
                    <p>Status page powered by Reelverse • Real-time monitoring • Historical data available</p>
                    <p className="mt-2">
                        Subscribe to updates • 
                        <a href="#" className="text-primary hover:underline ml-1">RSS Feed</a> • 
                        <a href="#" className="text-primary hover:underline ml-1">API</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StatusPage;
