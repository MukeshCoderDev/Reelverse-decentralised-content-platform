import React from 'react';
import { ServiceHealth } from '../../pages/StatusPage';
import Icon from '../Icon';

interface ServiceStatusProps {
    services: ServiceHealth[];
}

export const ServiceStatus: React.FC<ServiceStatusProps> = ({ services }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'operational':
                return 'text-green-500 bg-green-500';
            case 'degraded':
                return 'text-yellow-500 bg-yellow-500';
            case 'partial_outage':
                return 'text-orange-500 bg-orange-500';
            case 'major_outage':
                return 'text-red-500 bg-red-500';
            default:
                return 'text-gray-500 bg-gray-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'operational':
                return 'Operational';
            case 'degraded':
                return 'Degraded Performance';
            case 'partial_outage':
                return 'Partial Outage';
            case 'major_outage':
                return 'Major Outage';
            default:
                return 'Unknown';
        }
    };

    const getServiceIcon = (serviceId: string) => {
        switch (serviceId) {
            case 'api':
                return 'cpu';
            case 'streaming':
                return 'video';
            case 'storage':
                return 'folder';
            case 'auth':
                return 'shield-check';
            case 'payments':
                return 'credit-card';
            case 'notifications':
                return 'bell';
            default:
                return 'activity';
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
                <div key={service.id} className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
                    {/* Service Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <Icon name={getServiceIcon(service.id) as any} size={20} className="text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">{service.name}</h3>
                                <p className="text-xs text-muted-foreground">{service.description}</p>
                            </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status).split(' ')[1]}`}></div>
                            <span className={`text-sm font-medium ${getStatusColor(service.status).split(' ')[0]}`}>
                                {getStatusText(service.status)}
                            </span>
                        </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <div className="text-sm text-muted-foreground">Uptime</div>
                            <div className="text-lg font-semibold text-green-500">
                                {service.uptime.toFixed(2)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Response Time</div>
                            <div className="text-lg font-semibold">
                                {service.responseTime}ms
                            </div>
                        </div>
                    </div>

                    {/* Last Checked */}
                    <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Last checked</span>
                            <span>{service.lastChecked.toLocaleTimeString()}</span>
                        </div>
                    </div>

                    {/* Status-specific alerts */}
                    {service.status !== 'operational' && (
                        <div className={`mt-3 p-2 rounded text-xs ${
                            service.status === 'degraded' 
                                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                : 'bg-red-500/10 text-red-600 border border-red-500/20'
                        }`}>
                            {service.status === 'degraded' && 'Service is experiencing slower than normal response times.'}
                            {service.status === 'partial_outage' && 'Some users may experience issues with this service.'}
                            {service.status === 'major_outage' && 'This service is currently unavailable.'}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};