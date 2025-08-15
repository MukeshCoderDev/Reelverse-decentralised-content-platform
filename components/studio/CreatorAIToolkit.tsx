import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Spinner } from '../Spinner';

interface TitleSuggestion {
  title: string;
  confidence: number;
  category: string;
  estimatedCTR: number;
}

interface ThumbnailVariation {
  id: string;
  imageUrl: string;
  style: string;
  confidence: number;
  estimatedCTR: number;
}

interface CaptionSuggestion {
  caption: string;
  tone: string;
  hashtags: string[];
  estimatedEngagement: number;
}

interface CreatorAIToolkitProps {
  contentId: string;
  contentMetadata: {
    title: string;
    tags: string[];
    category: string;
    performers: string[];
    duration: number;
  };
  videoUrl?: string;
  onAssetSelect: (assetType: string, asset: any) => void;
}

export const CreatorAIToolkit: React.FC<CreatorAIToolkitProps> = ({
  contentId,
  contentMetadata,
  videoUrl,
  onAssetSelect
}) => {
  const [activeTab, setActiveTab] = useState<'titles' | 'thumbnails' | 'captions' | 'sfw-preview' | 'calendar'>('titles');
  const [loading, setLoading] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [thumbnailVariations, setThumbnailVariations] = useState<ThumbnailVariation[]>([]);
  const [captionSuggestions, setCaptionSuggestions] = useState<CaptionSuggestion[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<'twitter' | 'reddit' | 'telegram' | 'onlyfans'>('twitter');

  const generateTitles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/creator-ai/titles/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contentId,
          contentMetadata,
          options: {
            count: 5,
            style: 'descriptive',
            targetAudience: 'general'
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setTitleSuggestions(data.data.suggestions);
      }
    } catch (error) {
      console.error('Error generating titles:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateThumbnails = async () => {
    if (!videoUrl) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/creator-ai/thumbnails/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contentId,
          videoUrl,
          options: {
            count: 6,
            styles: ['close_up', 'wide_shot', 'action', 'artistic'],
            brandSafeOnly: false
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setThumbnailVariations(data.data.variations);
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCaptions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/creator-ai/captions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contentId,
          contentMetadata,
          platform: selectedPlatform
        })
      });

      const data = await response.json();
      if (data.success) {
        setCaptionSuggestions(data.data.suggestions);
      }
    } catch (error) {
      console.error('Error generating captions:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTitlesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">AI Title Suggestions</h3>
        <Button onClick={generateTitles} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Generate Titles'}
        </Button>
      </div>
      
      {titleSuggestions.length > 0 && (
        <div className="space-y-3">
          {titleSuggestions.map((suggestion, index) => (
            <Card key={index} className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onAssetSelect('title', suggestion)}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{suggestion.title}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {suggestion.category}
                    </span>
                    <span>Confidence: {(suggestion.confidence * 100).toFixed(1)}%</span>
                    <span>Est. CTR: {(suggestion.estimatedCTR * 100).toFixed(2)}%</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">Use This</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderThumbnailsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">AI Thumbnail Variations</h3>
        <Button onClick={generateThumbnails} disabled={loading || !videoUrl}>
          {loading ? <Spinner size="sm" /> : 'Generate Thumbnails'}
        </Button>
      </div>
      
      {!videoUrl && (
        <p className="text-gray-600">Upload a video to generate thumbnail variations</p>
      )}
      
      {thumbnailVariations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {thumbnailVariations.map((variation) => (
            <Card key={variation.id} className="p-3 hover:shadow-md cursor-pointer transition-shadow"
                  onClick={() => onAssetSelect('thumbnail', variation)}>
              <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                <img 
                  src={variation.imageUrl} 
                  alt={`Thumbnail ${variation.style}`}
                  className="w-full h-full object-cover rounded"
                />
              </div>
              <div className="text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium capitalize">{variation.style.replace('_', ' ')}</span>
                  <span className="text-green-600 font-medium">
                    {(variation.estimatedCTR * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-gray-600">
                  Confidence: {(variation.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderCaptionsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Social Media Captions</h3>
        <div className="flex items-center space-x-3">
          <select 
            value={selectedPlatform} 
            onChange={(e) => setSelectedPlatform(e.target.value as any)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="twitter">Twitter</option>
            <option value="reddit">Reddit</option>
            <option value="telegram">Telegram</option>
            <option value="onlyfans">OnlyFans</option>
          </select>
          <Button onClick={generateCaptions} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Generate Captions'}
          </Button>
        </div>
      </div>
      
      {captionSuggestions.length > 0 && (
        <div className="space-y-3">
          {captionSuggestions.map((suggestion, index) => (
            <Card key={index} className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onAssetSelect('caption', suggestion)}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-gray-900 mb-2">{suggestion.caption}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {suggestion.hashtags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="text-blue-600 text-sm">#{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {suggestion.tone}
                    </span>
                    <span>Est. Engagement: {suggestion.estimatedEngagement}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">Copy</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderSFWPreviewTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Brand-Safe SFW Preview</h3>
        <Button disabled={loading || !videoUrl}>
          {loading ? <Spinner size="sm" /> : 'Generate SFW Preview'}
        </Button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">What is SFW Preview?</h4>
        <p className="text-blue-800 text-sm">
          Generate brand-safe, work-friendly preview content that can be shared on mainstream platforms 
          like Twitter, Instagram, and TikTok to drive traffic to your full content.
        </p>
      </div>
      
      {!videoUrl && (
        <p className="text-gray-600">Upload a video to generate SFW preview content</p>
      )}
    </div>
  );

  const renderCalendarTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Content Calendar Optimization</h3>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">AI-Powered Posting Schedule</h4>
        <p className="text-green-800 text-sm mb-3">
          Get personalized recommendations for when to post your content based on your audience activity, 
          competitor analysis, and historical performance data.
        </p>
        <Button size="sm">View Full Calendar</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium mb-2">Today's Recommendation</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Best Time:</strong> 2:00 PM - 4:00 PM</p>
            <p><strong>Audience Activity:</strong> High (85%)</p>
            <p><strong>Competitor Activity:</strong> Low (23%)</p>
            <p><strong>Recommended Content:</strong> New Release</p>
          </div>
        </Card>
        
        <Card className="p-4">
          <h4 className="font-medium mb-2">This Week's Highlights</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Best Day:</strong> Thursday</p>
            <p><strong>Avoid:</strong> Monday mornings</p>
            <p><strong>Peak Hours:</strong> 2-4 PM, 8-10 PM</p>
            <p><strong>Content Mix:</strong> 60% new, 40% promo</p>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'titles', label: 'Titles', icon: '📝' },
            { id: 'thumbnails', label: 'Thumbnails', icon: '🖼️' },
            { id: 'captions', label: 'Captions', icon: '💬' },
            { id: 'sfw-preview', label: 'SFW Preview', icon: '🎬' },
            { id: 'calendar', label: 'Calendar', icon: '📅' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="p-6">
        {activeTab === 'titles' && renderTitlesTab()}
        {activeTab === 'thumbnails' && renderThumbnailsTab()}
        {activeTab === 'captions' && renderCaptionsTab()}
        {activeTab === 'sfw-preview' && renderSFWPreviewTab()}
        {activeTab === 'calendar' && renderCalendarTab()}
      </div>
    </div>
  );
};