import React, { useState, useCallback } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { MigrationService, ImportBatch, ImportSettings, ContentImportItem } from '../../services/migrationService';

interface MigrationWizardProps {
  organizationId?: string;
  onComplete?: (batch: ImportBatch) => void;
  onCancel?: () => void;
}

type WizardStep = 'source' | 'upload' | 'validate' | 'settings' | 'import' | 'complete';

export const MigrationWizard: React.FC<MigrationWizardProps> = ({
  organizationId,
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');
  const [importSource, setImportSource] = useState<'csv' | 'json' | 'linkinbio'>('csv');
  const [currentBatch, setCurrentBatch] = useState<ImportBatch | null>(null);
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    autoPublish: false,
    defaultStorageClass: 'shreddable',
    enableEncryption: true,
    enableWatermarking: false,
    defaultAgeRating: '18+',
    categoryMapping: {},
    tagMapping: {},
    skipDuplicates: true
  });
  const [linkInBioData, setLinkInBioData] = useState({
    platform: 'linktree',
    username: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const migrationService = MigrationService.getInstance();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      let batch: ImportBatch;
      
      if (importSource === 'csv') {
        batch = await migrationService.parseCSVFile(file, organizationId);
      } else {
        batch = await migrationService.parseJSONFile(file, organizationId);
      }
      
      setCurrentBatch(batch);
      setCurrentStep('validate');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to parse file. Please check the format and try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [importSource, organizationId, migrationService]);

  const handleLinkInBioImport = useCallback(async () => {
    if (!linkInBioData.username.trim()) {
      alert('Please enter a username');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = await migrationService.importFromLinkInBio(
        linkInBioData.platform,
        linkInBioData.username,
        organizationId
      );
      
      setCurrentBatch(batch);
      setCurrentStep('validate');
    } catch (error) {
      console.error('Error importing from link-in-bio:', error);
      alert('Failed to import from link-in-bio platform. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [linkInBioData, organizationId, migrationService]);

  const handleValidation = useCallback(async () => {
    if (!currentBatch) return;

    setIsProcessing(true);
    try {
      const validatedBatch = await migrationService.validateBatch(currentBatch.id);
      setCurrentBatch(validatedBatch);
      setCurrentStep('settings');
    } catch (error) {
      console.error('Error validating batch:', error);
      alert('Failed to validate import batch. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [currentBatch, migrationService]);

  const handleStartImport = useCallback(async () => {
    if (!currentBatch) return;

    setIsProcessing(true);
    try {
      await migrationService.startImport(currentBatch.id, importSettings);
      setCurrentStep('complete');
      onComplete?.(currentBatch);
    } catch (error) {
      console.error('Error starting import:', error);
      alert('Failed to start import process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [currentBatch, importSettings, migrationService, onComplete]);

  const renderSourceSelection = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <h2 className=\"text-2xl font-bold text-white mb-2\">Import Content</h2>
        <p className=\"text-gray-400\">Choose how you'd like to import your content</p>
      </div>

      <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
        <Card 
          className={`p-6 cursor-pointer transition-all ${
            importSource === 'csv' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-gray-800/50'
          }`}
          onClick={() => setImportSource('csv')}
        >
          <div className=\"text-center\">
            <Icon name=\"file-text\" className=\"w-12 h-12 text-blue-400 mx-auto mb-4\" />
            <h3 className=\"text-lg font-semibold text-white mb-2\">CSV File</h3>
            <p className=\"text-gray-400 text-sm\">Import from a CSV spreadsheet with content metadata</p>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all ${
            importSource === 'json' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-gray-800/50'
          }`}
          onClick={() => setImportSource('json')}
        >
          <div className=\"text-center\">
            <Icon name=\"code\" className=\"w-12 h-12 text-green-400 mx-auto mb-4\" />
            <h3 className=\"text-lg font-semibold text-white mb-2\">JSON File</h3>
            <p className=\"text-gray-400 text-sm\">Import from a structured JSON file with content data</p>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all ${
            importSource === 'linkinbio' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-gray-800/50'
          }`}
          onClick={() => setImportSource('linkinbio')}
        >
          <div className=\"text-center\">
            <Icon name=\"link\" className=\"w-12 h-12 text-purple-400 mx-auto mb-4\" />
            <h3 className=\"text-lg font-semibold text-white mb-2\">Link-in-Bio</h3>
            <p className=\"text-gray-400 text-sm\">Import from Linktree, Beacons, or similar platforms</p>
          </div>
        </Card>
      </div>

      <div className=\"flex justify-end space-x-4\">
        <Button variant=\"secondary\" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => setCurrentStep('upload')}>
          Continue
        </Button>
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <h2 className=\"text-2xl font-bold text-white mb-2\">
          {importSource === 'linkinbio' ? 'Connect Platform' : 'Upload File'}
        </h2>
        <p className=\"text-gray-400\">
          {importSource === 'linkinbio' 
            ? 'Enter your link-in-bio platform details'
            : `Upload your ${importSource.toUpperCase()} file with content metadata`
          }
        </p>
      </div>

      {importSource === 'linkinbio' ? (
        <div className=\"max-w-md mx-auto space-y-4\">
          <div>
            <label className=\"block text-sm font-medium text-gray-300 mb-2\">
              Platform
            </label>
            <select
              value={linkInBioData.platform}
              onChange={(e) => setLinkInBioData(prev => ({ ...prev, platform: e.target.value }))}
              className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
            >
              <option value=\"linktree\">Linktree</option>
              <option value=\"beacons\">Beacons</option>
              <option value=\"allmylinks\">AllMyLinks</option>
            </select>
          </div>

          <div>
            <label className=\"block text-sm font-medium text-gray-300 mb-2\">
              Username
            </label>
            <input
              type=\"text\"
              value={linkInBioData.username}
              onChange={(e) => setLinkInBioData(prev => ({ ...prev, username: e.target.value }))}
              placeholder=\"Enter your username\"
              className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
            />
          </div>

          <div className=\"flex justify-between space-x-4 pt-4\">
            <Button variant=\"secondary\" onClick={() => setCurrentStep('source')}>
              Back
            </Button>
            <Button 
              onClick={handleLinkInBioImport}
              disabled={isProcessing || !linkInBioData.username.trim()}
            >
              {isProcessing ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      ) : (
        <div className=\"max-w-md mx-auto\">
          <div className=\"border-2 border-dashed border-gray-600 rounded-lg p-8 text-center\">
            <Icon name=\"upload\" className=\"w-12 h-12 text-gray-400 mx-auto mb-4\" />
            <p className=\"text-gray-400 mb-4\">
              Drop your {importSource.toUpperCase()} file here or click to browse
            </p>
            <input
              type=\"file\"
              accept={importSource === 'csv' ? '.csv' : '.json'}
              onChange={handleFileUpload}
              className=\"hidden\"
              id=\"file-upload\"
              disabled={isProcessing}
            />
            <label
              htmlFor=\"file-upload\"
              className=\"inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors\"
            >
              {isProcessing ? 'Processing...' : 'Choose File'}
            </label>
          </div>

          <div className=\"flex justify-between space-x-4 pt-6\">
            <Button variant=\"secondary\" onClick={() => setCurrentStep('source')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidation = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <h2 className=\"text-2xl font-bold text-white mb-2\">Validation Results</h2>
        <p className=\"text-gray-400\">Review your content before importing</p>
      </div>

      {currentBatch && (
        <div className=\"space-y-4\">
          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
            <Card className=\"p-4 text-center\">
              <div className=\"text-2xl font-bold text-green-400\">{currentBatch.totalItems}</div>
              <div className=\"text-gray-400\">Total Items</div>
            </Card>
            <Card className=\"p-4 text-center\">
              <div className=\"text-2xl font-bold text-blue-400\">{currentBatch.validItems}</div>
              <div className=\"text-gray-400\">Valid Items</div>
            </Card>
            <Card className=\"p-4 text-center\">
              <div className=\"text-2xl font-bold text-red-400\">{currentBatch.invalidItems}</div>
              <div className=\"text-gray-400\">Invalid Items</div>
            </Card>
          </div>

          <Card className=\"p-4\">
            <h3 className=\"text-lg font-semibold text-white mb-4\">Content Preview</h3>
            <div className=\"space-y-2 max-h-64 overflow-y-auto\">
              {currentBatch.items.slice(0, 10).map((item, index) => (
                <div key={item.id} className=\"flex items-center justify-between p-2 bg-gray-800 rounded\">
                  <div className=\"flex-1\">
                    <div className=\"text-white font-medium\">{item.title}</div>
                    <div className=\"text-gray-400 text-sm\">{item.description}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    item.status === 'validated' ? 'bg-green-500/20 text-green-400' :
                    item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {item.status}
                  </div>
                </div>
              ))}
              {currentBatch.items.length > 10 && (
                <div className=\"text-center text-gray-400 text-sm py-2\">
                  ... and {currentBatch.items.length - 10} more items
                </div>
              )}
            </div>
          </Card>

          <div className=\"flex justify-between space-x-4\">
            <Button variant=\"secondary\" onClick={() => setCurrentStep('upload')}>
              Back
            </Button>
            <Button 
              onClick={handleValidation}
              disabled={isProcessing}
            >
              {isProcessing ? 'Validating...' : 'Continue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <h2 className=\"text-2xl font-bold text-white mb-2\">Import Settings</h2>
        <p className=\"text-gray-400\">Configure how your content will be imported</p>
      </div>

      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-white mb-4\">Content Settings</h3>
          <div className=\"space-y-4\">
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">Auto-publish content</label>
              <input
                type=\"checkbox\"
                checked={importSettings.autoPublish}
                onChange={(e) => setImportSettings(prev => ({ ...prev, autoPublish: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">Skip duplicates</label>
              <input
                type=\"checkbox\"
                checked={importSettings.skipDuplicates}
                onChange={(e) => setImportSettings(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Default Age Rating
              </label>
              <select
                value={importSettings.defaultAgeRating}
                onChange={(e) => setImportSettings(prev => ({ ...prev, defaultAgeRating: e.target.value as '18+' | '21+' }))}
                className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500\"
              >
                <option value=\"18+\">18+</option>
                <option value=\"21+\">21+</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-white mb-4\">Storage & Security</h3>
          <div className=\"space-y-4\">
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Storage Class
              </label>
              <select
                value={importSettings.defaultStorageClass}
                onChange={(e) => setImportSettings(prev => ({ ...prev, defaultStorageClass: e.target.value as 'shreddable' | 'permanent' }))}
                className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500\"
              >
                <option value=\"shreddable\">Shreddable (Auto-delete)</option>
                <option value=\"permanent\">Permanent Storage</option>
              </select>
            </div>
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">Enable encryption</label>
              <input
                type=\"checkbox\"
                checked={importSettings.enableEncryption}
                onChange={(e) => setImportSettings(prev => ({ ...prev, enableEncryption: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">Enable watermarking</label>
              <input
                type=\"checkbox\"
                checked={importSettings.enableWatermarking}
                onChange={(e) => setImportSettings(prev => ({ ...prev, enableWatermarking: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
          </div>
        </Card>
      </div>

      <div className=\"flex justify-between space-x-4\">
        <Button variant=\"secondary\" onClick={() => setCurrentStep('validate')}>
          Back
        </Button>
        <Button onClick={handleStartImport} disabled={isProcessing}>
          {isProcessing ? 'Starting Import...' : 'Start Import'}
        </Button>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className=\"space-y-6 text-center\">
      <div className=\"w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto\">
        <Icon name=\"check\" className=\"w-8 h-8 text-white\" />
      </div>
      
      <div>
        <h2 className=\"text-2xl font-bold text-white mb-2\">Import Complete!</h2>
        <p className=\"text-gray-400\">Your content has been successfully imported</p>
      </div>

      {currentBatch && (
        <Card className=\"p-6 max-w-md mx-auto\">
          <div className=\"space-y-2\">
            <div className=\"flex justify-between\">
              <span className=\"text-gray-400\">Total Items:</span>
              <span className=\"text-white\">{currentBatch.totalItems}</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-gray-400\">Successfully Imported:</span>
              <span className=\"text-green-400\">{currentBatch.importedItems}</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-gray-400\">Failed:</span>
              <span className=\"text-red-400\">{currentBatch.invalidItems}</span>
            </div>
          </div>
        </Card>
      )}

      <div className=\"flex justify-center space-x-4\">
        <Button variant=\"secondary\" onClick={onCancel}>
          Close
        </Button>
        <Button onClick={() => window.location.href = '/studio'}>
          Go to Studio
        </Button>
      </div>
    </div>
  );

  const steps = {
    source: renderSourceSelection,
    upload: renderUpload,
    validate: renderValidation,
    settings: renderSettings,
    import: renderSettings,
    complete: renderComplete
  };

  return (
    <div className=\"max-w-4xl mx-auto p-6\">
      <Card className=\"p-8\">
        {steps[currentStep]()}
      </Card>
    </div>
  );
};