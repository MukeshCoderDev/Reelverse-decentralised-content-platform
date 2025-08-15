import React, { useState } from 'react';
import Icon from '../components/Icon';
import { CreatorAIToolkit } from '../components/studio/CreatorAIToolkit';
import { AIToolkitAnalytics } from '../components/studio/AIToolkitAnalytics';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

const StudioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ai-toolkit' | 'analytics' | 'content' | 'earnings'>('overview');
  const [selectedContent, setSelectedContent] = useState<any>(null);

  // Mock data - in real implementation, this would come from API
  const mockContentMetadata = {
    title: "Sample Content Title",
    tags: ["premium", "exclusive", "hd"],
    category: "premium",
    performers: ["Creator Name"],
    duration: 15
  };

  const handleAssetSelect = (assetType: string, asset: any) => {
    console.log(`Selected ${assetType}:`, asset);
    // Handle asset selection - could update content, copy to clipboard, etc.
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon name="video" size={24} className="text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Content</p>
              <p className="text-2xl font-bold text-gray-900">127</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Icon name="dollar-sign" size={24} className="text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">$2,847</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon name="eye" size={24} className="text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">45.2K</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Icon name="trending-up" size={24} className="text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Growth Rate</p>
              <p className="text-2xl font-bold text-gray-900">+23%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button 
              onClick={() => setActiveTab('ai-toolkit')} 
              className="w-full justify-start"
              variant="outline"
            >
              <span className="mr-2">🤖</span>
              AI Content Toolkit
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <span className="mr-2">📤</span>
              Upload New Content
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <span className="mr-2">📊</span>
              View Analytics
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <span className="mr-2">💰</span>
              Manage Earnings
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Toolkit Highlights</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">AI Assets Generated</span>
              <span className="font-semibold">156</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg CTR Improvement</span>
              <span className="font-semibold text-green-600">+23.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Revenue Lift</span>
              <span className="font-semibold text-green-600">+$1,251</span>
            </div>
            <Button 
              onClick={() => setActiveTab('analytics')} 
              size="sm" 
              className="w-full mt-3"
            >
              View Full Analytics
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => (
    <div className="text-center py-12">
      <Icon name="video" size={64} className="text-gray-400 mb-4 mx-auto" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Content Management</h3>
      <p className="text-gray-600">Upload, organize, and manage your content library.</p>
    </div>
  );

  const renderEarnings = () => (
    <div className="text-center py-12">
      <Icon name="dollar-sign" size={64} className="text-gray-400 mb-4 mx-auto" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Earnings Dashboard</h3>
      <p className="text-gray-600">Track your revenue, payouts, and financial analytics.</p>
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Creator Studio</h1>
              <p className="text-gray-600">Manage your content and grow your audience with AI-powered tools</p>
            </div>
          </div>
          
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: 'home' },
              { id: 'ai-toolkit', label: 'AI Toolkit', icon: 'cpu' },
              { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
              { id: 'content', label: 'Content', icon: 'video' },
              { id: 'earnings', label: 'Earnings', icon: 'dollar-sign' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon name={tab.icon as any} size={16} className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'ai-toolkit' && (
          <CreatorAIToolkit
            contentId="sample-content-id"
            contentMetadata={mockContentMetadata}
            videoUrl="https://example.com/sample-video.mp4"
            onAssetSelect={handleAssetSelect}
          />
        )}
        {activeTab === 'analytics' && (
          <AIToolkitAnalytics
            creatorId="sample-creator-id"
            timeframe="30d"
          />
        )}
        {activeTab === 'content' && renderContent()}
        {activeTab === 'earnings' && renderEarnings()}
      </div>
    </div>
  );
};

export default StudioPage;