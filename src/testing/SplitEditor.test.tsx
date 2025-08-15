import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SplitEditor, { RevenueSplit } from '../../components/studio/SplitEditor';
import { WalletProvider } from '../../contexts/WalletContext';

// Mock the wallet context
jest.mock('../../contexts/WalletContext', () => ({
  ...jest.requireActual('../../contexts/WalletContext'),
  useWallet: () => ({
    account: '0x1234567890123456789012345678901234567890',
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

describe('SplitEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    minCreatorShare: 9000, // 90%
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render split editor form', () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    expect(screen.getByText('Split Details')).toBeInTheDocument();
    expect(screen.getByText('Revenue Recipients')).toBeInTheDocument();
    expect(screen.getByLabelText(/split name/i)).toBeInTheDocument();
    expect(screen.getByText('Creator (You)')).toBeInTheDocument();
  });

  it('should initialize with creator at minimum share', () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const creatorPercentage = screen.getByDisplayValue('90.00');
    expect(creatorPercentage).toBeInTheDocument();
  });

  it('should validate split name is required', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /create split/i });
    expect(saveButton).toBeDisabled();
  });

  it('should enable save button when split name is provided', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    const saveButton = screen.getByRole('button', { name: /create split/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('should validate wallet address format when adding collaborator', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    fireEvent.change(walletInput, { target: { value: 'invalid-address' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid wallet address format')).toBeInTheDocument();
    });
  });

  it('should add collaborator with valid wallet address', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const nameCollabInput = screen.getByPlaceholderText(/name \(optional\)/i);
    const shareInput = screen.getByPlaceholderText('0.00');
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(nameCollabInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(shareInput, { target: { value: '10' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF')).toBeInTheDocument();
    });
  });

  it('should prevent duplicate collaborators', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const shareInput = screen.getByPlaceholderText('0.00');
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    // Add first collaborator
    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(shareInput, { target: { value: '10' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF')).toBeInTheDocument();
    });

    // Try to add same collaborator again
    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(shareInput, { target: { value: '5' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Recipient already added')).toBeInTheDocument();
    });
  });

  it('should update total allocation when shares change', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    // Add collaborator with 10% share
    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const shareInput = screen.getByPlaceholderText('0.00');
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(shareInput, { target: { value: '10' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      // Creator should automatically adjust to 80% (90% - 10%)
      const creatorInput = screen.getByDisplayValue('80.00');
      expect(creatorInput).toBeInTheDocument();
      
      // Total should still be 100%
      expect(screen.getByText('100.00%')).toBeInTheDocument();
    });
  });

  it('should enforce minimum creator share', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    // Try to add collaborator with 20% share (would leave creator with 70%)
    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const shareInput = screen.getByPlaceholderText('0.00');
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(shareInput, { target: { value: '20' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      // Should show error about minimum creator share
      expect(screen.getByText(/creator must receive at least 90.00%/i)).toBeInTheDocument();
    });
  });

  it('should remove collaborator when delete button is clicked', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    // Add collaborator
    const walletInput = screen.getByPlaceholderText(/wallet address/i);
    const shareInput = screen.getByPlaceholderText('0.00');
    const addButton = screen.getByRole('button', { name: /add collaborator/i });

    fireEvent.change(walletInput, { target: { value: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF' } });
    fireEvent.change(shareInput, { target: { value: '10' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF')).toBeInTheDocument();
    });

    // Remove collaborator
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('[data-lucide="trash-2"]')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF')).not.toBeInTheDocument();
    });
  });

  it('should prevent removing creator', async () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    // Try to remove creator (should not have delete button or show error)
    const creatorRow = screen.getByText('Creator (You)').closest('div');
    const deleteButton = creatorRow?.querySelector('[data-lucide="trash-2"]');
    
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('should save split when valid', async () => {
    jest.useFakeTimers();
    
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const nameInput = screen.getByLabelText(/split name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Split' } });

    const saveButton = screen.getByRole('button', { name: /create split/i });
    fireEvent.click(saveButton);

    // Fast-forward through the simulated save process
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Split',
          recipients: expect.arrayContaining([
            expect.objectContaining({
              wallet: '0x1234567890123456789012345678901234567890',
              basisPoints: 9000,
              isCreator: true
            })
          ]),
          totalBasisPoints: 10000
        })
      );
    });

    jest.useRealTimers();
  });

  it('should call onCancel when cancel button is clicked', () => {
    renderWithProviders(<SplitEditor {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should load existing split data when editing', () => {
    const existingSplit: RevenueSplit = {
      id: 'split_1',
      name: 'Existing Split',
      description: 'Test description',
      recipients: [
        {
          id: 'creator',
          wallet: '0x1234567890123456789012345678901234567890',
          name: 'Creator (You)',
          basisPoints: 9000,
          isCreator: true
        },
        {
          id: 'collab_1',
          wallet: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF',
          name: 'Jane Doe',
          basisPoints: 1000,
          isCreator: false
        }
      ],
      totalBasisPoints: 10000,
      contractAddress: '0x123...abc',
      createdAt: '2024-01-15T10:00:00Z',
      isActive: true
    };

    renderWithProviders(<SplitEditor {...defaultProps} split={existingSplit} />);

    expect(screen.getByDisplayValue('Existing Split')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update split/i })).toBeInTheDocument();
  });
});