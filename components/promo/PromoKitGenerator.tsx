import React, { useState, useCallback } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { PromoKitService, PromoKit, PromoKitSettings, PromoAsset } from '../../services/promoKitService';

interface PromoKitGeneratorProps {
  contentId: string;
  organizationId?: string;
  onComplete?: (promoKit: PromoKit) => void;
  onCancel?: () => void;
}

export const PromoKitGenerator: React.FC<PromoKitGeneratorProps> = ({
  contentId,
  organizationId,
  onComplete,
  onCancel
}) => {
  const [settings, setSettings] = useState<PromoKitSettings>({
    trailerDuration: 30,
    thumbnailCount: 6,
    generateSocialAssets: true,
    platforms: ['twitter', 'reddit'],
    includeWatermark: false,
    sfwOnly: true
  });
  const [currentKit, setCurrentKit] = useState<PromoKit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const promoKitService = PromoKitService.getInstance();

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const kit = await promoKitService.generatePromoKit(contentId, settings, organizationId);
      setCurrentKit(kit);
      
      // Poll for updates
      const pollInterval = setInterval(async () => {
        const updatedKit = await promoKitService.getPromoKit(kit.id);
        if (updatedKit) {
          setCurrentKit(updatedKit);
          if (updatedKit.status === 'completed' || updatedKit.status === 'failed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            if (updatedKit.status === 'completed') {
              onComplete?.(updatedKit);
            }
          }
        }
      }, 1000);

      // Clear interval after 5 minutes max
      setTimeout(() => clearInterval(pollInterval), 300000);
      
    } catch (error) {
      console.error('Error generating promo kit:', error);
      setIsGenerating(false);
      alert('Failed to generate promotional kit. Please try again.');
    }
  }, [contentId, settings, organizationId, promoKitService, onComplete]);

  const handleShare = useCallback(async (platform: string, assetId: string, caption?: string) => {
    try {
      const result = await promoKitService.shareToSocial(platform, assetId, caption);
      if (result.success) {
        alert(`Successfully shared to ${platform}!`);
      } else {
        alert(`Failed to share to ${platform}: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sharing to social media:', error);
      alert('Failed to share to social media');
    }
  }, [promoKitService]);

  const renderSettings = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <h2 className=\"text-2xl font-bold text-white mb-2\">Generate Promo Kit</h2>
        <p className=\"text-gray-400\">Create trailers, thumbnails, and social media assets automatically</p>
      </div>

      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-white mb-4\">Trailer Settings</h3>
          <div className=\"space-y-4\">
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Trailer Duration
              </label>
              <select
                value={settings.trailerDuration}
                onChange={(e) => setSettings(prev => ({ ...prev, trailerDuration: parseInt(e.target.value) as 30 | 45 | 60 }))}
                className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500\"
              >
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">SFW Only</label>
              <input
                type=\"checkbox\"
                checked={settings.sfwOnly}
                onChange={(e) => setSettings(prev => ({ ...prev, sfwOnly: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
            <div className=\"flex items-center justify-between\">
              <label className=\"text-gray-300\">Include Watermark</label>
              <input
                type=\"checkbox\"
                checked={settings.includeWatermark}
                onChange={(e) => setSettings(prev => ({ ...prev, includeWatermark: e.target.checked }))}
                className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
              />
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-white mb-4\">Thumbnail Settings</h3>
          <div className=\"space-y-4\">
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Number of Thumbnails
              </label>
              <select
                value={settings.thumbnailCount}
                onChange={(e) => setSettings(prev => ({ ...prev, thumbnailCount: parseInt(e.target.value) as 3 | 6 | 9 }))}
                className=\"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500\"
              >
                <option value={3}>3 thumbnails</option>
                <option value={6}>6 thumbnails</option>
                <option value={9}>9 thumbnails</option>
              </select>
            </div>
            <div className=\"text-sm text-gray-400\">
              Thumbnails will be generated at evenly distributed timestamps throughout the video
            </div>
          </div>
        </Card>
      </div>

      <Card className=\"p-6\">
        <h3 className=\"text-lg font-semibold text-white mb-4\">Social Media Assets</h3>
        <div className=\"space-y-4\">
          <div className=\"flex items-center justify-between\">
            <label className=\"text-gray-300\">Generate Social Assets</label>
            <input
              type=\"checkbox\"
              checked={settings.generateSocialAssets}
              onChange={(e) => setSettings(prev => ({ ...prev, generateSocialAssets: e.target.checked }))}
              className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
            />
          </div>
          
          {settings.generateSocialAssets && (
            <div>
              <label className=\"block text-sm font-medium text-gray-300 mb-2\">
                Platforms
              </label>
              <div className=\"grid grid-cols-2 gap-2\">
                {['twitter', 'reddit', 'telegram', 'instagram'].map(platform => (
                  <label key={platform} className=\"flex items-center space-x-2\">
                    <input
                      type=\"checkbox\"
                      checked={settings.platforms.includes(platform as any)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSettings(prev => ({ ...prev, platforms: [...prev.platforms, platform as any] }));
                        } else {
                          setSettings(prev => ({ ...prev, platforms: prev.platforms.filter(p => p !== platform) }));
                        }
                      }}
                      className=\"w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500\"
                    />
                    <span className=\"text-gray-300 capitalize\">{platform}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className=\"flex justify-between space-x-4\">
        <Button variant=\"secondary\" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Promo Kit'}
        </Button>
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className=\"space-y-6 text-center\">
      <div className=\"w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto\">
        <div className=\"animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full\"></div>
      </div>
      
      <div>
        <h2 className=\"text-2xl font-bold text-white mb-2\">Generating Promo Kit</h2>
        <p className=\"text-gray-400\">This usually takes 1-2 minutes</p>
      </div>

      {currentKit && (
        <div className=\"max-w-md mx-auto\">
          <div className=\"w-full bg-gray-700 rounded-full h-2 mb-4\">
            <div 
              className=\"bg-blue-500 h-2 rounded-full transition-all duration-300\"
              style={{ width: `${currentKit.progress}%` }}
            ></div>
          </div>
          <p className=\"text-gray-400 text-sm\">{currentKit.progress}% complete</p>
          
          {currentKit.estimatedCompletionTime && (
            <p className=\"text-gray-500 text-xs mt-2\">
              Estimated completion: {new Date(currentKit.estimatedCompletionTime).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderResults = () => (
    <div className=\"space-y-6\">
      <div className=\"text-center\">
        <div className=\"w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4\">
          <Icon name=\"check\" className=\"w-8 h-8 text-white\" />
        </div>
        <h2 className=\"text-2xl font-bold text-white mb-2\">Promo Kit Complete!</h2>
        <p className=\"text-gray-400\">Your promotional assets are ready</p>
      </div>

      {currentKit && (
        <div className=\"space-y-4\">
          {/* Trailer */}
          {currentKit.assets.filter(a => a.type === 'trailer').map(asset => (
            <Card key={asset.id} className=\"p-4\">
              <div className=\"flex items-center justify-between\">
                <div className=\"flex items-center space-x-3\">
                  <div className=\"w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center\">
                    <Icon name=\"play\" className=\"w-5 h-5 text-purple-400\" />
                  </div>
                  <div>
                    <h3 className=\"font-semibold text-white\">Trailer ({asset.metadata.duration}s)</h3>
                    <p className=\"text-gray-400 text-sm\">{asset.metadata.dimensions?.width}x{asset.metadata.dimensions?.height}</p>
                  </div>
                </div>
                <div className=\"flex space-x-2\">
                  <Button variant=\"secondary\" size=\"sm\">
                    <Icon name=\"download\" className=\"w-4 h-4 mr-2\" />
                    Download
                  </Button>
                  <Button variant=\"secondary\" size=\"sm\">
                    <Icon name=\"eye\" className=\"w-4 h-4 mr-2\" />
                    Preview
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Thumbnails */}
          <Card className=\"p-4\">
            <h3 className=\"font-semibold text-white mb-4\">Thumbnails</h3>
            <div className=\"grid grid-cols-2 md:grid-cols-3 gap-4\">
              {currentKit.assets.filter(a => a.type === 'thumbnail').map(asset => (
                <div key={asset.id} className=\"relative group\">
                  <div className=\"aspect-video bg-gray-800 rounded-lg flex items-center justify-center\">
                    <Icon name=\"image\" className=\"w-8 h-8 text-gray-600\" />
                  </div>
                  <div className=\"absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2\">
                    <Button variant=\"secondary\" size=\"sm\">
                      <Icon name=\"download\" className=\"w-4 h-4\" />
                    </Button>
                    <Button variant=\"secondary\" size=\"sm\">
                      <Icon name=\"eye\" className=\"w-4 h-4\" />
                    </Button>
                  </div>
                  <p className=\"text-xs text-gray-400 mt-1 text-center\">
                    {asset.metadata.timestamp}%
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Social Assets */}
          {settings.generateSocialAssets && (
            <Card className=\"p-4\">
              <h3 className=\"font-semibold text-white mb-4\">Social Media Assets</h3>
              <div className=\"space-y-3\">
                {settings.platforms.map(platform => {
                  const imageAsset = currentKit.assets.find(a => a.type === 'social_image' && a.metadata.platform === platform);
                  const captionAsset = currentKit.assets.find(a => a.type === 'caption' && a.metadata.platform === platform);
                  
                  return (
                    <div key={platform} className=\"flex items-center justify-between p-3 bg-gray-800/50 rounded-lg\">
                      <div className=\"flex items-center space-x-3\">
                        <div className=\"w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center\">
                          <Icon name=\"share-2\" className=\"w-4 h-4 text-blue-400\" />
                        </div>
                        <div>
                          <h4 className=\"font-medium text-white capitalize\">{platform}</h4>
                          <p className=\"text-gray-400 text-sm\">Image + Caption ready</p>
                        </div>
                      </div>
                      <div className=\"flex space-x-2\">
                        <Button variant=\"secondary\" size=\"sm\">
                          <Icon name=\"download\" className=\"w-4 h-4 mr-2\" />
                          Download
                        </Button>
                        <Button 
                          size=\"sm\"
                          onClick={() => handleShare(platform, imageAsset?.id || '', captionAsset?.data)}
                        >
                          <Icon name=\"share\" className=\"w-4 h-4 mr-2\" />
                          Share
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      <div className=\"flex justify-center space-x-4\">
        <Button variant=\"secondary\" onClick={onCancel}>
          Close
        </Button>
        <Button onClick={() => window.location.href = '/studio'}>
          Back to Studio
        </Button>
      </div>
    </div>
  );

  if (currentKit?.status === 'completed') {
    return (
      <div className=\"max-w-4xl mx-auto p-6\">
        <Card className=\"p-8\">
          {renderResults()}
        </Card>
      </div>
    );
  }

  if (isGenerating || currentKit?.status === 'processing') {
    return (
      <div className=\"max-w-4xl mx-auto p-6\">
        <Card className=\"p-8\">
          {renderProgress()}
        </Card>
      </div>
    );
  }

  return (
    <div className=\"max-w-4xl mx-auto p-6\">
      <Card className=\"p-8\">
        {renderSettings()}
      </Card>
    </div>
  );
};