import React, { useState, useEffect } from 'react';
import { auditTrail, AuditEvent, EvidencePack, AuditEventType } from '../../lib/auditTrail';

interface ComplianceDashboardProps {
  organizationId?: string;
}

export function ComplianceDashboard({ organizationId }: ComplianceDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'evidence' | 'reports'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [organizationId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load audit statistics
      const response = await fetch(`/api/audit/stats?timeRange=30d`);
      const statsData = await response.json();
      setStats(statsData);

      // Load recent events
      const eventsResponse = await fetch(`/api/audit/events?limit=50${organizationId ? `&organizationId=${organizationId}` : ''}`);
      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-gray-600">Monitor audit trails, generate evidence packs, and ensure regulatory compliance</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'events', label: 'Audit Events' },
            { key: 'evidence', label: 'Evidence Packs' },
            { key: 'reports', label: 'Reports' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab stats={stats} />}
          {activeTab === 'events' && <EventsTab events={events} onRefresh={loadDashboardData} />}
          {activeTab === 'evidence' && <EvidenceTab organizationId={organizationId} />}
          {activeTab === 'reports' && <ReportsTab organizationId={organizationId} />}
        </>
      )}
    </div>
  );
}

function OverviewTab({ stats }: { stats: any }) {
  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Events (30d)',
      value: stats.totalEvents.toLocaleString(),
      icon: '📊',
      color: 'bg-blue-500'
    },
    {
      title: 'Unique Users',
      value: stats.uniqueUsers.toLocaleString(),
      icon: '👥',
      color: 'bg-green-500'
    },
    {
      title: 'Content Items',
      value: stats.uniqueContent.toLocaleString(),
      icon: '🎬',
      color: 'bg-purple-500'
    },
    {
      title: 'Payment Events',
      value: stats.paymentEvents.toLocaleString(),
      icon: '💳',
      color: 'bg-yellow-500'
    },
    {
      title: 'Moderation Events',
      value: stats.moderationEvents.toLocaleString(),
      icon: '🛡️',
      color: 'bg-red-500'
    },
    {
      title: 'Consent Events',
      value: stats.consentEvents.toLocaleString(),
      icon: '✍️',
      color: 'bg-indigo-500'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} rounded-lg p-3 text-white text-xl`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Event Types Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Event Types Distribution</h3>
        <div className="space-y-3">
          {Object.entries(stats.eventsByType).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{type.replace(/_/g, ' ')}</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${((count as number) / stats.totalEvents) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">{count as number}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsTab({ events, onRefresh }: { events: AuditEvent[]; onRefresh: () => void }) {
  const [filters, setFilters] = useState({
    eventType: '',
    userId: '',
    contentId: '',
    startDate: '',
    endDate: ''
  });

  const getEventTypeColor = (eventType: AuditEventType) => {
    if (eventType.includes('payment')) return 'bg-green-100 text-green-800';
    if (eventType.includes('moderation')) return 'bg-red-100 text-red-800';
    if (eventType.includes('consent')) return 'bg-blue-100 text-blue-800';
    if (eventType.includes('content')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <select
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">All Event Types</option>
            {Object.values(AuditEventType).map(type => (
              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
          
          <input
            type="text"
            placeholder="Content ID"
            value={filters.contentId}
            onChange={(e) => setFilters({ ...filters, contentId: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
          
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
          
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
        
        <div className="mt-4 flex space-x-3">
          <button
            onClick={onRefresh}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Apply Filters
          </button>
          <button
            onClick={() => setFilters({ eventType: '', userId: '', contentId: '', startDate: '', endDate: '' })}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Audit Events</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(event.eventType)}`}>
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.userId || event.walletAddress || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.contentId || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <details className="cursor-pointer">
                      <summary className="text-purple-600 hover:text-purple-800">View Details</summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-w-md">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({ organizationId }: { organizationId?: string }) {
  const [evidencePacks, setEvidencePacks] = useState<EvidencePack[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Evidence Packs</h3>
        <button
          onClick={() => setShowGenerator(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          Generate Evidence Pack
        </button>
      </div>

      {/* Evidence Packs List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Generated Evidence Packs</h4>
        </div>
        
        <div className="p-6">
          {evidencePacks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No evidence packs generated yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evidencePacks.map((pack) => (
                <div key={pack.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">Pack #{pack.id}</h5>
                      <p className="text-sm text-gray-600">
                        Type: {pack.type} | Subject: {pack.subjectId}
                      </p>
                      <p className="text-sm text-gray-600">
                        Generated: {new Date(pack.generatedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Events: {pack.metadata.totalEvents} | Files: {pack.files.length}
                      </p>
                    </div>
                    <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showGenerator && (
        <EvidencePackGenerator
          onClose={() => setShowGenerator(false)}
          onGenerated={(pack) => {
            setEvidencePacks(prev => [pack, ...prev]);
            setShowGenerator(false);
          }}
        />
      )}
    </div>
  );
}

function ReportsTab({ organizationId }: { organizationId?: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Compliance Reports</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-medium text-gray-900 mb-4">2257 Compliance Report</h4>
          <p className="text-sm text-gray-600 mb-4">
            Generate comprehensive 2257 record compliance report for all performers and content.
          </p>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Generate Report
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-medium text-gray-900 mb-4">DMCA Activity Report</h4>
          <p className="text-sm text-gray-600 mb-4">
            Summary of DMCA claims, takedowns, and anti-piracy measures.
          </p>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Generate Report
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-medium text-gray-900 mb-4">Consent Verification Report</h4>
          <p className="text-sm text-gray-600 mb-4">
            Verify all consent signatures and scene documentation.
          </p>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Generate Report
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-medium text-gray-900 mb-4">Financial Audit Report</h4>
          <p className="text-sm text-gray-600 mb-4">
            Complete financial audit trail for payments and revenue splits.
          </p>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

interface EvidencePackGeneratorProps {
  onClose: () => void;
  onGenerated: (pack: EvidencePack) => void;
}

function EvidencePackGenerator({ onClose, onGenerated }: EvidencePackGeneratorProps) {
  const [formData, setFormData] = useState({
    type: 'user' as 'user' | 'content' | 'organization' | 'legal_request',
    subjectId: '',
    includeFiles: false,
    timeRangeType: 'preset' as 'preset' | 'custom',
    presetRange: '30d',
    startDate: '',
    endDate: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let timeRange;
      if (formData.timeRangeType === 'custom') {
        timeRange = {
          start: new Date(formData.startDate).getTime(),
          end: new Date(formData.endDate).getTime()
        };
      }

      const pack = await auditTrail.generateEvidencePack({
        type: formData.type,
        subjectId: formData.subjectId,
        timeRange,
        requestedBy: 'current_user', // Get from auth context
        includeFiles: formData.includeFiles
      });

      onGenerated(pack);
    } catch (error) {
      console.error('Error generating evidence pack:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Generate Evidence Pack</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="user">User</option>
              <option value="content">Content</option>
              <option value="organization">Organization</option>
              <option value="legal_request">Legal Request</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject ID</label>
            <input
              type="text"
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter user ID, content ID, or organization ID"
              required
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includeFiles}
                onChange={(e) => setFormData({ ...formData, includeFiles: e.target.checked })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include supporting files</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}