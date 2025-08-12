import React from 'react';
import { ServiceHealth, NetworkInfo } from '../../pages/StatusPage';
import Icon from '../Icon';

interface SystemOverviewProps {
    overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
    services: ServiceHealth[];
    networks: NetworkInfo[];
    activeIncidents: number;
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({
    overallStatus,
    services,
    networks,
    activeIncidents
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'operational':
            case 'healthy':
                return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'degraded':
            case 'congested':
                return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'partial_outage':
            case 'unstable':
                return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'major_outage':
                return 'text-red-500 bg-red-500/10 border-red-500/20';
            default:
                return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'operational':
            case 'healthy':
                return 'check';
            case 'degraded':
            case 'congested':
                return 'clock';
            case 'partial_outage':
            case 'unstable':
                return 'info';
            case 'major_outage':
                return 'x';
            default:
                return 'activity';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'operational':
                return 'All Systems Operational';
            case 'degraded':
                return 'Degraded Performance';
            case 'partial_outage':
                return 'Partial Service Outage';
            case 'major_outage':
                return 'Major Service Outage';
            default:
                return 'Unknown Status';
        }
    };

    const operationalServices = services.filter(s => s.status === 'operational').length;
    const healthyNetworks = networks.filter(n => n.status === 'healthy').length;
    const avgUptime = services.reduce((acc, s) => acc + s.uptime, 0) / services.length;

    return (
        <div className="space-y-6">
            {/* Main Status Banner - Statuspage style */}
            <div className={`p-6 rounded-lg border-2 ${getStatusColor(overallStatus)}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-current/10">
                            <Icon name={getStatusIcon(overallStatus) as any} size={32} className="text-current" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-current">
                                {getStatusText(overallStatus)}
                            </h1>
                            <p className="text-current/80 mt-1">
                                {overallStatus === 'operational' 
                                    ? 'All systems are running smoothly'
                                    : 'Some services are experiencing issues'
                                }
                            </p>
                        </div>
                    </div>
                    
                    {/* Status indicator */}
                    <div className="text-right">
                        <div className="flex items-center gap-2 text-current">
                            <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
                            <span className="font-medium">Live Status</span>
                        </div>
                        <p className="text-sm text-current/80 mt-1">
                            Updated every 30 seconds
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Services Status */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm text-muted-foreground">Services</h3>
                        <Icon name="activity" size={16} className="text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">
                        {operationalServices}/{services.length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Operational
                    </p>
                </div>

                {/* Networks Status */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm text-muted-foreground">Networks</h3>
                        <Icon name="cpu" size={16} className="text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">
                        {healthyNetworks}/{networks.length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Healthy
                    </p>
                </div>

                {/* Average Uptime */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm text-muted-foreground">Avg Uptime</h3>
                        <Icon name="trending-up" size={16} className="text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold text-green-500">
                        {avgUptime.toFixed(2)}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Last 30 days
                    </p>
                </div>

                {/* Active Incidents */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm text-muted-foreground">Incidents</h3>
                        <Icon name="info" size={16} className="text-muted-foreground" />
                    </div>
                    <div className={`text-2xl font-bold ${activeIncidents > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                        {activeIncidents}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Active
                    </p>
                </div>
            </div>

            {/* Active Incidents Alert */}
            {activeIncidents > 0 && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Icon name="info" size={20} className="text-orange-500" />
                        <div>
                            <h3 className="font-medium text-orange-500">
                                {activeIncidents} Active Incident{activeIncidents !== 1 ? 's' : ''}
                            </h3>
                            <p className="text-sm text-orange-500/80">
                                We are currently investigating and working to resolve ongoing issues.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};