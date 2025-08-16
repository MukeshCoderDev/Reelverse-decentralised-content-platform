import { EventEmitter } from 'events';

export interface Invoice {
  id: string;
  number: string;
  userId: string;
  region: string;
  currency: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  items: InvoiceItem[];
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  metadata: Record<string, any>;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  category: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  roundingMode: 'round' | 'floor' | 'ceil';
  exchangeRate: number; // to USD
  lastUpdated: Date;
}

export interface FinancialTransaction {
  id: string;
  type: 'payment' | 'payout' | 'refund' | 'fee' | 'adjustment';
  userId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountUSD: number;
  description: string;
  reference?: string;
  invoiceId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  processedAt?: Date;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface ReconciliationReport {
  id: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  currency: string;
  summary: {
    totalRevenue: number;
    totalPayouts: number;
    totalFees: number;
    netIncome: number;
    transactionCount: number;
  };
  discrepancies: FinancialDiscrepancy[];
  status: 'pending' | 'reviewed' | 'approved';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface FinancialDiscrepancy {
  id: string;
  type: 'missing_transaction' | 'amount_mismatch' | 'currency_mismatch' | 'duplicate_transaction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedAmount?: number;
  actualAmount?: number;
  transactionId?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

export interface AuditExport {
  id: string;
  type: 'transactions' | 'invoices' | 'reconciliation' | 'tax_report';
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  period: {
    startDate: Date;
    endDate: Date;
  };
  filters: Record<string, any>;
  status: 'generating' | 'ready' | 'expired' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  recordCount: number;
  requestedBy: string;
  requestedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface ExchangeRateProvider {
  name: string;
  apiUrl: string;
  apiKey?: string;
  updateFrequency: number; // minutes
  supportedCurrencies: string[];
}

export class FinancialOperationsService extends EventEmitter {
  private invoices: Map<string, Invoice> = new Map();
  private transactions: Map<string, FinancialTransaction> = new Map();
  private currencies: Map<string, CurrencyConfig> = new Map();
  private reconciliationReports: Map<string, ReconciliationReport> = new Map();
  private auditExports: Map<string, AuditExport> = new Map();
  private invoiceCounters: Map<string, number> = new Map(); // region -> counter
  private exchangeRateProviders: ExchangeRateProvider[] = [];

  constructor() {
    super();
    this.initializeDefaultCurrencies();
    this.initializeExchangeRateProviders();
    this.startExchangeRateUpdater();
  }

  private initializeDefaultCurrencies(): void {
    const defaultCurrencies: CurrencyConfig[] = [
      {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        decimalPlaces: 2,
        roundingMode: 'round',
        exchangeRate: 1.0,
        lastUpdated: new Date()
      },
      {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        decimalPlaces: 2,
        roundingMode: 'round',
        exchangeRate: 0.85,
        lastUpdated: new Date()
      },
      {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound',
        decimalPlaces: 2,
        roundingMode: 'round',
        exchangeRate: 0.73,
        lastUpdated: new Date()
      },
      {
        code: 'JPY',
        symbol: '¥',
        name: 'Japanese Yen',
        decimalPlaces: 0,
        roundingMode: 'round',
        exchangeRate: 150.0,
        lastUpdated: new Date()
      },
      {
        code: 'CAD',
        symbol: 'C$',
        name: 'Canadian Dollar',
        decimalPlaces: 2,
        roundingMode: 'round',
        exchangeRate: 1.35,
        lastUpdated: new Date()
      },
      {
        code: 'AUD',
        symbol: 'A$',
        name: 'Australian Dollar',
        decimalPlaces: 2,
        roundingMode: 'round',
        exchangeRate: 1.55,
        lastUpdated: new Date()
      }
    ];

    defaultCurrencies.forEach(currency => {
      this.currencies.set(currency.code, currency);
    });
  }

  private initializeExchangeRateProviders(): void {
    this.exchangeRateProviders = [
      {
        name: 'ExchangeRate-API',
        apiUrl: 'https://api.exchangerate-api.com/v4/latest/USD',
        updateFrequency: 60, // 1 hour
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY']
      },
      {
        name: 'Fixer.io',
        apiUrl: 'https://api.fixer.io/latest',
        apiKey: process.env.FIXER_API_KEY,
        updateFrequency: 30, // 30 minutes
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
      }
    ];
  }

  // Invoice Management
  public async createInvoice(
    userId: string,
    region: string,
    currency: string,
    items: Omit<InvoiceItem, 'id' | 'totalPrice' | 'taxAmount'>[]
  ): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber(region);
    const currencyConfig = this.currencies.get(currency);
    
    if (!currencyConfig) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    // Calculate item totals and taxes
    const processedItems: InvoiceItem[] = items.map(item => {
      const totalPrice = this.roundCurrency(item.quantity * item.unitPrice, currency);
      const taxAmount = this.roundCurrency(totalPrice * item.taxRate, currency);
      
      return {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...item,
        totalPrice,
        taxAmount
      };
    });

    // Calculate invoice totals
    const amount = this.roundCurrency(
      processedItems.reduce((sum, item) => sum + item.totalPrice, 0),
      currency
    );
    
    const taxAmount = this.roundCurrency(
      processedItems.reduce((sum, item) => sum + item.taxAmount, 0),
      currency
    );
    
    const totalAmount = this.roundCurrency(amount + taxAmount, currency);

    const invoice: Invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      number: invoiceNumber,
      userId,
      region,
      currency,
      amount,
      taxAmount,
      totalAmount,
      items: processedItems,
      status: 'draft',
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {}
    };

    this.invoices.set(invoice.id, invoice);
    this.emit('invoiceCreated', invoice);

    return invoice;
  }

  private async generateInvoiceNumber(region: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const regionPrefix = this.getRegionPrefix(region);
    
    // Get or initialize counter for this region/year
    const counterKey = `${region}_${currentYear}`;
    const currentCounter = this.invoiceCounters.get(counterKey) || 0;
    const newCounter = currentCounter + 1;
    
    this.invoiceCounters.set(counterKey, newCounter);

    // Format based on regional requirements
    switch (region) {
      case 'EU':
      case 'DE':
      case 'FR':
        // European format: YYYY-REGION-NNNNNN
        return `${currentYear}-${regionPrefix}-${newCounter.toString().padStart(6, '0')}`;
      
      case 'US':
        // US format: REGION-YYYY-NNNNNN
        return `${regionPrefix}-${currentYear}-${newCounter.toString().padStart(6, '0')}`;
      
      case 'UK':
        // UK format: REGION/YYYY/NNNNNN
        return `${regionPrefix}/${currentYear}/${newCounter.toString().padStart(6, '0')}`;
      
      case 'AU':
        // Australian format: YYYY.REGION.NNNNNN
        return `${currentYear}.${regionPrefix}.${newCounter.toString().padStart(6, '0')}`;
      
      default:
        // Default international format
        return `${regionPrefix}-${currentYear}-${newCounter.toString().padStart(6, '0')}`;
    }
  }

  private getRegionPrefix(region: string): string {
    const prefixes: Record<string, string> = {
      'US': 'US',
      'EU': 'EU',
      'UK': 'UK',
      'DE': 'DE',
      'FR': 'FR',
      'AU': 'AU',
      'CA': 'CA',
      'JP': 'JP'
    };
    return prefixes[region] || 'INT';
  }

  // Currency Operations
  public roundCurrency(amount: number, currencyCode: string): number {
    const currency = this.currencies.get(currencyCode);
    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    const multiplier = Math.pow(10, currency.decimalPlaces);
    
    switch (currency.roundingMode) {
      case 'floor':
        return Math.floor(amount * multiplier) / multiplier;
      case 'ceil':
        return Math.ceil(amount * multiplier) / multiplier;
      case 'round':
      default:
        return Math.round(amount * multiplier) / multiplier;
    }
  }

  public async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ amount: number; rate: number; timestamp: Date }> {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1.0, timestamp: new Date() };
    }

