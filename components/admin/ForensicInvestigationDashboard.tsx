import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { 
  ForensicInvestigationReport, 
  WatermarkExtractionResult, 
  WatermarkAnalytics,
  watermarkService 
} from '../../services/watermarkService';

interface ForensicInvestigationDashboardProps {
  className?: string;
}

export const ForensicInvestigationDashboard: React.FC<ForensicInvestigationDashboardProps> = ({
  className = ''
}) => {
  const [investigations, setInvestigations] = useState<ForensicInvestigationReport[]>([]);
  const [analytics, setAnalytics] = useState<WatermarkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvestigation, setSelectedInvestigation] = useState<ForensicInvestigationReport | null>(null);
  const [leakUrl, setLeakUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadForensicData();
  }, []);

  const loadForensicData = async () => {
    try {
      setLoading(true);
      
      // Load analytics
      const analyticsData = await watermarkService.getWatermarkAnalytics();
      setAnalytics(analyticsData);
      
      // In a real implementation, this would load from a database
      setInvestigations([]);
      
    } catch (error) {
      console.error('Failed to load forensic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeLeakUrl = async () => {
    if (!leakUrl.trim()) return;
    
    try {
      setAnalyzing(true);
      
      // Extract watermark from suspected leak
      const extractionResult = await watermarkService.extractWatermarkFromVideo(leakUrl);
      
      if (extractionResult) {
        // Generate forensic report
        const report = await watermarkService.generateForensicReport(
          extractionResult,
          leakUrl
        );
        
        setInvestigations(prev => [report, ...prev]);
        setLeakUrl('');
        
        alert(`Watermark detected! User ID: ${extractionResult.userId}, Confidence: ${(extractionResult.confidence * 100).toFixed(1)}%`);
      } else {
        alert('No forensic watermark detected in this content.');
      }
      
    } catch (error) {
      console.error('Failed to analyze leak:', error);
      alert('Failed to analyze content for watermarks.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateInvestigationStatus = async (
    investigationId: string, 
    status: ForensicInvestigationReport['investigationStatus']
  ) => {
    setInvestigations(prev => 
      prev.map(inv => 
        inv.id === investigationId 
          ? { ...inv, investigationStatus: status }
          : inv
      )
    );
  };

  const getStatusColor = (status: ForensicInvestigationReport['investigationStatus']) => {
    switch (status) {
      case 'pending_review': return 'text-yellow-600';
      case 'confirmed_leak': return 'text-red-600';
      case 'false_positive': return 'text-gray-600';
      case 'legal_action': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Forensic Investigation Dashboard</h2>
        <Button onClick={loadForensicData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Watermarks</div>
            <div className="text-2xl font-bold text-gray-900">{analytics.totalWatermarks}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Unique Users</div>
            <div className="text-2xl font-bold text-gray-900">{analytics.uniqueUsers}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Active Sessions</div>
            <div className="text-2xl font-bold text-gray-900">{analytics.uniqueSessions}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Investigations</div>
            <div className="text-2xl font-bold text-gray-900">{investigations.length}</div>
          </Card>
        </div>
      )}

      {/* Leak Analysis Tool */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyze Suspected Leak</h3>
        <div className="flex gap-4">
          <input
            type="url"
            value={leakUrl}
            onChange={(e) => setLeakUrl(e.target.value)}
            placeholder="Enter suspected leak URL..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button 
            onClick={analyzeLeakUrl}
            disabled={analyzing || !leakUrl.trim()}
            className="min-w-[120px]"
          >
            {analyzing ? <Spinner size="sm" /> : 'Analyze'}
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Paste a URL to analyze content for forensic watermarks and identify the source user/session.
        </p>
      </Card>

      {/* Investigation Results */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Investigation Results</h3>
        
        {investigations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No forensic investigations yet. Analyze suspected leaks to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {investigations.map((investigation) => (
              <div 
                key={investigation.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedInvestigation(investigation)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="font-medium text-gray-900">
                        Investigation #{investigation.id.slice(0, 8)}
                      </span>
                      <span className={`text-sm font-medium ${getStatusColor(investigation.investigationStatus)}`}>
                        {investigation.investigationStatus.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(investigation.confidence)}`}>
                        {(investigation.confidence * 100).toFixed(1)}% confidence
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">User ID:</span> {investigation.sourceUserId}
                      </div>
                      <div>
                        <span className="font-medium">Session:</span> {investigation.sourceSessionId.slice(0, 8)}...
                      </div>
                      <div>
                        <span className="font-medium">Content:</span> {investigation.contentId}
                      </div>
                      <div>
                        <span className="font-medium">Detected:</span> {investigation.extractionTimestamp.toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Leak URL:</span> 
                      <a 
                        href={investigation.leakUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {investigation.leakUrl}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateInvestigationStatus(investigation.id, 'confirmed_leak');
                      }}
                    >
                      Confirm Leak
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateInvestigationStatus(investigation.id, 'legal_action');
                      }}
                    >
                      Legal Action
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Investigation Detail Modal */}
      {selectedInvestigation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Investigation Details
              </h3>
              <Button
                variant="outline"
                onClick={() => setSelectedInvestigation(null)}
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Investigation ID:</span>
                  <div className="text-gray-900">{selectedInvestigation.id}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Watermark ID:</span>
                  <div className="text-gray-900">{selectedInvestigation.watermarkId}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Source User ID:</span>
                  <div className="text-gray-900">{selectedInvestigation.sourceUserId}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Source Session:</span>
                  <div className="text-gray-900">{selectedInvestigation.sourceSessionId}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Content ID:</span>
                  <div className="text-gray-900">{selectedInvestigation.contentId}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Confidence:</span>
                  <div className={`font-medium ${getConfidenceColor(selectedInvestigation.confidence)}`}>
                    {(selectedInvestigation.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Original Timestamp:</span>
                  <div className="text-gray-900">{selectedInvestigation.originalTimestamp.toLocaleString()}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Extraction Timestamp:</span>
                  <div className="text-gray-900">{selectedInvestigation.extractionTimestamp.toLocaleString()}</div>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Evidence Hash:</span>
                <div className="text-gray-900 font-mono text-xs break-all bg-gray-100 p-2 rounded">
                  {selectedInvestigation.evidenceHash}
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Leak URL:</span>
                <div className="text-blue-600 break-all">
                  <a 
                    href={selectedInvestigation.leakUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {selectedInvestigation.leakUrl}
                  </a>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => updateInvestigationStatus(selectedInvestigation.id, 'confirmed_leak')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Confirm as Leak
                </Button>
                <Button
                  onClick={() => updateInvestigationStatus(selectedInvestigation.id, 'false_positive')}
                  variant="outline"
                >
                  Mark False Positive
                </Button>
                <Button
                  onClick={() => updateInvestigationStatus(selectedInvestigation.id, 'legal_action')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Initiate Legal Action
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};