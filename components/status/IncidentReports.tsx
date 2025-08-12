import React, { useState } from 'react';
import { Incident } from '../../pages/StatusPage';
import Icon from '../Icon';

interface IncidentReportsProps {
    incidents: Incident[];
}

export const IncidentReports: React.FC<IncidentReportsProps> = ({ incidents }) => {
    const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'investigating':
                return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'identified':
                return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'monitoring':
                return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'resolved':
                return 'text-green-500 bg-green-500/10 border-green-500/20';
            default:
                return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'minor':
                return 'text-blue-500 bg-blue-500/10';
            case 'major':
                return 'text-orange-500 bg-orange-500/10';
            case 'critical':
                return 'text-red-500 bg-red-500/10';
            default:
                return 'text-gray-500 bg-gray-500/10';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'investigating':
                return 'search';
            case 'identified':
                return 'info';
            case 'monitoring':
                return 'eye';
            case 'resolved':
                return 'check';
            default:
                return 'activity';
        }
    };

    const formatDuration = (start: Date, end?: Date) => {
        const endTime = end || new Date();
        const diffMs = endTime.getTime() - start.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    };

    const formatTime = (date: Date) => {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="space-y-4">
            {incidents.map((incident) => (
                <div key={incident.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    {/* Incident Header */}
                    <div 
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedIncident(
                            expandedIncident === incident.id ? null : incident.id
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(incident.status)}`}>
                                        <Icon name={getStatusIcon(incident.status) as any} size={12} className="inline mr-1" />
                                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                                    </div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                                        {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                                    </div>
                                </div>
                                
                                <h3 className="font-medium text-lg mb-1">{incident.title}</h3>
                                
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>Started {formatTime(incident.startTime)}</span>
                                    <span>Duration: {formatDuration(incident.startTime, incident.endTime)}</span>
                                    {incident.affectedServices.length > 0 && (
                                        <span>Affects: {incident.affectedServices.join(', ')}</span>
                                    )}
                                </div>
                            </div>
                            
                            <Icon 
                                name={expandedIncident === incident.id ? 'chevron-left' : 'chevron-right'} 
                                size={16} 
                                className="text-muted-foreground transform transition-transform"
                                style={{ 
                                    transform: expandedIncident === incident.id ? 'rotate(90deg)' : 'rotate(0deg)' 
                                }}
                            />
                        </div>
                    </div>

                    {/* Incident Timeline */}
                    {expandedIncident === incident.id && (
                        <div className="border-t border-border">
                            <div className="p-4">
                                <h4 className="font-medium mb-4 flex items-center gap-2">
                                    <Icon name="clock" size={16} />
                                    Incident Timeline
                                </h4>
                                
                                <div className="space-y-4">
                                    {incident.updates.map((update, index) => (
                                        <div key={update.id} className="flex gap-4">
                                            {/* Timeline indicator */}
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full border-2 ${getStatusColor(update.status).split(' ')[0]} ${getStatusColor(update.status).split(' ')[1]}`}></div>
                                                {index < incident.updates.length - 1 && (
                                                    <div className="w-px h-8 bg-border mt-2"></div>
                                                )}
                                            </div>
                                            
                                            {/* Update content */}
                                            <div className="flex-1 pb-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-sm font-medium ${getStatusColor(update.status).split(' ')[0]}`}>
                                                        {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {formatTime(update.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-foreground">
                                                    {update.message}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* No incidents message */}
            {incidents.length === 0 && (
                <div className="text-center py-8">
                    <Icon name="check" size={48} className="mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-medium mb-2">No Recent Incidents</h3>
                    <p className="text-muted-foreground">
                        All systems have been running smoothly. No incidents to report in the last 30 days.
                    </p>
                </div>
            )}

            {/* Subscribe to updates */}
            <div className="p-4 bg-muted/30 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium mb-1">Stay Updated</h3>
                        <p className="text-sm text-muted-foreground">
                            Get notified about incidents and maintenance windows
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                            Subscribe
                        </button>
                        <button className="px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                            RSS Feed
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};