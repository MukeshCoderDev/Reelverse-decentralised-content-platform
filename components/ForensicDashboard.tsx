import React, { useState, useEffect } from 'react';
import { forensicWatermarkService, ForensicInvestigationDashboard, ForensicInvestigation } from '../services/forensicWatermarkService';

export const ForensicDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<ForensicInvestigationDashboard | null>(null);
  const [selectedInvestigation, setSelectedInvestigation] = useState<ForensicInvestigation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const dashboardData = await forensicWatermarkService.buildForensicDashboard();
      setDashboard(dashboardData);
    } catch (error) {
      console.error('Failed to load forensic dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigationClick = (investigation: ForensicInvestigation) => {
    setSelectedInvestigation(investigation);
  };

  const handleGenerateEvidence = async (investigationId: string) => {
    try {
      const evidenceUrl = await forensicWatermarkService.generateLegalEvidencePackage(investigationId);
      alert(`Evidence package generated: ${evidenceUrl}`);
    } catch (error) {
      console.error('Failed to generate evidence:', error);
      alert('Failed to generate evidence package');
    }
  };

  const handleInitiateDMCA = async (investigationId: string) => {
    try {
      const legalAction = await forensicWatermarkService.integrateWithDMCASystem(investigationId);
      alert(`DMCA notice initiated: ${legalAction.documentUrl}`);
      loadDashboard(); // Refresh data
    } catch (error) {
      console.error('Failed to initiate DMCA:', error);
      alert('Failed to initiate DMCA takedown');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load forensic dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold">Forensic Investigation Dashboard</h1>
        <p className="text-muted-foreground">Advanced anti-piracy and leak source analysis</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Investigations</h3>
          <p className="text-2xl font-bold">{dashboard.totalInvestigations}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Active Leaks</h3>
          <p className="text-2xl font-bold text-destructive">{dashboard.activeLeaks}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Resolved Cases</h3>
          <p className="text-2xl font-bold text-green-500">{dashboard.resolvedCases}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Avg Resolution Time</h3>
          <p className="text-2xl font-bold">{dashboard.averageResolutionTime.toFixed(1)}d</p>
        </div>
      </div>

      {/* Top Leak Sources */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Top Leak Sources</h2>
        <div className="space-y-3">
          {dashboard.topLeakSources.slice(0, 5).map((source, index) => (
            <div key={source.userId} className="flex items-center justify-between p-3 bg-muted rounded">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium">User {source.userId.slice(0, 8)}...</p>
                  <p className="text-sm text-muted-foreground">
                    {source.leakCount} leaks • Risk: {(source.riskScore * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">${source.totalDamage.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Est. damage</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Investigations */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Recent Investigations</h2>
        <div className="space-y-3">
          {dashboard.recentInvestigations.map((investigation) => (
            <div 
              key={investigation.id} 
              className="flex items-center justify-between p-3 bg-muted rounded cursor-pointer hover:bg-muted/80"
              onClick={() => handleInvestigationClick(investigation)}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  investigation.investigationStatus === 'confirmed_leak' ? 'bg-destructive' :
                  investigation.investigationStatus === 'resolved' ? 'bg-green-500' :
                  'bg-yellow-500'
                }`}></div>
                <div>
                  <p className="font-medium">Case {investigation.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {investigation.leakUrl.length > 50 
                      ? investigation.leakUrl.slice(0, 50) + '...' 
                      : investigation.leakUrl}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{(investigation.confidence * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Confidence</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Investigation Detail Modal */}
      {selectedInvestigation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Investigation Details</h2>
              <button 
                onClick={() => setSelectedInvestigation(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Case ID</p>
                  <p className="font-medium">{selectedInvestigation.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedInvestigation.investigationStatus.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="font-medium">{(selectedInvestigation.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Detected</p>
                  <p className="font-medium">{selectedInvestigation.detectedAt.toLocaleDateString()}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Leak URL</p>
                <p className="font-medium break-all">{selectedInvestigation.leakUrl}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Source User</p>
                <p className="font-medium">{selectedInvestigation.sourceUserId}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Evidence Package</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <p>Screenshots: {selectedInvestigation.evidencePackage.screenshots.length}</p>
                  <p>Legal Documents: {selectedInvestigation.evidencePackage.legalDocuments.length}</p>
                  <p>Blockchain Evidence: Available</p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleGenerateEvidence(selectedInvestigation.id)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Generate Evidence Package
                </button>
                <button 
                  onClick={() => handleInitiateDMCA(selectedInvestigation.id)}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                >
                  Initiate DMCA Takedown
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};