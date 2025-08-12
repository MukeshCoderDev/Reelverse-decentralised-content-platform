import React from 'react';
import { ServiceHealth } from '../../pages/StatusPage';
import Icon from '../Icon';

interface PerformanceMetricsProps {
    services: ServiceHealth[];
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ services }) => {
    // Calculate aggregate metrics
    const avgResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;
    const avgUptime = services.reduce((acc, s) => acc + s.uptime, 0) / services.length;
    
    // Mock additional performance data
    const performanceData = {
        throughput: 1247,
        errorRate: 0.12,
        p95ResponseTime: Math.max(...services.map(s => s.responseTime)) * 1.5,
        activeConnections: 8934,
        dataTransfer: 2.4, // GB/hour
        cacheHitRate: 94.7
    };

    const getResponseTimeColor = (time: number) => {
        if (time < 100) return 'text-green-500';
        if (time < 300) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getUptimeColor = (uptime: number) => {
        if (uptime >= 99.9) return 'text-green-500';
        if (uptime >= 99.0) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <div className="space-y-6">
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Avg Response Time</h3>
                        <Icon name="clock" size={16} className="text-muted-foreground" />
                    </div>
                    <div className={`text-2xl font-bold ${getResponseTimeColor(avgResponseTime)}`}>
                        {Math.round(avgResponseTime)}ms
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Target: &lt;200ms
                    </div>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">System Uptime</h3>
                        <Icon name="trending-up" size={16} className="text-muted-foreground" />
                    </div>
                    <div className={`text-2xl font-bold ${getUptimeColor(avgUptime)}`}>
                        {avgUptime.toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Target: &gt;99.9%
                    </div>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Throughput</h3>
                        <Icon name="activity" size={16} className="text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold text-blue-500">
                        {performanceData.throughput.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Requests/min
                    </div>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Error Rate</h3>
                        <Icon name="info" size={16} className="text-muted-foreground" />
                    </div>
                    <div className={`text-2xl font-bold ${performanceData.errorRate < 0.5 ? 'text-green-500' : 'text-red-500'}`}>
                        {performanceData.errorRate}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Target: &lt;0.5%
                    </div>
                </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Response Time Breakdown */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Icon name="clock" size={16} />
                        Response Time Breakdown
                    </h3>
                    <div className="space-y-3">
                        {services.map((service) => (
                            <div key={service.id} className="flex items-center justify-between">
                                <span className="text-sm">{service.name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-muted rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${getResponseTimeColor(service.responseTime).replace('text-', 'bg-')}`}
                                            style={{ width: `${Math.min(100, (service.responseTime / 500) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className={`text-sm font-mono ${getResponseTimeColor(service.responseTime)}`}>
                                        {service.responseTime}ms
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Resources */}
                <div className="p-4 bg-card border border-border rounded-lg">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Icon name="cpu" size={16} />
                        System Resources
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Active Connections</span>
                            <span className="text-sm font-semibold">
                                {performanceData.activeConnections.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Data Transfer</span>
                            <span className="text-sm font-semibold">
                                {performanceData.dataTransfer} GB/hour
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Cache Hit Rate</span>
                            <span className="text-sm font-semibold text-green-500">
                                {performanceData.cacheHitRate}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">P95 Response Time</span>
                            <span className="text-sm font-semibold">
                                {Math.round(performanceData.p95ResponseTime)}ms
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Trends */}
            <div className="p-4 bg-card border border-border rounded-lg">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Icon name="chart" size={16} />
                    24-Hour Performance Trend
                </h3>
                <div className="h-32 bg-muted/30 rounded-lg flex items-end justify-center p-4">
                    <div className="flex items-end gap-1 h-full">
                        {Array.from({ length: 24 }).map((_, i) => {
                            const height = Math.random() * 80 + 20;
                            const isGood = height < 60;
                            return (
                                <div
                                    key={i}
                                    className={`w-2 rounded-t ${isGood ? 'bg-green-500' : 'bg-yellow-500'}`}
                                    style={{ height: `${height}%` }}
                                    title={`${i}:00 - ${Math.round(height * 5)}ms avg response time`}
                                ></div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>00:00</span>
                    <span>12:00</span>
                    <span>24:00</span>
                </div>
            </div>
        </div>
    );
};