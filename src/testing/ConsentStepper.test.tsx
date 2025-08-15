import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ConsentStepper from '../../components/studio/ConsentStepper';
import { WalletProvider } from '../../contexts/WalletContext';

// Mock the wallet context
jest.mock('../../contexts/WalletContext', () => ({
  ...jest.requireActual('../../contexts/WalletContext'),
  useWallet: () => ({
    account: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
  }),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <WalletProvider>
        {component}
      </WalletProvider>
    </BrowserRouter>
  );
};

describe('ConsentStepper', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    sceneHash: 'scene_123',
    contentTitle: 'Test Content',
    contentDescription: 'Test Description',
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the participants step initially', () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    expect(screen.getByText('Add Participants')).toBeInTheDocument();
    expect(screen.getByText('Collect Consent')).toBeInTheDocument();
    expect(screen.getByText('Verify & Complete')).toBeInTheDocument();
  });

  it('should show form to add participants', () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    expect(screen.getByLabelText(/wallet address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add participant/i })).toBeInTheDocument();
  });

  it('should validate wallet address format', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });

    fireEvent.change(walletInput, { target: { value: 'invalid-address' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid wallet address format')).toBeInTheDocument();
    });
  });

  it('should add participant with valid wallet address', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const walletInput = screen.getByLabelText(/wallet address/i);
    const emailInput = screen.getByLabelText(/email/i);
    const roleSelect = screen.getByLabelText(/role/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });

    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(roleSelect, { target: { value: 'performer' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
      expect(screen.getByText('performer')).toBeInTheDocument();
    });
  });

  it('should prevent duplicate participants', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });

    // Add first participant
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
    });

    // Try to add same participant again
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Participant already added')).toBeInTheDocument();
    });
  });

  it('should remove participant when delete button is clicked', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });

    // Add participant
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
    });

    // Remove participant
    const deleteButton = screen.getByRole('button', { name: '' }); // Delete button has no text, just icon
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('0x1234567890123456789012345678901234567890')).not.toBeInTheDocument();
    });
  });

  it('should show custom role input when "other" is selected', () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const roleSelect = screen.getByLabelText(/role/i);
    fireEvent.change(roleSelect, { target: { value: 'other' } });

    expect(screen.getByLabelText(/custom role/i)).toBeInTheDocument();
  });

  it('should disable next button when no participants added', () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
    expect(nextButton).toBeDisabled();
  });

  it('should enable next button when participants are added', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });

    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('should navigate to collect consent step', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    // Add participant
    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Collect Digital Consent')).toBeInTheDocument();
      expect(screen.getByText('Ready to invite')).toBeInTheDocument();
    });
  });

  it('should allow inviting participants', async () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    // Add participant and navigate to collect step
    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const inviteButton = screen.getByRole('button', { name: /invite/i });
      fireEvent.click(inviteButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Invitation sent')).toBeInTheDocument();
    });
  });

  it('should simulate signature collection', async () => {
    jest.useFakeTimers();
    
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    // Add participant, navigate to collect step, and invite
    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const inviteButton = screen.getByRole('button', { name: /invite/i });
      fireEvent.click(inviteButton);
    });

    // Fast-forward invitation
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      const signatureButton = screen.getByRole('button', { name: /request signature/i });
      fireEvent.click(signatureButton);
    });

    // Fast-forward signature collection
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Consent provided')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('should navigate to verify step when all consents collected', async () => {
    jest.useFakeTimers();
    
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    // Add participant and complete consent flow
    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const inviteButton = screen.getByRole('button', { name: /invite/i });
      fireEvent.click(inviteButton);
    });

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      const signatureButton = screen.getByRole('button', { name: /request signature/i });
      fireEvent.click(signatureButton);
    });

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: verify & complete/i });
      expect(nextButton).not.toBeDisabled();
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Verify & Complete')).toBeInTheDocument();
      expect(screen.getByText('Content Information')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('should call onComplete when consent process is finished', async () => {
    jest.useFakeTimers();
    
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    // Complete full consent flow
    const walletInput = screen.getByLabelText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add participant/i });
    fireEvent.change(walletInput, { target: { value: '0x1234567890123456789012345678901234567890' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: collect consent/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const inviteButton = screen.getByRole('button', { name: /invite/i });
      fireEvent.click(inviteButton);
    });

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      const signatureButton = screen.getByRole('button', { name: /request signature/i });
      fireEvent.click(signatureButton);
    });

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next: verify & complete/i });
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const completeButton = screen.getByRole('button', { name: /complete consent process/i });
      fireEvent.click(completeButton);
    });

    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneHash: 'scene_123',
        contentTitle: 'Test Content',
        contentDescription: 'Test Description',
        participants: expect.arrayContaining([
          expect.objectContaining({
            wallet: '0x1234567890123456789012345678901234567890',
            status: 'signed'
          })
        ])
      })
    );

    jest.useRealTimers();
  });

  it('should call onCancel when cancel button is clicked', () => {
    renderWithProviders(<ConsentStepper {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});