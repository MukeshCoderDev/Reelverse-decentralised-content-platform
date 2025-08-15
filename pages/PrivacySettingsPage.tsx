import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { Card } from '../components/ui/Card';
import CookieConsentManager from '../components/privacy/CookieConsentManager';

interface ConsentStatus {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
  third_party: boolean;
  data_processing: boolean;
}

interface DataActivity {
  id: string;
  accessedBy: string;
  accessType: 'view' | 'export' | 'modify' | 'delete';
  dataTypes: string[];
  purpose: string;
  ipAddress: string;
  timestamp: string;
}

interface ExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exportType: 'gdpr' | 'ccpa' | 'custom';
  dataTypes: string[];
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
  errorMessage?: string;
}

const PrivacySettingsPage: React.FC = () => {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [dataActivities, setDataActivities] = useState<DataActivity[]>([]);
  const [exportRequests, setExportRequests] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCookieManager, setShowCookieManager] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadPrivacyData();
  }, []);

  const loadPrivacyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load consent status
      const consentResponse = await fetch('/api/v1/privacy/consent');
      if (consentResponse.ok) {
        const consentData = await consentResponse.json();
        setConsentStatus(consentData.consentStatus);
      }

      // Load data activities
      const activitiesResponse = await fetch('/api/v1/privacy/data-activities?limit=20');
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setDataActivities(activitiesData.activities || []);
      }

      // Load export requests (would need to implement this endpoint)
      // const exportResponse = await fetch('/api/v1/privacy/export-requests');
      // if (exportResponse.ok) {
      //   const exportData = await exportResponse.json();
      //   setExportRequests(exportData.requests || []);
      // }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load privacy data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (exportType: 'gdpr' | 'ccpa', dataTypes: string[]) => {
    try {
      const response = await fetch('/api/v1/privacy/data-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportType,
          dataTypes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data export');
      }

      const result = await response.json();
      alert(`Data export request created successfully. Request ID: ${result.requestId}`);
      setShowExportModal(false);
      
    } catch (err) {
      alert(`Failed to request data export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteData = async (deletionType: 'full' | 'partial', dataTypes: string[] = []) => {
    try {
      const response = await fetch('/api/v1/privacy/data-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deletionType,
          dataTypes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data deletion');
      }

      const result = await response.json();
      alert(result.message);
      setShowDeleteModal(false);
      
    } catch (err) {
      alert(`Failed to request data deletion: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your privacy preferences, data, and consent settings
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        <div className="space-y-6">
          {/* Cookie Consent */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Cookie Preferences</h2>
                <p className="text-gray-600 mt-1">
                  Manage your cookie and tracking preferences
                </p>
              </div>
              <Button
                onClick={() => setShowCookieManager(true)}
                variant="outline"
              >
                Manage Cookies
              </Button>
            </div>

            {consentStatus && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(consentStatus).map(([type, granted]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium capitalize">
                      {type.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      granted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {granted ? 'Granted' : 'Denied'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Data Export */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Data Export</h2>
                <p className="text-gray-600 mt-1">
                  Download a copy of your personal data (GDPR/CCPA compliance)
                </p>
              </div>
              <Button
                onClick={() => setShowExportModal(true)}
              >
                Request Export
              </Button>
            </div>

            {exportRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Recent Export Requests</h3>
                {exportRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">
                        {request.exportType.toUpperCase()} Export
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested: {new Date(request.requestedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        request.status === 'completed' ? 'bg-green-100 text-green-800' :
                        request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        request.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {request.status}
                      </span>
                      {request.status === 'completed' && request.downloadUrl && (
                        <Button size="sm" variant="outline">
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Data Deletion */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Data Deletion</h2>
                <p className="text-gray-600 mt-1">
                  Request deletion of your personal data (Right to be forgotten)
                </p>
              </div>
              <Button
                onClick={() => setShowDeleteModal(true)}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Delete Data
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Important Notice
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Data deletion is permanent and cannot be undone. Some data may be retained 
                      for legal compliance purposes. You will receive an email to verify your 
                      deletion request.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Data Activities */}
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Data Access History</h2>
              <p className="text-gray-600 mt-1">
                Recent activities involving your personal data
              </p>
            </div>

            {dataActivities.length > 0 ? (
              <div className="space-y-3">
                {dataActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">
                        {activity.accessType.charAt(0).toUpperCase() + activity.accessType.slice(1)} - {activity.purpose}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()} • IP: {activity.ipAddress}
                      </div>
                      <div className="text-xs text-gray-500">
                        Data types: {activity.dataTypes.join(', ')}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      By: {activity.accessedBy === activity.id ? 'You' : 'System'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No data access activities recorded
              </div>
            )}
          </Card>

          {/* Privacy Rights */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Privacy Rights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-900">Right to Access</h3>
                  <p className="text-sm text-gray-600">
                    You can request a copy of your personal data we hold
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Right to Rectification</h3>
                  <p className="text-sm text-gray-600">
                    You can request correction of inaccurate personal data
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Right to Erasure</h3>
                  <p className="text-sm text-gray-600">
                    You can request deletion of your personal data
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-900">Right to Portability</h3>
                  <p className="text-sm text-gray-600">
                    You can export your data in a machine-readable format
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Right to Restriction</h3>
                  <p className="text-sm text-gray-600">
                    You can request limitation of processing your data
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Right to Object</h3>
                  <p className="text-sm text-gray-600">
                    You can object to processing based on legitimate interests
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">Contact Data Protection Officer</h3>
              <p className="text-sm text-gray-600">
                For privacy-related questions or to exercise your rights, contact us at{' '}
                <a href="mailto:privacy@reelverse.com" className="text-blue-600 hover:text-blue-800">
                  privacy@reelverse.com
                </a>
              </p>
            </div>
          </Card>
        </div>

        {/* Cookie Consent Manager Modal */}
        {showCookieManager && (
          <CookieConsentManager
            showBanner={false}
            onConsentChange={(preferences) => {
              console.log('Consent preferences updated:', preferences);
              loadPrivacyData(); // Reload to get updated consent status
            }}
          />
        )}

        {/* Export Modal */}
        {showExportModal && (
          <ExportDataModal
            onClose={() => setShowExportModal(false)}
            onExport={handleExportData}
          />
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <DeleteDataModal
            onClose={() => setShowDeleteModal(false)}
            onDelete={handleDeleteData}
          />
        )}
      </div>
    </div>
  );
};

// Export Data Modal Component
interface ExportDataModalProps {
  onClose: () => void;
  onExport: (exportType: 'gdpr' | 'ccpa', dataTypes: string[]) => void;
}

const ExportDataModal: React.FC<ExportDataModalProps> = ({ onClose, onExport }) => {
  const [exportType, setExportType] = useState<'gdpr' | 'ccpa'>('gdpr');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([
    'profile', 'content', 'financial', 'analytics'
  ]);

  const dataTypes = [
    { id: 'profile', label: 'Profile Information', description: 'Name, email, bio, avatar' },
    { id: 'content', label: 'Content Data', description: 'Uploaded videos, images, metadata' },
    { id: 'financial', label: 'Financial Data', description: 'Transactions, earnings, payouts' },
    { id: 'analytics', label: 'Analytics Data', description: 'View counts, engagement metrics' },
    { id: 'communications', label: 'Communications', description: 'Messages, notifications' },
    { id: 'verification', label: 'Verification Data', description: 'Identity verification records' },
    { id: 'consent', label: 'Consent Records', description: 'Cookie and privacy preferences' },
    { id: 'logs', label: 'Access Logs', description: 'Login history, access records' },
  ];

  const handleDataTypeToggle = (dataType: string) => {
    setSelectedDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(t => t !== dataType)
        : [...prev, dataType]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Your Data</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Export Type */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Export Type</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="gdpr"
                    checked={exportType === 'gdpr'}
                    onChange={(e) => setExportType(e.target.value as 'gdpr')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">GDPR Export</div>
                    <div className="text-sm text-gray-600">
                      Complete data export as required by GDPR Article 20
                    </div>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="ccpa"
                    checked={exportType === 'ccpa'}
                    onChange={(e) => setExportType(e.target.value as 'ccpa')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">CCPA Export</div>
                    <div className="text-sm text-gray-600">
                      Data export as required by California Consumer Privacy Act
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Types */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Data to Include</h3>
              <div className="space-y-3">
                {dataTypes.map((dataType) => (
                  <label key={dataType.id} className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedDataTypes.includes(dataType.id)}
                      onChange={() => handleDataTypeToggle(dataType.id)}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium">{dataType.label}</div>
                      <div className="text-sm text-gray-600">{dataType.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={() => onExport(exportType, selectedDataTypes)}
              disabled={selectedDataTypes.length === 0}
            >
              Request Export
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Delete Data Modal Component
interface DeleteDataModalProps {
  onClose: () => void;
  onDelete: (deletionType: 'full' | 'partial', dataTypes?: string[]) => void;
}

const DeleteDataModal: React.FC<DeleteDataModalProps> = ({ onClose, onDelete }) => {
  const [deletionType, setDeletionType] = useState<'full' | 'partial'>('partial');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState('');

  const dataTypes = [
    { id: 'profile', label: 'Profile Information' },
    { id: 'content', label: 'Content Data' },
    { id: 'analytics', label: 'Analytics Data' },
    { id: 'communications', label: 'Communications' },
    { id: 'logs', label: 'Access Logs' },
  ];

  const handleDataTypeToggle = (dataType: string) => {
    setSelectedDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(t => t !== dataType)
        : [...prev, dataType]
    );
  };

  const canDelete = deletionType === 'full' 
    ? confirmText === 'DELETE MY ACCOUNT'
    : selectedDataTypes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <Card className="w-full max-w-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Delete Your Data</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    ⚠️ Warning: This action cannot be undone
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      Data deletion is permanent. Some data may be retained for legal compliance.
                      You will receive an email to verify this request.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Deletion Type */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Deletion Type</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="partial"
                    checked={deletionType === 'partial'}
                    onChange={(e) => setDeletionType(e.target.value as 'partial')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Partial Deletion</div>
                    <div className="text-sm text-gray-600">
                      Delete specific types of data while keeping your account
                    </div>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="full"
                    checked={deletionType === 'full'}
                    onChange={(e) => setDeletionType(e.target.value as 'full')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-red-600">Full Account Deletion</div>
                    <div className="text-sm text-gray-600">
                      Permanently delete your entire account and all associated data
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Types (for partial deletion) */}
            {deletionType === 'partial' && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Data to Delete</h3>
                <div className="space-y-2">
                  {dataTypes.map((dataType) => (
                    <label key={dataType.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDataTypes.includes(dataType.id)}
                        onChange={() => handleDataTypeToggle(dataType.id)}
                        className="mr-3"
                      />
                      <span>{dataType.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation (for full deletion) */}
            {deletionType === 'full' && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Confirmation</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Type <strong>DELETE MY ACCOUNT</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="DELETE MY ACCOUNT"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={() => onDelete(deletionType, selectedDataTypes)}
              disabled={!canDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletionType === 'full' ? 'Delete Account' : 'Delete Selected Data'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PrivacySettingsPage;