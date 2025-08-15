
import React from 'react';
import Button from '../Button';
import Icon from '../Icon';

export interface ContentRow {
  id: string;
  title: string;
  status: 'READY' | 'PAID' | 'PROCESSING' | 'UPLOADING' | 'ENCRYPTING' | 'TRANSCODING' | 'FAILED' | 'BLOCKED';
  views: number;
  storageClass?: 'shreddable' | 'permanent';
  encrypted?: boolean;
  watermarked?: boolean;
  blockchainId?: string;
  createdAt?: string;
  earnings?: number;
  consentStatus?: 'none' | 'pending' | 'completed';
  participantCount?: number;
}

interface ContentTableProps {
  rows: ContentRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewBlockchain?: (blockchainId: string) => void;
}

export function ContentTable({ rows, onEdit, onDelete, onViewBlockchain }: ContentTableProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'READY':
                return 'bg-green-100 text-green-700';
            case 'PAID':
                return 'bg-blue-100 text-blue-700';
            case 'PROCESSING':
            case 'UPLOADING':
            case 'ENCRYPTING':
            case 'TRANSCODING':
                return 'bg-yellow-100 text-yellow-700';
            case 'FAILED':
                return 'bg-red-100 text-red-700';
            case 'BLOCKED':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'READY':
                return 'check-circle';
            case 'PAID':
                return 'dollar-sign';
            case 'PROCESSING':
            case 'UPLOADING':
            case 'ENCRYPTING':
            case 'TRANSCODING':
                return 'loader';
            case 'FAILED':
                return 'x-circle';
            case 'BLOCKED':
                return 'shield-alert';
            default:
                return 'circle';
        }
    };

    if (rows.length === 0) {
        return (
            <div className="border rounded-lg p-8 text-center">
                <Icon name="video" size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h3>
                <p className="text-gray-600">Upload your first video to get started.</p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-gray-50">
                    <tr className="border-b">
                        <th className="p-3 text-left font-medium text-gray-700">Content</th>
                        <th className="p-3 text-left font-medium text-gray-700">Status</th>
                        <th className="p-3 text-left font-medium text-gray-700">Storage</th>
                        <th className="p-3 text-left font-medium text-gray-700">Views</th>
                        <th className="p-3 text-left font-medium text-gray-700">Earnings</th>
                        <th className="p-3 text-right font-medium text-gray-700">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="p-3">
                                <div>
                                    <div className="font-medium text-gray-900">{row.title}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {row.encrypted && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                <Icon name="lock" size={10} />
                                                Encrypted
                                            </span>
                                        )}
                                        {row.watermarked && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                                <Icon name="droplet" size={10} />
                                                Watermarked
                                            </span>
                                        )}
                                        {row.blockchainId && (
                                            <button
                                                onClick={() => onViewBlockchain?.(row.blockchainId!)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                                            >
                                                <Icon name="link" size={10} />
                                                On-Chain
                                            </button>
                                        )}
                                        {row.consentStatus && row.consentStatus !== 'none' && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                                row.consentStatus === 'completed' 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                <Icon name={row.consentStatus === 'completed' ? 'check-circle' : 'clock'} size={10} />
                                                {row.consentStatus === 'completed' 
                                                    ? `${row.participantCount || 0} Consents` 
                                                    : 'Consent Pending'
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="p-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getStatusColor(row.status)}`}>
                                    <Icon 
                                        name={getStatusIcon(row.status)} 
                                        size={12} 
                                        className={row.status.includes('ING') ? 'animate-spin' : ''}
                                    />
                                    {row.status}
                                </span>
                            </td>
                            <td className="p-3">
                                {row.storageClass && (
                                    <div className="flex items-center gap-1">
                                        <Icon 
                                            name={row.storageClass === 'permanent' ? 'archive' : 'trash-2'} 
                                            size={14} 
                                            className="text-gray-500"
                                        />
                                        <span className="text-gray-600 capitalize">
                                            {row.storageClass}
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className="p-3 text-gray-600">
                                {row.views.toLocaleString()}
                            </td>
                            <td className="p-3 text-gray-600">
                                {row.earnings !== undefined ? `$${row.earnings.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {onEdit && (
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => onEdit(row.id)}
                                        >
                                            <Icon name="edit" size={14} className="mr-1" />
                                            Edit
                                        </Button>
                                    )}
                                    {onDelete && row.status !== 'PROCESSING' && (
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => onDelete(row.id)}
                                            className="text-red-600 hover:text-red-700 hover:border-red-300"
                                        >
                                            <Icon name="trash-2" size={14} />
                                        </Button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
