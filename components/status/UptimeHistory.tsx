import React from 'react';
import { ServiceHealth } from '../../pages/StatusPage';
import Icon from '../Icon';

interface UptimeHistoryProps {
    services: ServiceHealth[];
}

export const UptimeHistory: React.FC<UptimeHistoryProps> = ({ services }) => {
    // Generate mock uptime data for the last 90 days
    const generateUptimeData = (serviceId: string) => {
        const days = [];
        const today = new Date();
        
        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Generate realistic uptime data with occasional outages
            let status: 'up' | 'down' | 'degraded' = 'up';
            const random = Math.random();
            
            if (serviceId === 'storage' && random < 0.05) {
                status = 'degraded';
            } else if (serviceId === 'notifications' && random < 0.03) {
                status = 'down';
            } else if (random < 0.01) {
                status = 'degraded';
            }
            
            days.push({
                date,
                status,
                uptime: status === 'up' ? 100 : status === 'degraded' ? 85 + Math.random() * 10 : 0
            });
        }
        
        return days;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'up':
                return 'bg-green-500';
            case 'degraded':
                return 'bg-yellow-500';
            case 'down':
                return 'bg-red-500';
            default:
                return 'bg-gray-300';
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    };

    return (
        <div className="space-y-6">
            {services.map((service) => {
                const uptimeData = generateUptimeData(service.id);
                const avgUptime = uptimeData.reduce((acc, day) => acc + day.uptime, 0) / uptimeData.length;
                const incidents = uptimeData.filter(day => day.status !== 'up').length;
                
                return (
                    <div key={service.id} className="p-4 bg-card border border-border rounded-lg">
                        {/* Service Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <h3 className="font-medium">{service.name}</h3>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>{avgUptime.toFixed(2)}% uptime</span>
                                    <span>{incidents} incidents</span>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                90 days
                            </div>
                        </div>

                        {/* Uptime Calendar */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatDate(uptimeData[0].date)}</span>
                                <span>Today</span>
                            </div>
                            
                            <div className="grid grid-cols-30 gap-1">
                                {uptimeData.map((day, index) => (
                                    <div
                                        key={index}
                                        className={`w-3 h-3 rounded-sm ${getStatusColor(day.status)} hover:scale-110 transition-transform cursor-pointer`}
                                        title={`${formatDate(day.date)}: ${day.uptime.toFixed(1)}% uptime (${day.status})`}
                                    ></div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                                    <span className="text-muted-foreground">Operational</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-sm"></div>
                                    <span className="text-muted-foreground">Degraded</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
                                    <span className="text-muted-foreground">Outage</span>
                                </div>
                            </div>
                            
                            {/* Recent incidents summary */}
                            {incidents > 0 && (
                                <div className="text-xs text-muted-foreground">
                                    {incidents} incident{incidents !== 1 ? 's' : ''} in 90 days
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Overall Summary */}
            <div className="p-4 bg-muted/30 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon name="trending-up" size={20} className="text-green-500" />
                        <div>
                            <h3 className="font-medium">Overall System Reliability</h3>
                            <p className="text-sm text-muted-foreground">
                                Average uptime across all services over the last 90 days
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-green-500">
                            {(services.reduce((acc, s) => acc + s.uptime, 0) / services.length).toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Target: 99.9%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};