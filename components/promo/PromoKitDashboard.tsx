import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { PromoKitGenerator } from './PromoKitGenerator';
import { PromoKitService, PromoKit } from '../../services/promoKitService';

interface PromoKitDashboardProps {
  organizationId?: string;
}

export const PromoKitDashboard: React.FC<PromoKitDashboardProps> = ({
  organizationId
}) => {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [promoHistory, setPromoHistory] = useState<PromoKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const promoKitService = PromoKitService.getInstance();

  useEffect(() => {
    loadPromoHistory();
  }, [organizationId]);

  const loadPromoHistory = async () => {
    try {
      setIsLoading(true);
      const history = await promoKitService.getPromoKitHistory(organizationId);
      setPromoHistory(history);
    } catch (error) {
      console.error('Error loading promo history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateComplete = (promoKit: PromoKit) => {
    setPromoHistory(prev => [promoKit, ...prev]);
    setShowGenerator(false);
  };

  const handleStartGeneration = (contentId: string) => {
    setSelectedContentId(contentId);
    setShowGenerator(true);
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
      case 'processing':
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'trailer':
        return 'play';
      case 'thumbnail':
        return 'image';
      case 'social_image':
        return 'share-2';
      case 'caption':
        return 'message-square';
      default:
        return 'file';
    }
  };

  if (showGenerator) {
    return (
      <PromoKitGenerator
        contentId={selectedContentId}
        organizationId={organizationId}
        onComplete={handleGenerateComplete}
        onCancel={() => setShowGenerator(false)}
      />
    );
  }

  return (
    <div className=\"space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-2xl font-bold text-white\">Auto Promo Kit</h1>
          <p className=\"text-gray-400 mt-1\">
            Generate trailers, thumbnails, and social media assets automatically
          </p>
        </div>
        <Button onClick={() => handleStartGeneration('demo_content')}>
          <Icon name=\"plus\" className=\"w-4 h-4 mr-2\" />
          Generate Promo Kit
        </Button>
      </div>

      {/* Quick Stats */}
      <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"zap\" className=\"w-5 h-5 text-purple-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {promoHistory.length}
              </div>
              <div className=\"text-gray-400 text-sm\">Promo Kits</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"play\" className=\"w-5 h-5 text-blue-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {promoHistory.reduce((sum, kit) => sum + kit.assets.filter(a => a.type === 'trailer').length, 0)}
              </div>
              <div className=\"text-gray-400 text-sm\">Trailers</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"image\" className=\"w-5 h-5 text-green-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {promoHistory.reduce((sum, kit) => sum + kit.assets.filter(a => a.type === 'thumbnail').length, 0)}
              </div>
              <div className=\"text-gray-400 text-sm\">Thumbnails</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"share-2\" className=\"w-5 h-5 text-orange-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {promoHistory.reduce((sum, kit) => sum + kit.assets.filter(a => a.type === 'social_image').length, 0)}
              </div>
              <div className=\"text-gray-400 text-sm\">Social Assets</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Features Overview */}
      <Card className=\"p-6\">
        <h2 className=\"text-xl font-semibold text-white mb-4\">What's Included</h2>
        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">
          <div className=\"text-center\">
            <div className=\"w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3\">
              <Icon name=\"play\" className=\"w-6 h-6 text-purple-400\" />
            </div>
            <h3 className=\"font-semibold text-white mb-2\">SFW Trailers</h3>
            <p className=\"text-gray-400 text-sm\">
              Automatically generated 30-60 second trailers with smart scene selection and transitions
            </p>
          </div>
          
          <div className=\"text-center\">
            <div className=\"w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3\">
              <Icon name=\"image\" className=\"w-6 h-6 text-green-400\" />
            </div>
            <h3 className=\"font-semibold text-white mb-2\">Smart Thumbnails</h3>
            <p className=\"text-gray-400 text-sm\">
              Multiple thumbnail options generated at optimal timestamps for maximum engagement
            </p>
          </div>
          
          <div className=\"text-center\">
            <div className=\"w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3\">
              <Icon name=\"share-2\" className=\"w-6 h-6 text-blue-400\" />
            </div>
            <h3 className=\"font-semibold text-white mb-2\">Social Assets</h3>
            <p className=\"text-gray-400 text-sm\">
              Platform-optimized images and captions for Twitter, Reddit, Telegram, and Instagram
            </p>
          </div>
        </div>
      </Card>

      {/* Recent Content */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">Your Content</h2>
          <Button variant=\"secondary\" size=\"sm\">
            <Icon name=\"refresh-cw\" className=\"w-4 h-4 mr-2\" />
            Refresh
          </Button>
        </div>

        <div className=\"space-y-3\">
          {/* Mock content items */}
          <div className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors\">
            <div className=\"flex items-center space-x-4\">
              <div className=\"w-16 h-10 bg-gray-700 rounded flex items-center justify-center\">
                <Icon name=\"play\" className=\"w-4 h-4 text-gray-400\" />
              </div>
              <div>
                <h3 className=\"font-semibold text-white\">Premium Content #1</h3>
                <p className=\"text-gray-400 text-sm\">Uploaded 2 days ago • 15:30 duration</p>
              </div>
            </div>
            <Button 
              size=\"sm\"
              onClick={() => handleStartGeneration('content_1')}
            >
              <Icon name=\"zap\" className=\"w-4 h-4 mr-2\" />
              Generate Kit
            </Button>
          </div>

          <div className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors\">
            <div className=\"flex items-center space-x-4\">
              <div className=\"w-16 h-10 bg-gray-700 rounded flex items-center justify-center\">
                <Icon name=\"play\" className=\"w-4 h-4 text-gray-400\" />
              </div>
              <div>
                <h3 className=\"font-semibold text-white\">Exclusive Behind Scenes</h3>
                <p className=\"text-gray-400 text-sm\">Uploaded 1 week ago • 22:15 duration</p>
              </div>
            </div>
            <Button 
              size=\"sm\"
              onClick={() => handleStartGeneration('content_2')}
            >
              <Icon name=\"zap\" className=\"w-4 h-4 mr-2\" />
              Generate Kit
            </Button>
          </div>

          <div className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors\">
            <div className=\"flex items-center space-x-4\">
              <div className=\"w-16 h-10 bg-gray-700 rounded flex items-center justify-center\">
                <Icon name=\"play\" className=\"w-4 h-4 text-gray-400\" />
              </div>
              <div>
                <h3 className=\"font-semibold text-white\">Special Collection</h3>
                <p className=\"text-gray-400 text-sm\">Uploaded 2 weeks ago • 18:45 duration</p>
              </div>
            </div>
            <Button 
              size=\"sm\"
              onClick={() => handleStartGeneration('content_3')}
            >
              <Icon name=\"zap\" className=\"w-4 h-4 mr-2\" />
              Generate Kit
            </Button>
          </div>
        </div>
      </Card>

      {/* Promo Kit History */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">Promo Kit History</h2>
          <Button variant=\"secondary\" size=\"sm\" onClick={loadPromoHistory}>
            <Icon name=\"refresh-cw\" className=\"w-4 h-4 mr-2\" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className=\"text-center py-8\">
            <div className=\"animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4\"></div>
            <p className=\"text-gray-400\">Loading promo kit history...</p>
          </div>
        ) : promoHistory.length === 0 ? (
          <div className=\"text-center py-8\">
            <Icon name=\"zap\" className=\"w-12 h-12 text-gray-600 mx-auto mb-4\" />
            <p className=\"text-gray-400 mb-4\">No promo kits generated yet</p>
            <Button onClick={() => handleStartGeneration('demo_content')}>
              Generate Your First Kit
            </Button>
          </div>
        ) : (
          <div className=\"space-y-4\">
            {promoHistory.map((kit) => (
              <div
                key={kit.id}
                className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors\"
              >
                <div className=\"flex items-center space-x-4\">
                  <div className=\"w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center\">
                    <Icon name=\"zap\" className=\"w-5 h-5 text-gray-400\" />
                  </div>
                  <div>
                    <div className=\"flex items-center space-x-2\">
                      <h3 className=\"font-semibold text-white\">
                        Promo Kit #{kit.id.slice(-6)}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(kit.status)}`}>
                        {kit.status}
                      </span>
                    </div>
                    <p className=\"text-gray-400 text-sm\">
                      {formatDate(kit.createdAt)}
                      {kit.completedAt && kit.completedAt !== kit.createdAt && (
                        <span> • Completed {formatDate(kit.completedAt)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className=\"flex items-center space-x-6 text-sm\">
                  <div className=\"flex space-x-4\">
                    {['trailer', 'thumbnail', 'social_image'].map(type => {
                      const count = kit.assets.filter(a => a.type === type).length;
                      if (count === 0) return null;
                      
                      return (
                        <div key={type} className=\"text-center\">
                          <div className=\"text-white font-semibold\">{count}</div>
                          <div className=\"text-gray-400 capitalize\">{type}s</div>
                        </div>
                      );
                    })}
                  </div>
                  <Button variant=\"secondary\" size=\"sm\">
                    <Icon name=\"eye\" className=\"w-4 h-4 mr-2\" />
                    View Assets
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