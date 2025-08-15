import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { MigrationWizard } from './MigrationWizard';
import { MigrationService, ImportBatch } from '../../services/migrationService';

interface MigrationDashboardProps {
  organizationId?: string;
}

export const MigrationDashboard: React.FC<MigrationDashboardProps> = ({
  organizationId
}) => {
  const [showWizard, setShowWizard] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const migrationService = MigrationService.getInstance();

  useEffect(() => {
    loadImportHistory();
  }, [organizationId]);

  const loadImportHistory = async () => {
    try {
      setIsLoading(true);
      const history = await migrationService.getImportHistory(organizationId);
      setImportHistory(history);
    } catch (error) {
      console.error('Error loading import history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportComplete = (batch: ImportBatch) => {
    setImportHistory(prev => [batch, ...prev]);
    setShowWizard(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      case 'importing':
      case 'processing':
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getSourceIcon = (source: string, platform?: string) => {
    switch (source) {
      case 'csv':
        return 'file-text';
      case 'json':
        return 'code';
      case 'linkinbio':
        return 'link';
      default:
        return 'upload';
    }
  };

  const getSourceLabel = (source: string, platform?: string) => {
    if (source === 'linkinbio' && platform) {
      return `${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
    }
    return source.toUpperCase();
  };

  if (showWizard) {
    return (
      <MigrationWizard
        organizationId={organizationId}
        onComplete={handleImportComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className=\"space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-2xl font-bold text-white\">Content Migration</h1>
          <p className=\"text-gray-400 mt-1\">
            Import content from CSV, JSON, or link-in-bio platforms
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Icon name=\"plus\" className=\"w-4 h-4 mr-2\" />
          New Import
        </Button>
      </div>

      {/* Quick Stats */}
      <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"upload\" className=\"w-5 h-5 text-blue-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {importHistory.length}
              </div>
              <div className=\"text-gray-400 text-sm\">Total Imports</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"check\" className=\"w-5 h-5 text-green-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {importHistory.reduce((sum, batch) => sum + batch.importedItems, 0)}
              </div>
              <div className=\"text-gray-400 text-sm\">Items Imported</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"clock\" className=\"w-5 h-5 text-yellow-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {importHistory.filter(batch => batch.status === 'processing' || batch.status === 'importing').length}
              </div>
              <div className=\"text-gray-400 text-sm\">In Progress</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"x\" className=\"w-5 h-5 text-red-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {importHistory.reduce((sum, batch) => sum + batch.invalidItems, 0)}
              </div>
              <div className=\"text-gray-400 text-sm\">Failed Items</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Import Templates */}
      <Card className=\"p-6\">
        <h2 className=\"text-xl font-semibold text-white mb-4\">Import Templates</h2>
        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
          <div className=\"p-4 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors\">
            <div className=\"flex items-center mb-3\">
              <Icon name=\"file-text\" className=\"w-6 h-6 text-blue-400 mr-2\" />
              <h3 className=\"font-semibold text-white\">CSV Template</h3>
            </div>
            <p className=\"text-gray-400 text-sm mb-3\">
              Download a CSV template with all required and optional fields
            </p>
            <Button variant=\"secondary\" size=\"sm\">
              <Icon name=\"download\" className=\"w-4 h-4 mr-2\" />
              Download
            </Button>
          </div>

          <div className=\"p-4 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors\">
            <div className=\"flex items-center mb-3\">
              <Icon name=\"code\" className=\"w-6 h-6 text-green-400 mr-2\" />
              <h3 className=\"font-semibold text-white\">JSON Schema</h3>
            </div>
            <p className=\"text-gray-400 text-sm mb-3\">
              Download JSON schema for structured content import
            </p>
            <Button variant=\"secondary\" size=\"sm\">
              <Icon name=\"download\" className=\"w-4 h-4 mr-2\" />
              Download
            </Button>
          </div>

          <div className=\"p-4 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors\">
            <div className=\"flex items-center mb-3\">
              <Icon name=\"book\" className=\"w-6 h-6 text-purple-400 mr-2\" />
              <h3 className=\"font-semibold text-white\">Import Guide</h3>
            </div>
            <p className=\"text-gray-400 text-sm mb-3\">
              Step-by-step guide for preparing your content for import
            </p>
            <Button variant=\"secondary\" size=\"sm\">
              <Icon name=\"external-link\" className=\"w-4 h-4 mr-2\" />
              View Guide
            </Button>
          </div>
        </div>
      </Card>

      {/* Import History */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">Import History</h2>
          <Button variant=\"secondary\" size=\"sm\" onClick={loadImportHistory}>
            <Icon name=\"refresh-cw\" className=\"w-4 h-4 mr-2\" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className=\"text-center py-8\">
            <div className=\"animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4\"></div>
            <p className=\"text-gray-400\">Loading import history...</p>
          </div>
        ) : importHistory.length === 0 ? (
          <div className=\"text-center py-8\">
            <Icon name=\"upload\" className=\"w-12 h-12 text-gray-600 mx-auto mb-4\" />
            <p className=\"text-gray-400 mb-4\">No imports yet</p>
            <Button onClick={() => setShowWizard(true)}>
              Start Your First Import
            </Button>
          </div>
        ) : (
          <div className=\"space-y-4\">
            {importHistory.map((batch) => (
              <div
                key={batch.id}
                className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors\"
              >
                <div className=\"flex items-center space-x-4\">
                  <div className=\"w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center\">
                    <Icon 
                      name={getSourceIcon(batch.source, batch.platform)} 
                      className=\"w-5 h-5 text-gray-400\" 
                    />
                  </div>
                  <div>
                    <div className=\"flex items-center space-x-2\">
                      <h3 className=\"font-semibold text-white\">
                        {getSourceLabel(batch.source, batch.platform)} Import
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>
                    <p className=\"text-gray-400 text-sm\">
                      {formatDate(batch.createdAt)}
                      {batch.completedAt && batch.completedAt !== batch.createdAt && (
                        <span> • Completed {formatDate(batch.completedAt)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className=\"flex items-center space-x-6 text-sm\">
                  <div className=\"text-center\">
                    <div className=\"text-white font-semibold\">{batch.totalItems}</div>
                    <div className=\"text-gray-400\">Total</div>
                  </div>
                  <div className=\"text-center\">
                    <div className=\"text-green-400 font-semibold\">{batch.importedItems}</div>
                    <div className=\"text-gray-400\">Imported</div>
                  </div>
                  {batch.invalidItems > 0 && (
                    <div className=\"text-center\">
                      <div className=\"text-red-400 font-semibold\">{batch.invalidItems}</div>
                      <div className=\"text-gray-400\">Failed</div>
                    </div>
                  )}
                  <Button variant=\"secondary\" size=\"sm\">
                    <Icon name=\"eye\" className=\"w-4 h-4 mr-2\" />
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};