    const fromConfig = this.currencies.get(fromCurrency);
    const toConfig = this.currencies.get(toCurrency);

    if (!fromConfig || !toConfig) {
      throw new Error(`Currency conversion not supported: ${fromCurrency} -> ${toCurrency}`);
    }

    // Convert through USD as base currency
    const usdAmount = amount / fromConfig.exchangeRate;
    const convertedAmount = usdAmount * toConfig.exchangeRate;
    const roundedAmount = this.roundCurrency(convertedAmount, toCurrency);
    const rate = toConfig.exchangeRate / fromConfig.exchangeRate;

    return {
      amount: roundedAmount,
      rate,
      timestamp: new Date()
    };
  }

  // Transaction Management
  public async recordTransaction(
    type: FinancialTransaction['type'],
    userId: string,
    amount: number,
    currency: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<FinancialTransaction> {
    const currencyConfig = this.currencies.get(currency);
    if (!currencyConfig) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    // Convert to USD for standardization
    const usdConversion = await this.convertCurrency(amount, currency, 'USD');

    const transaction: FinancialTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId,
      amount: this.roundCurrency(amount, currency),
      currency,
      exchangeRate: currencyConfig.exchangeRate,
      amountUSD: usdConversion.amount,
      description,
      status: 'pending',
      createdAt: new Date(),
      metadata
    };

    this.transactions.set(transaction.id, transaction);
    this.emit('transactionRecorded', transaction);

    return transaction;
  }

  public async completeTransaction(transactionId: string): Promise<FinancialTransaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = 'completed';
    transaction.processedAt = new Date();
    
    this.transactions.set(transactionId, transaction);
    this.emit('transactionCompleted', transaction);

    return transaction;
  }

  // Reconciliation
  public async generateReconciliationReport(
    startDate: Date,
    endDate: Date,
    currency: string = 'USD'
  ): Promise<ReconciliationReport> {
    const transactions = Array.from(this.transactions.values())
      .filter(t => 
        t.createdAt >= startDate && 
        t.createdAt <= endDate &&
        t.status === 'completed'
      );

    // Convert all amounts to the specified currency
    const convertedTransactions = await Promise.all(
      transactions.map(async (t) => {
        const converted = await this.convertCurrency(t.amount, t.currency, currency);
        return { ...t, convertedAmount: converted.amount };
      })
    );

    // Calculate summary
    const revenue = convertedTransactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.convertedAmount, 0);

    const payouts = convertedTransactions
      .filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + t.convertedAmount, 0);

    const fees = convertedTransactions
      .filter(t => t.type === 'fee')
      .reduce((sum, t) => sum + t.convertedAmount, 0);

    const netIncome = revenue - payouts - fees;

    // Detect discrepancies
    const discrepancies = await this.detectDiscrepancies(convertedTransactions, currency);

    const report: ReconciliationReport = {
      id: `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      period: { startDate, endDate },
      currency,
      summary: {
        totalRevenue: this.roundCurrency(revenue, currency),
        totalPayouts: this.roundCurrency(payouts, currency),
        totalFees: this.roundCurrency(fees, currency),
        netIncome: this.roundCurrency(netIncome, currency),
        transactionCount: transactions.length
      },
      discrepancies,
      status: 'pending',
      createdAt: new Date()
    };

    this.reconciliationReports.set(report.id, report);
    this.emit('reconciliationReportGenerated', report);

    return report;
  }

  private async detectDiscrepancies(
    transactions: any[],
    currency: string
  ): Promise<FinancialDiscrepancy[]> {
    const discrepancies: FinancialDiscrepancy[] = [];

    // Check for duplicate transactions
    const transactionHashes = new Map<string, any[]>();
    
    transactions.forEach(t => {
      const hash = `${t.userId}_${t.amount}_${t.type}_${t.createdAt.toDateString()}`;
      if (!transactionHashes.has(hash)) {
        transactionHashes.set(hash, []);
      }
      transactionHashes.get(hash)!.push(t);
    });

    transactionHashes.forEach((duplicates, hash) => {
      if (duplicates.length > 1) {
        discrepancies.push({
          id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'duplicate_transaction',
          severity: 'medium',
          description: `Found ${duplicates.length} duplicate transactions`,
          transactionId: duplicates[0].id,
          resolved: false
        });
      }
    });

    // Check for unusual amounts (potential data entry errors)
    const amounts = transactions.map(t => t.convertedAmount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
    );

    transactions.forEach(t => {
      if (Math.abs(t.convertedAmount - avgAmount) > 3 * stdDev) {
        discrepancies.push({
          id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'amount_mismatch',
          severity: 'low',
          description: `Transaction amount ${t.convertedAmount} is unusually high/low`,
          transactionId: t.id,
          actualAmount: t.convertedAmount,
          expectedAmount: avgAmount,
          resolved: false
        });
      }
    });

    return discrepancies;
  }

  // Audit Export
  public async generateAuditExport(
    type: AuditExport['type'],
    format: AuditExport['format'],
    startDate: Date,
    endDate: Date,
    filters: Record<string, any> = {},
    requestedBy: string
  ): Promise<AuditExport> {
    const auditExport: AuditExport = {
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      format,
      period: { startDate, endDate },
      filters,
      status: 'generating',
      recordCount: 0,
      requestedBy,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.auditExports.set(auditExport.id, auditExport);

    // Generate export asynchronously
    this.generateExportFile(auditExport);

    return auditExport;
  }

  private async generateExportFile(auditExport: AuditExport): Promise<void> {
    try {
      let data: any[] = [];
      
      switch (auditExport.type) {
        case 'transactions':
          data = Array.from(this.transactions.values())
            .filter(t => 
              t.createdAt >= auditExport.period.startDate &&
              t.createdAt <= auditExport.period.endDate
            );
          break;
        
        case 'invoices':
          data = Array.from(this.invoices.values())
            .filter(i => 
              i.issuedAt >= auditExport.period.startDate &&
              i.issuedAt <= auditExport.period.endDate
            );
          break;
        
        case 'reconciliation':
          data = Array.from(this.reconciliationReports.values())
            .filter(r => 
              r.createdAt >= auditExport.period.startDate &&
              r.createdAt <= auditExport.period.endDate
            );
          break;
      }

      // Apply filters
      if (auditExport.filters.currency) {
        data = data.filter((item: any) => item.currency === auditExport.filters.currency);
      }
      
      if (auditExport.filters.userId) {
        data = data.filter((item: any) => item.userId === auditExport.filters.userId);
      }

      // Generate file based on format
      const fileContent = await this.formatExportData(data, auditExport.format);
      const fileUrl = await this.saveExportFile(auditExport.id, fileContent, auditExport.format);

      // Update export status
      auditExport.status = 'ready';
      auditExport.fileUrl = fileUrl;
      auditExport.fileSize = fileContent.length;
      auditExport.recordCount = data.length;
      auditExport.completedAt = new Date();

      this.auditExports.set(auditExport.id, auditExport);
      this.emit('auditExportReady', auditExport);

    } catch (error) {
      auditExport.status = 'failed';
      this.auditExports.set(auditExport.id, auditExport);
      this.emit('auditExportFailed', { auditExport, error });
    }
  }

  private async formatExportData(data: any[], format: AuditExport['format']): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(','),
          ...data.map(row => 
            headers.map(header => {
              const value = row[header];
              return typeof value === 'string' && value.includes(',') 
                ? `"${value}"` 
                : value;
            }).join(',')
          )
        ];
        return csvRows.join('\n');
      
      case 'xlsx':
        // In a real implementation, you'd use a library like xlsx
        return JSON.stringify(data); // Placeholder
      
      case 'pdf':
        // In a real implementation, you'd use a library like pdfkit
        return JSON.stringify(data); // Placeholder
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async saveExportFile(exportId: string, content: string, format: string): Promise<string> {
    // In a real implementation, this would save to cloud storage
    const filename = `export_${exportId}.${format}`;
    const url = `https://storage.example.com/exports/${filename}`;
    
    console.log(`Saved export file: ${filename} (${content.length} bytes)`);
    
    return url;
  }

  // Exchange Rate Management
  private startExchangeRateUpdater(): void {
    // Update exchange rates every hour
    setInterval(async () => {
      await this.updateExchangeRates();
    }, 60 * 60 * 1000);

    // Initial update
    this.updateExchangeRates();
  }

  private async updateExchangeRates(): Promise<void> {
    for (const provider of this.exchangeRateProviders) {
      try {
        const rates = await this.fetchExchangeRates(provider);
        
        for (const [currencyCode, rate] of Object.entries(rates)) {
          const currency = this.currencies.get(currencyCode);
          if (currency) {
            currency.exchangeRate = rate as number;
            currency.lastUpdated = new Date();
            this.currencies.set(currencyCode, currency);
          }
        }

        this.emit('exchangeRatesUpdated', { provider: provider.name, rates });
        break; // Use first successful provider
        
      } catch (error) {
        console.error(`Failed to update exchange rates from ${provider.name}:`, error);
      }
    }
  }

  private async fetchExchangeRates(provider: ExchangeRateProvider): Promise<Record<string, number>> {
    // Simulate API call
    const mockRates: Record<string, number> = {
      'USD': 1.0,
      'EUR': 0.85 + (Math.random() - 0.5) * 0.02,
      'GBP': 0.73 + (Math.random() - 0.5) * 0.02,
      'JPY': 150.0 + (Math.random() - 0.5) * 5,
      'CAD': 1.35 + (Math.random() - 0.5) * 0.05,
      'AUD': 1.55 + (Math.random() - 0.5) * 0.05
    };

    return mockRates;
  }

  // Getters
  public getInvoice(invoiceId: string): Invoice | undefined {
    return this.invoices.get(invoiceId);
  }

  public getTransaction(transactionId: string): FinancialTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  public getReconciliationReport(reportId: string): ReconciliationReport | undefined {
    return this.reconciliationReports.get(reportId);
  }

  public getAuditExport(exportId: string): AuditExport | undefined {
    return this.auditExports.get(exportId);
  }

  public getSupportedCurrencies(): CurrencyConfig[] {
    return Array.from(this.currencies.values());
  }

  public getUserTransactions(userId: string, limit: number = 100): FinancialTransaction[] {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  public getUserInvoices(userId: string, limit: number = 100): Invoice[] {
    return Array.from(this.invoices.values())
      .filter(i => i.userId === userId)
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
      .slice(0, limit);
  }
}

export const financialOperationsService = new FinancialOperationsService();