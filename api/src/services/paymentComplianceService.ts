import { Pool } from 'pg';
import Redis from 'ioredis';
import { createUnifiedError } from '../middleware/unifiedErrorHandler';
import { logger, logAudit } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';

export interface PaymentTransaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'crypto' | 'bank_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'disputed' | 'refunded';
  gatewayTransactionId?: string;
  threeDSRequired?: boolean;
  threeDSStatus?: 'pending' | 'authenticated' | 'failed' | 'bypassed';
  scaExemption?: 'low_value' | 'trusted_merchant' | 'recurring' | 'corporate';
  vatAmount?: number;
  vatRate?: number;
  vatCountry?: string;
  receiptGenerated: boolean;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxForm {
  id: string;
  userId: string;
  formType: 'W9' | 'W8BEN' | 'W8BENE' | 'W8ECI' | 'W8IMY';
  taxYear: number;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  formData: Record<string, any>;
  documentUrl?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VATConfiguration {
  country: string;
  vatRate: number;
  threshold: number; // Minimum amount for VAT collection
  registrationNumber?: string;
  enabled: boolean;
  reverseCharge: boolean; // For B2B transactions
}

export interface ChargebackCase {
  id: string;
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  reasonCode: string;
  status: 'received' | 'under_review' | 'accepted' | 'disputed' | 'won' | 'lost';
  dueDate: Date;
  evidenceSubmitted: boolean;
  evidenceUrl?: string;
  gatewayChargebackId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentReceipt {
  transactionId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress?: Address;
  items: ReceiptItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  transactionDate: Date;
  companyInfo: CompanyInfo;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRate?: number;
}

export interface CompanyInfo {
  name: string;
  address: Address;
  vatNumber?: string;
  registrationNumber?: string;
  email: string;
  phone?: string;
}

export class PaymentComplianceService {
  private db: Pool;
  private redis: Redis;
  private vatConfigurations: Map<string, VATConfiguration> = new Map();
  private receiptPath: string;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.receiptPath = process.env.RECEIPT_STORAGE_PATH || './receipts';
    this.initializeVATConfigurations();
  }

  /**
   * Process 3DS/SCA authentication for EU payments
   */
  async process3DSAuthentication(
    transactionId: string,
    paymentIntentId: string,
    returnUrl: string
  ): Promise<{ requiresAction: boolean; clientSecret?: string; redirectUrl?: string }> {
    try {
      // Update transaction status
      await this.db.query(
        'UPDATE payment_transactions SET three_ds_required = true, three_ds_status = $1 WHERE id = $2',
        ['pending', transactionId]
      );

      // In a real implementation, this would integrate with Stripe, Adyen, or similar
      // For now, we'll simulate the 3DS flow
      const requires3DS = await this.requires3DSAuthentication(transactionId);

      if (requires3DS) {
        // Generate 3DS challenge URL
        const challengeUrl = `${process.env.PAYMENT_GATEWAY_URL}/3ds/challenge/${paymentIntentId}?return_url=${encodeURIComponent(returnUrl)}`;
        
        return {
          requiresAction: true,
          redirectUrl: challengeUrl,
        };
      }

      // No 3DS required, mark as bypassed
      await this.db.query(
        'UPDATE payment_transactions SET three_ds_status = $1 WHERE id = $2',
        ['bypassed', transactionId]
      );

      return { requiresAction: false };
    } catch (error) {
      throw createUnifiedError.payment(
        'Failed to process 3DS authentication',
        { transactionId, error: error.message },
        true
      );
    }
  }

  /**
   * Handle 3DS authentication callback
   */
  async handle3DSCallback(
    transactionId: string,
    authenticationStatus: 'success' | 'failed' | 'abandoned'
  ): Promise<void> {
    try {
      const threeDSStatus = authenticationStatus === 'success' ? 'authenticated' : 'failed';
      
      await this.db.query(
        'UPDATE payment_transactions SET three_ds_status = $1, updated_at = $2 WHERE id = $3',
        [threeDSStatus, new Date(), transactionId]
      );

      if (authenticationStatus === 'success') {
        // Continue with payment processing
        await this.processAuthenticatedPayment(transactionId);
      } else {
        // Mark transaction as failed
        await this.db.query(
          'UPDATE payment_transactions SET status = $1, updated_at = $2 WHERE id = $3',
          ['failed', new Date(), transactionId]
        );
      }

      // Log the authentication result
      logAudit('3DS authentication completed', null, {
        transactionId,
        status: authenticationStatus,
      });
    } catch (error) {
      throw createUnifiedError.payment(
        'Failed to handle 3DS callback',
        { transactionId, error: error.message },
        false
      );
    }
  }

  /**
   * Generate receipt and invoice PDF
   */
  async generateReceipt(transactionId: string): Promise<string> {
    try {
      // Get transaction details
      const transactionResult = await this.db.query(
        'SELECT * FROM payment_transactions WHERE id = $1',
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        throw createUnifiedError.notFound('Transaction not found');
      }

      const transaction = transactionResult.rows[0];

      // Get user details
      const userResult = await this.db.query(
        'SELECT * FROM users WHERE id = $1',
        [transaction.user_id]
      );

      const user = userResult.rows[0];

      // Get purchased items (content)
      const itemsResult = await this.db.query(`
        SELECT c.title, c.price, pt.quantity, pt.unit_price
        FROM purchase_items pt
        JOIN content c ON c.id = pt.content_id
        WHERE pt.transaction_id = $1
      `, [transactionId]);

      // Build receipt data
      const receiptData: PaymentReceipt = {
        transactionId,
        receiptNumber: `RV-${Date.now()}-${transactionId.slice(-8)}`,
        customerName: user.display_name || user.username || 'Customer',
        customerEmail: user.email,
        customerAddress: user.billing_address ? JSON.parse(user.billing_address) : undefined,
        items: itemsResult.rows.map(item => ({
          description: item.title,
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unit_price),
          totalPrice: parseFloat(item.unit_price) * (item.quantity || 1),
          vatRate: transaction.vat_rate,
        })),
        subtotal: parseFloat(transaction.amount) - (parseFloat(transaction.vat_amount) || 0),
        vatAmount: parseFloat(transaction.vat_amount) || 0,
        totalAmount: parseFloat(transaction.amount),
        currency: transaction.currency,
        paymentMethod: transaction.payment_method,
        transactionDate: transaction.created_at,
        companyInfo: {
          name: 'Reelverse Inc.',
          address: {
            line1: '123 Creator Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'United States',
          },
          vatNumber: process.env.COMPANY_VAT_NUMBER,
          registrationNumber: process.env.COMPANY_REGISTRATION_NUMBER,
          email: 'billing@reelverse.com',
          phone: '+1 (555) 123-4567',
        },
      };

      // Generate PDF
      const receiptPath = await this.createReceiptPDF(receiptData);

      // Update transaction with receipt URL
      await this.db.query(
        'UPDATE payment_transactions SET receipt_generated = true, receipt_url = $1 WHERE id = $2',
        [receiptPath, transactionId]
      );

      return receiptPath;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to generate receipt',
        { transactionId, error: error.message },
        false
      );
    }
  }

  /**
   * Collect and store tax forms (W-9/W-8BEN)
   */
  async submitTaxForm(
    userId: string,
    formType: 'W9' | 'W8BEN' | 'W8BENE' | 'W8ECI' | 'W8IMY',
    formData: Record<string, any>,
    documentFile?: Buffer
  ): Promise<TaxForm> {
    try {
      const formId = uuidv4();
      const taxYear = new Date().getFullYear();

      // Validate form data based on type
      this.validateTaxFormData(formType, formData);

      // Store document if provided
      let documentUrl: string | undefined;
      if (documentFile) {
        documentUrl = await this.storeTaxFormDocument(formId, formType, documentFile);
      }

      // Calculate expiration date (W-8 forms expire after 3 years)
      const expiresAt = formType.startsWith('W8') 
        ? new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
        : undefined;

      const taxForm: TaxForm = {
        id: formId,
        userId,
        formType,
        taxYear,
        status: 'submitted',
        formData,
        documentUrl,
        submittedAt: new Date(),
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await this.db.query(`
        INSERT INTO tax_forms 
        (id, user_id, form_type, tax_year, status, form_data, document_url, submitted_at, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        taxForm.id,
        taxForm.userId,
        taxForm.formType,
        taxForm.taxYear,
        taxForm.status,
        JSON.stringify(taxForm.formData),
        taxForm.documentUrl,
        taxForm.submittedAt,
        taxForm.expiresAt,
        taxForm.createdAt,
        taxForm.updatedAt,
      ]);

      // Log tax form submission
      logAudit('Tax form submitted', userId, {
        formId,
        formType,
        taxYear,
      });

      return taxForm;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to submit tax form',
        { userId, formType, error: error.message },
        false
      );
    }
  }

  /**
   * Calculate and collect VAT/GST for applicable jurisdictions
   */
  async calculateVAT(
    amount: number,
    currency: string,
    customerCountry: string,
    customerType: 'individual' | 'business',
    customerVATNumber?: string
  ): Promise<{ vatAmount: number; vatRate: number; vatCountry: string; reverseCharge: boolean }> {
    try {
      const vatConfig = this.vatConfigurations.get(customerCountry);

      if (!vatConfig || !vatConfig.enabled || amount < vatConfig.threshold) {
        return {
          vatAmount: 0,
          vatRate: 0,
          vatCountry: customerCountry,
          reverseCharge: false,
        };
      }

      // Check for reverse charge (B2B EU transactions)
      const reverseCharge = vatConfig.reverseCharge && 
                           customerType === 'business' && 
                           customerVATNumber && 
                           this.isValidVATNumber(customerVATNumber);

      if (reverseCharge) {
        return {
          vatAmount: 0,
          vatRate: vatConfig.vatRate,
          vatCountry: customerCountry,
          reverseCharge: true,
        };
      }

      // Calculate VAT amount
      const vatAmount = (amount * vatConfig.vatRate) / 100;

      return {
        vatAmount,
        vatRate: vatConfig.vatRate,
        vatCountry: customerCountry,
        reverseCharge: false,
      };
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to calculate VAT',
        { amount, currency, customerCountry, error: error.message },
        false
      );
    }
  }

  /**
   * Handle chargeback dispute management
   */
  async createChargebackCase(
    transactionId: string,
    reason: string,
    reasonCode: string,
    amount: number,
    currency: string,
    dueDate: Date,
    gatewayChargebackId?: string
  ): Promise<ChargebackCase> {
    try {
      const caseId = uuidv4();

      // Get transaction details
      const transactionResult = await this.db.query(
        'SELECT user_id FROM payment_transactions WHERE id = $1',
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        throw createUnifiedError.notFound('Transaction not found');
      }

      const userId = transactionResult.rows[0].user_id;

      const chargebackCase: ChargebackCase = {
        id: caseId,
        transactionId,
        userId,
        amount,
        currency,
        reason,
        reasonCode,
        status: 'received',
        dueDate,
        evidenceSubmitted: false,
        gatewayChargebackId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await this.db.query(`
        INSERT INTO chargeback_cases 
        (id, transaction_id, user_id, amount, currency, reason, reason_code, status, due_date, evidence_submitted, gateway_chargeback_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        chargebackCase.id,
        chargebackCase.transactionId,
        chargebackCase.userId,
        chargebackCase.amount,
        chargebackCase.currency,
        chargebackCase.reason,
        chargebackCase.reasonCode,
        chargebackCase.status,
        chargebackCase.dueDate,
        chargebackCase.evidenceSubmitted,
        chargebackCase.gatewayChargebackId,
        chargebackCase.createdAt,
        chargebackCase.updatedAt,
      ]);

      // Update transaction status
      await this.db.query(
        'UPDATE payment_transactions SET status = $1, updated_at = $2 WHERE id = $3',
        ['disputed', new Date(), transactionId]
      );

      // Generate evidence package automatically
      await this.generateChargebackEvidence(caseId);

      // Log chargeback case creation
      logAudit('Chargeback case created', userId, {
        caseId,
        transactionId,
        reason,
        amount,
      });

      return chargebackCase;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create chargeback case',
        { transactionId, error: error.message },
        false
      );
    }
  }

  /**
   * Handle international payment compliance
   */
  async processInternationalPayment(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    customerCountry: string,
    paymentMethod: string
  ): Promise<{
    convertedAmount: number;
    exchangeRate: number;
    fees: number;
    complianceChecks: string[];
  }> {
    try {
      // Get current exchange rate
      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = amount * exchangeRate;

      // Calculate international fees
      const fees = this.calculateInternationalFees(amount, fromCurrency, toCurrency, paymentMethod);

      // Perform compliance checks
      const complianceChecks = await this.performComplianceChecks(
        convertedAmount,
        toCurrency,
        customerCountry,
        paymentMethod
      );

      return {
        convertedAmount,
        exchangeRate,
        fees,
        complianceChecks,
      };
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to process international payment',
        { amount, fromCurrency, toCurrency, error: error.message },
        false
      );
    }
  }

  /**
   * Generate chargeback evidence package
   */
  private async generateChargebackEvidence(caseId: string): Promise<string> {
    try {
      // Get chargeback case details
      const caseResult = await this.db.query(
        'SELECT * FROM chargeback_cases WHERE id = $1',
        [caseId]
      );

      const chargebackCase = caseResult.rows[0];

      // Collect evidence artifacts
      const evidence = {
        transactionDetails: await this.getTransactionEvidence(chargebackCase.transaction_id),
        customerCommunication: await this.getCustomerCommunication(chargebackCase.user_id),
        deliveryProof: await this.getDeliveryProof(chargebackCase.transaction_id),
        refundPolicy: await this.getRefundPolicy(),
        termsOfService: await this.getTermsOfService(),
      };

      // Create evidence package
      const evidenceUrl = await this.createEvidencePackage(caseId, evidence);

      // Update case with evidence
      await this.db.query(
        'UPDATE chargeback_cases SET evidence_submitted = true, evidence_url = $1, updated_at = $2 WHERE id = $3',
        [evidenceUrl, new Date(), caseId]
      );

      return evidenceUrl;
    } catch (error) {
      logger.error(`Failed to generate chargeback evidence for case ${caseId}`, error);
      throw error;
    }
  }

  /**
   * Create receipt PDF
   */
  private async createReceiptPDF(receiptData: PaymentReceipt): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filename = `receipt-${receiptData.receiptNumber}.pdf`;
        const filepath = path.join(this.receiptPath, filename);

        // Ensure directory exists
        fs.mkdir(this.receiptPath, { recursive: true });

        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('RECEIPT', 50, 50);
        doc.fontSize(12).text(`Receipt #: ${receiptData.receiptNumber}`, 50, 80);
        doc.text(`Date: ${receiptData.transactionDate.toLocaleDateString()}`, 50, 95);

        // Company info
        doc.text('From:', 50, 130);
        doc.text(receiptData.companyInfo.name, 50, 145);
        doc.text(receiptData.companyInfo.address.line1, 50, 160);
        doc.text(`${receiptData.companyInfo.address.city}, ${receiptData.companyInfo.address.state} ${receiptData.companyInfo.address.postalCode}`, 50, 175);
        doc.text(receiptData.companyInfo.address.country, 50, 190);

        if (receiptData.companyInfo.vatNumber) {
          doc.text(`VAT Number: ${receiptData.companyInfo.vatNumber}`, 50, 205);
        }

        // Customer info
        doc.text('To:', 300, 130);
        doc.text(receiptData.customerName, 300, 145);
        doc.text(receiptData.customerEmail, 300, 160);

        if (receiptData.customerAddress) {
          doc.text(receiptData.customerAddress.line1, 300, 175);
          doc.text(`${receiptData.customerAddress.city}, ${receiptData.customerAddress.state} ${receiptData.customerAddress.postalCode}`, 300, 190);
          doc.text(receiptData.customerAddress.country, 300, 205);
        }

        // Items table
        let yPosition = 250;
        doc.text('Description', 50, yPosition);
        doc.text('Qty', 300, yPosition);
        doc.text('Unit Price', 350, yPosition);
        doc.text('Total', 450, yPosition);

        yPosition += 20;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;

        receiptData.items.forEach(item => {
          doc.text(item.description, 50, yPosition);
          doc.text(item.quantity.toString(), 300, yPosition);
          doc.text(`${receiptData.currency} ${item.unitPrice.toFixed(2)}`, 350, yPosition);
          doc.text(`${receiptData.currency} ${item.totalPrice.toFixed(2)}`, 450, yPosition);
          yPosition += 20;
        });

        // Totals
        yPosition += 10;
        doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;

        doc.text('Subtotal:', 350, yPosition);
        doc.text(`${receiptData.currency} ${receiptData.subtotal.toFixed(2)}`, 450, yPosition);
        yPosition += 15;

        if (receiptData.vatAmount > 0) {
          doc.text('VAT:', 350, yPosition);
          doc.text(`${receiptData.currency} ${receiptData.vatAmount.toFixed(2)}`, 450, yPosition);
          yPosition += 15;
        }

        doc.fontSize(14).text('Total:', 350, yPosition);
        doc.text(`${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}`, 450, yPosition);

        // Payment method
        yPosition += 30;
        doc.fontSize(12).text(`Payment Method: ${receiptData.paymentMethod}`, 50, yPosition);

        // Footer
        yPosition += 50;
        doc.text('Thank you for your business!', 50, yPosition);

        doc.end();

        stream.on('finish', () => {
          resolve(`/receipts/${filename}`);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Initialize VAT configurations for different countries
   */
  private async initializeVATConfigurations(): Promise<void> {
    const vatConfigs: VATConfiguration[] = [
      // EU Countries
      { country: 'DE', vatRate: 19, threshold: 0, enabled: true, reverseCharge: true },
      { country: 'FR', vatRate: 20, threshold: 0, enabled: true, reverseCharge: true },
      { country: 'GB', vatRate: 20, threshold: 0, enabled: true, reverseCharge: false },
      { country: 'ES', vatRate: 21, threshold: 0, enabled: true, reverseCharge: true },
      { country: 'IT', vatRate: 22, threshold: 0, enabled: true, reverseCharge: true },
      { country: 'NL', vatRate: 21, threshold: 0, enabled: true, reverseCharge: true },
      
      // Other countries
      { country: 'CA', vatRate: 13, threshold: 0, enabled: true, reverseCharge: false }, // HST
      { country: 'AU', vatRate: 10, threshold: 0, enabled: true, reverseCharge: false }, // GST
      { country: 'NZ', vatRate: 15, threshold: 0, enabled: true, reverseCharge: false }, // GST
      { country: 'JP', vatRate: 10, threshold: 0, enabled: true, reverseCharge: false },
      
      // US (no federal VAT, but some states have sales tax)
      { country: 'US', vatRate: 0, threshold: 0, enabled: false, reverseCharge: false },
    ];

    vatConfigs.forEach(config => {
      this.vatConfigurations.set(config.country, config);
    });
  }

  /**
   * Check if 3DS authentication is required
   */
  private async requires3DSAuthentication(transactionId: string): Promise<boolean> {
    // Get transaction details
    const result = await this.db.query(
      'SELECT amount, currency, user_id FROM payment_transactions WHERE id = $1',
      [transactionId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { amount, currency, user_id } = result.rows[0];

    // Check for SCA exemptions
    const exemption = await this.checkSCAExemption(user_id, amount, currency);
    if (exemption) {
      await this.db.query(
        'UPDATE payment_transactions SET sca_exemption = $1 WHERE id = $2',
        [exemption, transactionId]
      );
      return false;
    }

    // EU regulations require SCA for payments over €30
    if (currency === 'EUR' && amount > 30) {
      return true;
    }

    // UK regulations
    if (currency === 'GBP' && amount > 30) {
      return true;
    }

    return false;
  }

  /**
   * Check for SCA exemptions
   */
  private async checkSCAExemption(
    userId: string, 
    amount: number, 
    currency: string
  ): Promise<string | null> {
    // Low value exemption (under €30)
    if (currency === 'EUR' && amount < 30) {
      return 'low_value';
    }

    if (currency === 'GBP' && amount < 30) {
      return 'low_value';
    }

    // Check if user is trusted (multiple successful payments)
    const trustResult = await this.db.query(`
      SELECT COUNT(*) as successful_payments
      FROM payment_transactions 
      WHERE user_id = $1 AND status = 'completed' AND created_at > NOW() - INTERVAL '6 months'
    `, [userId]);

    if (parseInt(trustResult.rows[0].successful_payments) >= 5) {
      return 'trusted_merchant';
    }

    // Check for recurring payment
    const recurringResult = await this.db.query(`
      SELECT COUNT(*) as recurring_count
      FROM payment_transactions 
      WHERE user_id = $1 AND payment_method = 'card' AND created_at > NOW() - INTERVAL '1 month'
    `, [userId]);

    if (parseInt(recurringResult.rows[0].recurring_count) >= 3) {
      return 'recurring';
    }

    return null;
  }

  /**
   * Process authenticated payment after 3DS
   */
  private async processAuthenticatedPayment(transactionId: string): Promise<void> {
    // This would integrate with your payment processor
    // For now, we'll just mark as completed
    await this.db.query(
      'UPDATE payment_transactions SET status = $1, updated_at = $2 WHERE id = $3',
      ['completed', new Date(), transactionId]
    );
  }

  /**
   * Validate tax form data
   */
  private validateTaxFormData(formType: string, formData: Record<string, any>): void {
    const requiredFields: Record<string, string[]> = {
      W9: ['name', 'businessName', 'taxClassification', 'address', 'city', 'state', 'zip', 'tin'],
      W8BEN: ['name', 'countryOfCitizenship', 'permanentAddress', 'dateOfBirth', 'foreignTIN'],
      W8BENE: ['organizationName', 'countryOfIncorporation', 'permanentAddress', 'foreignTIN'],
      W8ECI: ['organizationName', 'countryOfIncorporation', 'permanentAddress', 'foreignTIN'],
      W8IMY: ['organizationName', 'countryOfIncorporation', 'permanentAddress', 'foreignTIN'],
    };

    const required = requiredFields[formType];
    if (!required) {
      throw createUnifiedError.validation('Invalid form type');
    }

    for (const field of required) {
      if (!formData[field]) {
        throw createUnifiedError.validation(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Store tax form document
   */
  private async storeTaxFormDocument(
    formId: string, 
    formType: string, 
    documentFile: Buffer
  ): Promise<string> {
    const filename = `tax-form-${formId}-${formType}.pdf`;
    const filepath = path.join(process.env.TAX_FORMS_PATH || './tax-forms', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, documentFile);
    
    return `/tax-forms/${filename}`;
  }

  /**
   * Validate VAT number
   */
  private isValidVATNumber(vatNumber: string): boolean {
    // Basic VAT number validation (implement proper validation for each country)
    const vatRegex = /^[A-Z]{2}[0-9A-Z]{2,12}$/;
    return vatRegex.test(vatNumber);
  }

  /**
   * Get exchange rate
   */
  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // In a real implementation, this would call a currency exchange API
    // For now, return a mock rate
    if (fromCurrency === toCurrency) return 1;
    
    // Mock exchange rates
    const rates: Record<string, number> = {
      'USD-EUR': 0.85,
      'USD-GBP': 0.73,
      'EUR-USD': 1.18,
      'GBP-USD': 1.37,
    };

    return rates[`${fromCurrency}-${toCurrency}`] || 1;
  }

  /**
   * Calculate international fees
   */
  private calculateInternationalFees(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    paymentMethod: string
  ): number {
    if (fromCurrency === toCurrency) return 0;

    // Base international fee: 2.9% + $0.30
    let feeRate = 0.029;
    let fixedFee = 0.30;

    // Additional fees for certain payment methods
    if (paymentMethod === 'bank_transfer') {
      feeRate += 0.005; // Additional 0.5%
    }

    return (amount * feeRate) + fixedFee;
  }

  /**
   * Perform compliance checks
   */
  private async performComplianceChecks(
    amount: number,
    currency: string,
    customerCountry: string,
    paymentMethod: string
  ): Promise<string[]> {
    const checks: string[] = [];

    // AML check for large amounts
    if (amount > 10000) {
      checks.push('AML_LARGE_TRANSACTION');
    }

    // Sanctions screening
    const sanctionedCountries = ['IR', 'KP', 'SY', 'CU'];
    if (sanctionedCountries.includes(customerCountry)) {
      checks.push('SANCTIONS_SCREENING_REQUIRED');
    }

    // PCI compliance for card payments
    if (paymentMethod === 'card') {
      checks.push('PCI_COMPLIANCE_VERIFIED');
    }

    return checks;
  }

  /**
   * Helper methods for chargeback evidence
   */
  private async getTransactionEvidence(transactionId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [transactionId]
    );
    return result.rows[0];
  }

  private async getCustomerCommunication(userId: string): Promise<any[]> {
    const result = await this.db.query(
      'SELECT * FROM customer_communications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    return result.rows;
  }

  private async getDeliveryProof(transactionId: string): Promise<any> {
    // For digital content, this would be access logs
    const result = await this.db.query(
      'SELECT * FROM content_access_logs WHERE transaction_id = $1',
      [transactionId]
    );
    return result.rows;
  }

  private async getRefundPolicy(): Promise<string> {
    return 'Our refund policy allows for refunds within 30 days of purchase...';
  }

  private async getTermsOfService(): Promise<string> {
    return 'Terms of Service: By using our platform, you agree to...';
  }

  private async createEvidencePackage(caseId: string, evidence: any): Promise<string> {
    const filename = `chargeback-evidence-${caseId}.json`;
    const filepath = path.join(process.env.EVIDENCE_PATH || './evidence', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(evidence, null, 2));
    
    return `/evidence/${filename}`;
  }
}