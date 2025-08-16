/**
 * Public Status Page Component
 * Complete public-facing status page for agencies and stakeholders
 */

import React, { useState } from 'react';
import { StatusPageTiles } from './StatusPageTiles';
import { MetricsDashboard } from './MetricsChart';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Tab: React.FC<TabProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

type TimeRange = '24h' | '7d' | '30d';
type ViewMode = 'overview' | 'metrics' | 'history';

export const PublicStatusPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Platform Status</h1>
                <p className="text-sm text-gray-500">Real-time system health and performance</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Auto-refresh: 30s
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex space-x-2">
              <Tab
                active={activeView === 'overview'}
                onClick={() => setActiveView('overview')}
              >
                Overview
              </Tab>
              <Tab
                active={activeView === 'metrics'}
                onClick={() => setActiveView('metrics')}
              >
                Metrics
              </Tab>
              <Tab
                active={activeView === 'history'}
                onClick={() => setActiveView('history')}
              >
                History
              </Tab>
            </div>

            {(activeView === 'metrics' || activeView === 'history') && (
              <div className="flex space-x-2">
                <Tab
                  active={timeRange === '24h'}
                  onClick={() => setTimeRange('24h')}
                >
                  24h
                </Tab>
                <Tab
                  active={timeRange === '7d'}
                  onClick={() => setTimeRange('7d')}
                >
                  7d
                </Tab>
                <Tab
                  active={timeRange === '30d'}
                  onClick={() => setTimeRange('30d')}
                >
                  30d
                </Tab>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeView === 'overview' && (
          <div className="space-y-8">
            <StatusPageTiles />
            
            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Highlights</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">99.97%</div>
                  <div className="text-sm text-gray-600">30-day uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">1.2s</div>
                  <div className="text-sm text-gray-600">Avg. join time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">96.8%</div>
                  <div className="text-sm text-gray-600">Payment success</div>
                </div>
              </div>
            </div>

            {/* Agency Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">For Agency Partners</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Real-time Monitoring</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    All metrics are updated in real-time with 5-minute rolling windows. 
                    SLO targets are based on industry standards and agency requirements.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• P95 join time target: &lt;2 seconds</li>
                    <li>• Rebuffer ratio target: &lt;1%</li>
                    <li>• Payment success target: &gt;95%</li>
                    <li>• Payout latency target: &lt;24 hours</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Integration Support</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Access our API for programmatic monitoring and webhook alerts 
                    for your own systems integration.
                  </p>
                  <div className="space-y-2">
                    <a 
                      href="/api/docs" 
                      className="inline-block text-sm text-blue-600 hover:text-blue-800"
                    >
                      → API Documentation
                    </a>
                    <br />
                    <a 
                      href="/webhooks" 
                      className="inline-block text-sm text-blue-600 hover:text-blue-800"
                    >
                      → Webhook Configuration
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'metrics' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Performance Metrics</h2>
              <p className="text-gray-600">
                Historical performance data over the last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}
              </p>
            </div>
            <MetricsDashboard timeRange={timeRange} />
          </div>
        )}

        {activeView === 'history' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Incident History</h2>
              <p className="text-gray-600">
                Past incidents and system events over the last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}
              </p>
            </div>
            
            {/* Uptime Calendar */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Uptime History</h3>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {/* This would be populated with actual uptime data */}
                {Array.from({ length: 30 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-8 rounded ${
                      Math.random() > 0.05 ? 'bg-green-200' : 'bg-red-200'
                    } flex items-center justify-center`}
                  >
                    {30 - i}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>30 days ago</span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-200 rounded mr-1"></div>
                    <span>Operational</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-200 rounded mr-1"></div>
                    <span>Downtime</span>
                  </div>
                </div>
                <span>Today</span>
              </div>
            </div>

            {/* Recent Incidents */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900">All systems operational</h4>
                    <span className="text-xs text-gray-500">Current</span>
                  </div>
                  <p className="text-sm text-gray-600">No active incidents. All systems running normally.</p>
                </div>
                
                <div className="border-l-4 border-yellow-500 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900">CDN Performance Degradation</h4>
                    <span className="text-xs text-gray-500">2 days ago</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Temporary increase in video loading times due to CDN provider issues.
                  </p>
                  <div className="text-xs text-gray-500">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Resolved</span>
                    <span className="ml-2">Duration: 23 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Status Page</h3>
              <p className="text-sm text-gray-600">
                Real-time monitoring and transparency for our platform performance.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/api/docs" className="hover:text-gray-900">API Documentation</a></li>
                <li><a href="/webhooks" className="hover:text-gray-900">Webhook Setup</a></li>
                <li><a href="/support" className="hover:text-gray-900">Support Center</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Contact</h3>
              <p className="text-sm text-gray-600">
                For technical support or partnership inquiries, reach out to our team.
              </p>
              <div className="mt-2">
                <a 
                  href="mailto:support@platform.com" 
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  support@platform.com
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>© 2024 Platform. All rights reserved. | Last updated: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicStatusPage;