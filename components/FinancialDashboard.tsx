import React, { useState, useEffect } from 'react';
import { 
  financialOperationsService, 
  Invoice, 
  FinancialTransaction, 
  ReconciliationReport,
  AuditExport,
  CurrencyConfig 
} from '../services/financialOperationsService';

interface FinancialDashboardProps {
  userId?: string;
  isAdmin?: boolean;
}

interface FinancialSummary {
  totalRevenue: number;
  totalPayouts: number;
  netIncome: number;
  pendingTransactions: number;
  currency: string;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  userId,
  isAdmin = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices' | 'reconciliation' | 'exports'>('overview');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reconciliationReports, setReconciliationReports] = useState<ReconciliationReport[]>([]);
  const [auditExports, setAuditExports] = useState<AuditExport[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);

  // Form states
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    type: 'transactions' as AuditExport['type'],
    format: 'csv' as AuditExport['format'],
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadFinancialData();
  }, [userId, selectedCurrency]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      
      const supportedCurrencies = financialOperationsService.getSupportedCurrencies();
      setCurrencies(supportedCurrencies);

      if (userId) {
        const userTransactions = financialOperationsService.getUserTransactions(userId);
        const userInvoices = financialOperationsService.getUserInvoices(userId);
        
        setTransactions(userTransactions);
        setInvoices(userInvoices);
        
        // Calculate summary
        const revenue = userTransactions
          .filter(t => t.type === 'payment' && t.status === 'completed')
          .reduce((sum, t) => sum + (t.currency === selectedCurrency ? t.amount : 0), 0);
        
        const payouts = userTransactions
          .filter(t => t.type === 'payout' && t.status === 'completed')
          .reduce((sum, t) => sum + (t.currency === selectedCurrency ? t.amount : 0), 0);
        
        const pending = userTransactions.filter(t => t.status === 'pending').length;
        
        setSummary({
          totalRevenue: revenue,
          totalPayouts: payouts,
          netIncome: revenue - payouts,
          pendingTransactions: pending,
          currency: selectedCurrency
        });
      }
    } catch (error) {
      console.error('Failed to load financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (invoiceData: any) => {
    try {
      if (!userId) return;
      
      const invoice = await financialOperationsService.createInvoice(
        userId,
        invoiceData.region,
        invoiceData.currency,
        invoiceData.items
      );
      
      setInvoices([invoice, ...invoices]);
      setShowCreateInvoice(false);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      alert('Failed to create invoice. Please try again.');
    }
  };

  const handleGenerateExport = async () => {
    try {
      if (!userId) return;
      
      const auditExport = await financialOperationsService.generateAuditExport(
        exportConfig.type,
        exportConfig.format,
        new Date(exportConfig.startDate),
        new Date(exportConfig.endDate),
        { userId },
        userId
      );
      
      setAuditExports([auditExport, ...auditExports]);
      setShowExportDialog(false);
      alert('Export generation started. You will be notified when it\'s ready.');
    } catch (error) {
      console.error('Failed to generate export:', error);
      alert('Failed to generate export. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const currencyConfig = currencies.find(c => c.code === currency);
    const symbol = currencyConfig?.symbol || currency;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currencyConfig?.decimalPlaces || 2,
      maximumFractionDigits: currencyConfig?.decimalPlaces || 2
    }).format(amount).replace(currency, symbol);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
      case 'ready':
        return 'text-green-600 bg-green-100';
      case 'pending':
      case 'generating':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
      case 'overdue':
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading financial data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
            <p className="text-gray-600">Manage invoices, transactions, and financial reports.</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {currencies.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
            {userId && (
              <button
                onClick={() => setShowCreateInvoice(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalRevenue, summary.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">💸</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Payouts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalPayouts, summary.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Net Income</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.netIncome, summary.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <span className="text-2xl">⏳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.pendingTransactions}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', count: null },
            { id: 'transactions', label: 'Transactions', count: transactions.length },
            { id: 'invoices', label: 'Invoices', count: invoices.length },
            { id: 'reconciliation', label: 'Reconciliation', count: reconciliationReports.length },
            { id: 'exports', label: 'Exports', count: auditExports.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{transaction.type}</p>
                    <p className="text-sm text-gray-500">{transaction.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h3>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.number}</p>
                    <p className="text-sm text-gray-500">Due {formatDate(invoice.dueAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
              <button
                onClick={() => setShowExportDialog(true)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize font-medium text-gray-900">{transaction.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issued
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {invoice.number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.issuedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.dueAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Export</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Type</label>
                <select
                  value={exportConfig.type}
                  onChange={(e) => setExportConfig({
                    ...exportConfig,
                    type: e.target.value as AuditExport['type']
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="transactions">Transactions</option>
                  <option value="invoices">Invoices</option>
                  <option value="reconciliation">Reconciliation Reports</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <select
                  value={exportConfig.format}
                  onChange={(e) => setExportConfig({
                    ...exportConfig,
                    format: e.target.value as AuditExport['format']
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="json">JSON</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={exportConfig.startDate}
                    onChange={(e) => setExportConfig({
                      ...exportConfig,
                      startDate: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={exportConfig.endDate}
                    onChange={(e) => setExportConfig({
                      ...exportConfig,
                      endDate: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleGenerateExport}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Generate Export
              </button>
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};