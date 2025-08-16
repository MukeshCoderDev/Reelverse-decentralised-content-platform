import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { 
  ForensicInvestigation, 
  WatermarkExtractionResult,
  forensicWatermarkService 
} from '../services/forensicWatermarkService';

interface ForensicStats {
  totalWatermarks: number;
  activeInvestigations: number;
  successfulExtractions: number;
}

export const ForensicInvestigationDashboard: React.FC = () => {
  const [investigations, setInvestigations] = useState<ForensicInvestigation[]>([]);
  const [stats, setStats] = useState<ForensicStats | null>(null);
  const [selectedInvestigation, setSelectedInvestigation] = useState<ForensicInvestigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLeakUrl, setNewLeakUrl] = useState('');
  const [creatingInvestigation, setCreatingInvestigation] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load stats
      const statsData = await forensicWatermarkService.getWatermarkStats();
      setStats(statsData);
      
      // In a real implementation, we'd have an API to list all investigations
      // For now, we'll show empty state
      setInvestigations([]);
      
    } catch (error) {
      console.error('Failed to load forensic dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewInvestigation = async () => {
    if (!newLeakUrl.trim()) return;
    
    try {
      setCreatingInvestigation(true);
      
      // In production, this would fetch the leaked content
      const mockLeakContent = Buffer.from('mock leaked video content');
      
      const investigation = await forensicWatermarkService.createForensicInvestigation(
        newLeakUrl,
        mockLeakContent
      );
      
      setInvestigations(prev => [investigation, ...prev]);
      setNewLeakUrl('');
      
      // Refresh stats
      const updatedStats = await forensicWatermarkService.getWatermarkStats();
      setStats(updatedStats);
      
    } catch (error) {
      console.error('Failed to create investigation:', error);
    } finally {
      setCreatingInvestigation(false);
    }
  };

  const getStatusColor = (status: ForensicInvestigation['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'analyzing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'inconclusive': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: ForensicInvestigation['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'analyzing': return '🔍';
      case 'completed': return '✅';
      case 'inconclusive': return '❓';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading forensic dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Forensic Investigation Dashboard</h1>
        <div className="text-sm text-gray-400">
          Advanced anti-piracy and leak source tracking
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalWatermarks}</div>
              <div className="text-sm text-gray-400">Total Watermarks</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.activeInvestigations}</div>
              <div className="text-sm text-gray-400">Active Investigations</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.successfulExtractions}</div>
              <div className="text-sm text-gray-400">Successful Extractions</div>
            </div>
          </Card>
        </div>
      )}

      {/* Create New Investigation */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Create New Investigation</h2>
        <div className="flex gap-4">
          <input
            type="url"
            value={newLeakUrl}
            onChange={(e) => setNewLeakUrl(e.target.value)}
            placeholder="Enter suspected leak URL..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            onClick={createNewInvestigation}
            disabled={!newLeakUrl.trim() || creatingInvestigation}
            className="px-6"
          >
            {creatingInvestigation ? <Spinner size="sm" /> : 'Investigate'}
          </Button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Paste a URL of suspected leaked content to start forensic watermark analysis
        </p>
      </Card>

      {/* Investigations List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Investigations</h2>
          
          {investigations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>No investigations yet</p>
              <p className="text-sm">Create your first investigation above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investigations.map((investigation) => (
                <div
                  key={investigation.id}
                  className="p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => setSelectedInvestigation(investigation)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(investigation.status)}</span>
                      <div>
                        <div className="font-medium text-white truncate max-w-xs">
                          {investigation.leakUrl}
                        </div>
                        <div className="text-sm text-gray-400">
                          {investigation.extractedWatermarks.length} watermarks found
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${getStatusColor(investigation.status)}`}>
                      {investigation.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Investigation Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Investigation Details</h2>
          
          {selectedInvestigation ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-400">Investigation ID</label>
                <div className="text-white font-mono text-sm">{selectedInvestigation.id}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400">Leak URL</label>
                <div className="text-white break-all">{selectedInvestigation.leakUrl}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400">Status</label>
                <div className={`font-medium ${getStatusColor(selectedInvestigation.status)}`}>
                  {getStatusIcon(selectedInvestigation.status)} {selectedInvestigation.status}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400">Suspected Users</label>
                <div className="space-y-1">
                  {selectedInvestigation.suspectedUsers.length > 0 ? (
                    selectedInvestigation.suspectedUsers.map((userId, index) => (
                      <div key={index} className="text-white font-mono text-sm bg-red-900/20 px-2 py-1 rounded">
                        {userId}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">No users identified</div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400">Extracted Watermarks</label>
                <div className="space-y-2">
                  {selectedInvestigation.extractedWatermarks.map((watermark, index) => (
                    <div key={index} className="bg-gray-800 p-3 rounded">
                      <div className="text-sm">
                        <div className="text-white">ID: {watermark.watermarkId}</div>
                        <div className="text-gray-400">Session: {watermark.sessionId}</div>
                        <div className="text-green-400">Confidence: {(watermark.confidence * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400">Evidence Package</label>
                <textarea
                  value={selectedInvestigation.evidencePackage}
                  readOnly
                  className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-xs font-mono"
                />
              </div>
              
              <Button className="w-full">
                Download Evidence Package
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <p>Select an investigation to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};