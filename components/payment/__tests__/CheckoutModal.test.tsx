import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckoutModal } from '../CheckoutModal';
import { useWallet } from '../../../contexts/WalletContext';
import { PaymentService } from '../../../services/paymentService';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock the payment service
jest.mock('../../../services/paymentService');
const mockPaymentService = {
  processUSDCPayment: jest.fn(),
  processFiatPayment: jest.fn(),
  getInstance: jest.fn()
};
(PaymentService.getInstance as jest.Mock).mockReturnValue(mockPaymentService);

describe('CheckoutModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    contentId: 'test-content-123',
    contentTitle: 'Amazing Video Content',
    creatorName: 'Test Creator',
    priceUSDC: 5000000, // $5 USDC
    priceFiat: 4.99,
    entitlementType: 'ppv' as const
  };

  const mockWalletState = {
    isConnected: true,
    account: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue(mockWalletState as any);
  });

  it('renders checkout modal with content info', () => {
    render(<CheckoutModal {...mockProps} />);

    expect(screen.getByText('Purchase Content')).toBeInTheDocument();
    expect(screen.getByText('Amazing Video Content')).toBeInTheDocument();
    expect(screen.getByText('by Test Creator')).toBeInTheDocument();
    expect(screen.getByText('Lifetime access to this content')).toBeInTheDocument();
  });

  it('shows both USDC and fiat payment options when both prices provided', () => {
    render(<CheckoutModal {...mockProps} />);

    expect(screen.getByText('Pay with USDC')).toBeInTheDocument();
    expect(screen.getByText('5.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('Pay with Card')).toBeInTheDocument();
    expect(screen.getByText('$4.99 USD')).toBeInTheDocument();
  });

  it('shows only USDC option when only USDC price provided', () => {
    render(<CheckoutModal {...mockProps} priceFiat={undefined} />);

    expect(screen.getByText('Pay with USDC')).toBeInTheDocument();
    expect(screen.queryByText('Pay with Card')).not.toBeInTheDocument();
  });

  it('shows only fiat option when only fiat price provided', () => {
    render(<CheckoutModal {...mockProps} priceUSDC={undefined} />);

    expect(screen.queryByText('Pay with USDC')).not.toBeInTheDocument();
    expect(screen.getByText('Pay with Card')).toBeInTheDocument();
  });

  it('shows subscription description for subscription entitlement', () => {
    render(<CheckoutModal {...mockProps} entitlementType="subscription" subscriptionDuration={30} />);

    expect(screen.getByText('30-day subscription access')).toBeInTheDocument();
  });

  it('disables payment when wallet not connected', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: false
    } as any);

    render(<CheckoutModal {...mockProps} />);

    const payButton = screen.getByRole('button', { name: /connect wallet first/i });
    expect(payButton).toBeDisabled();
  });

  it('disables payment when wallet not authenticated', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isAuthenticated: false
    } as any);

    render(<CheckoutModal {...mockProps} />);

    const payButton = screen.getByRole('button', { name: /authenticate first/i });
    expect(payButton).toBeDisabled();
  });

  it('processes USDC payment successfully', async () => {
    const mockResult = {
      success: true,
      transactionId: '0xabc123',
      amount: '5.00',
      currency: 'USDC',
      method: 'usdc' as const,
      entitlementId: 'ent_123'
    };

    mockPaymentService.processUSDCPayment.mockResolvedValue(mockResult);

    render(<CheckoutModal {...mockProps} />);

    // Select USDC payment method
    fireEvent.click(screen.getByLabelText(/pay with usdc/i));
    
    // Click pay button
    fireEvent.click(screen.getByRole('button', { name: /pay 5\.00 usdc/i }));

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText('Processing Payment')).toBeInTheDocument();
    });

    // Should call payment service
    expect(mockPaymentService.processUSDCPayment).toHaveBeenCalledWith({
      contentId: 'test-content-123',
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: 5000000,
      entitlementType: 'ppv'
    });

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('Transaction ID: 0xabc123')).toBeInTheDocument();
    expect(screen.getByText('Amount: 5.00 USDC')).toBeInTheDocument();

    // Should call success callback
    await waitFor(() => {
      expect(mockProps.onSuccess).toHaveBeenCalledWith(mockResult);
    }, { timeout: 2000 });
  });

  it('processes fiat payment successfully', async () => {
    const mockResult = {
      success: true,
      transactionId: 'session_123',
      amount: '4.99',
      currency: 'USD',
      method: 'fiat' as const,
      entitlementId: 'ent_456'
    };

    mockPaymentService.processFiatPayment.mockResolvedValue(mockResult);

    render(<CheckoutModal {...mockProps} />);

    // Select fiat payment method
    fireEvent.click(screen.getByLabelText(/pay with card/i));
    
    // Click pay button
    fireEvent.click(screen.getByRole('button', { name: /pay \$4\.99 usd/i }));

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText('Processing Payment')).toBeInTheDocument();
    });

    // Should call payment service
    expect(mockPaymentService.processFiatPayment).toHaveBeenCalledWith({
      contentId: 'test-content-123',
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: 4.99,
      entitlementType: 'ppv'
    });

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });
  });

  it('handles payment failure', async () => {
    const mockError = new Error('Payment failed: Insufficient funds');
    mockPaymentService.processUSDCPayment.mockRejectedValue(mockError);

    render(<CheckoutModal {...mockProps} />);

    // Select USDC and pay
    fireEvent.click(screen.getByLabelText(/pay with usdc/i));
    fireEvent.click(screen.getByRole('button', { name: /pay 5\.00 usdc/i }));

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Payment failed: Insufficient funds')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('allows retry after payment failure', async () => {
    const mockError = new Error('Payment failed');
    mockPaymentService.processUSDCPayment.mockRejectedValueOnce(mockError);

    render(<CheckoutModal {...mockProps} />);

    // Trigger payment failure
    fireEvent.click(screen.getByLabelText(/pay with usdc/i));
    fireEvent.click(screen.getByRole('button', { name: /pay 5\.00 usdc/i }));

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    });

    // Click try again
    fireEvent.click(screen.getByText('Try Again'));

    // Should return to method selection
    expect(screen.getByText('Choose Payment Method')).toBeInTheDocument();
  });

  it('closes modal when close button clicked', () => {
    render(<CheckoutModal {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('prevents closing during payment processing', async () => {
    mockPaymentService.processUSDCPayment.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<CheckoutModal {...mockProps} />);

    // Start payment
    fireEvent.click(screen.getByLabelText(/pay with usdc/i));
    fireEvent.click(screen.getByRole('button', { name: /pay 5\.00 usdc/i }));

    await waitFor(() => {
      expect(screen.getByText('Processing Payment')).toBeInTheDocument();
    });

    // Close button should not be visible during processing
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('resets state when modal reopens', () => {
    const { rerender } = render(<CheckoutModal {...mockProps} isOpen={false} />);

    // Open modal
    rerender(<CheckoutModal {...mockProps} isOpen={true} />);

    expect(screen.getByText('Choose Payment Method')).toBeInTheDocument();
    expect(screen.queryByText('Payment Failed')).not.toBeInTheDocument();
  });
});