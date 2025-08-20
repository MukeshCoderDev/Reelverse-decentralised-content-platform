import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAgeGate } from '../../src/hooks/useAgeGate';
import AgeGateModal from '../../src/components/compliance/AgeGateModal';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock the useAgeGate hook
jest.mock('../../src/hooks/useAgeGate', () => ({
  useAgeGate: jest.fn(),
}));

// Mock the flags for WalletButton test
jest.mock('../../src/config/flags', () => ({
  flags: {
    showWalletUI: false, // Default to false for testing
  },
}));

// Mock the WalletButton and NetworkSelector to avoid complex dependencies
jest.mock('../../src/components/wallet/WalletButton', () => ({
  WalletButton: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="mock-wallet-button">{children}</button>
  ),
}));

jest.mock('../../src/components/wallet/NetworkSelector', () => ({
  NetworkSelector: () => <div data-testid="mock-network-selector" />,
}));

describe('AgeGateModal', () => {
  const mockAccept = jest.fn();
  const mockReset = jest.fn();
  const mockShouldGate = jest.fn();
  const mockMinAge = 18;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'age_gate=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; // Clear cookie
    (useAgeGate as jest.Mock).mockReturnValue({
      accepted: false,
      accept: mockAccept,
      reset: mockReset,
      config: { minAge: mockMinAge, rememberDays: 30, enabled: true },
      shouldGate: mockShouldGate,
    });
    mockShouldGate.mockReturnValue(true); // Default to gate active
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderModal = (isOpen = true) => {
    render(
      <AgeGateModal
        isOpen={isOpen}
        onAccept={mockAccept}
        onLeave={() => {}}
        minAge={mockMinAge}
      />
    );
  };

  it('renders the modal when isOpen is true', () => {
    renderModal();
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument();
    expect(screen.getByText(`You must be ${mockMinAge}+ to access this content.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `I am ${mockMinAge}+ Enter` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('does not render the modal when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText(/Age Verification Required/i)).not.toBeInTheDocument();
  });

  it('calls onAccept when "I am 18+ Enter" is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: `I am ${mockMinAge}+ Enter` }));
    expect(mockAccept).toHaveBeenCalledTimes(1);
  });

  it('prevents closing on ESC key press', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument(); // Modal should still be there
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('prevents closing on outside click', () => {
    renderModal();
    fireEvent.click(document.body); // Click outside the modal
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument(); // Modal should still be there
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('persists acceptance across reloads using localStorage and cookie', async () => {
    (useAgeGate as jest.Mock).mockRestore(); // Restore original hook for this test

    const TestComponent = () => {
      const { accepted, accept, shouldGate, config } = useAgeGate();
      const location = { pathname: '/' }; // Simulate a non-safe route
      const gateActive = shouldGate(location.pathname);

      return (
        <>
          {gateActive && (
            <AgeGateModal
              isOpen={true}
              onAccept={accept}
              onLeave={() => {}}
              minAge={config.minAge}
            />
          )}
          {!gateActive && <div data-testid="content-visible">Content</div>}
        </>
      );
    };

    render(<TestComponent />);

    // Initially, modal should be visible
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('content-visible')).not.toBeInTheDocument();

    // Accept the age gate
    fireEvent.click(screen.getByRole('button', { name: `I am ${mockMinAge}+ Enter` }));

    // After accepting, modal should disappear and content should be visible
    await waitFor(() => {
      expect(screen.queryByText(/Age Verification Required/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('content-visible')).toBeInTheDocument();
    });

    // Simulate a reload by re-rendering the component
    render(<TestComponent />);

    // Modal should remain hidden, content visible
    expect(screen.queryByText(/Age Verification Required/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('content-visible')).toBeInTheDocument();

    // Clear localStorage and cookie to simulate expiry/reset
    localStorage.removeItem('ageGateAcceptedAt');
    document.cookie = 'age_gate=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Simulate another reload
    render(<TestComponent />);

    // Modal should reappear
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('content-visible')).not.toBeInTheDocument();
  });

  it('reset brings the modal back', async () => {
    (useAgeGate as jest.Mock).mockRestore(); // Restore original hook for this test

    const TestComponent = () => {
      const { accepted, accept, reset, shouldGate, config } = useAgeGate();
      const location = { pathname: '/' }; // Simulate a non-safe route
      const gateActive = shouldGate(location.pathname);

      return (
        <>
          {gateActive && (
            <AgeGateModal
              isOpen={true}
              onAccept={accept}
              onLeave={() => {}}
              minAge={config.minAge}
            />
          )}
          {!gateActive && <div data-testid="content-visible">Content</div>}
          <button onClick={reset} data-testid="reset-button">Reset</button>
        </>
      );
    };

    render(<TestComponent />);

    // Initially, modal should be visible
    expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument();

    // Accept the age gate
    fireEvent.click(screen.getByRole('button', { name: `I am ${mockMinAge}+ Enter` }));
    await waitFor(() => {
      expect(screen.queryByText(/Age Verification Required/i)).not.toBeInTheDocument();
    });

    // Click reset
    fireEvent.click(screen.getByTestId('reset-button'));

    // Modal should reappear
    await waitFor(() => {
      expect(screen.getByText(/Age Verification Required/i)).toBeInTheDocument();
    });
  });

  it('shouldGate returns false for safe routes', () => {
    (useAgeGate as jest.Mock).mockRestore(); // Restore original hook for this test

    const TestComponent = () => {
      const { shouldGate } = useAgeGate();
      return (
        <>
          {shouldGate('/legal') ? <div data-testid="gated">Gated</div> : <div data-testid="not-gated">Not Gated</div>}
          {shouldGate('/privacy') ? <div data-testid="gated">Gated</div> : <div data-testid="not-gated">Not Gated</div>}
          {shouldGate('/terms') ? <div data-testid="gated">Gated</div> : <div data-testid="not-gated">Not Gated</div>}
          {shouldGate('/some-other-route') ? <div data-testid="gated">Gated</div> : <div data-testid="not-gated">Not Gated</div>}
        </>
      );
    };

    render(<TestComponent />);
    expect(screen.getAllByTestId('not-gated').length).toBe(3); // legal, privacy, terms
    expect(screen.getByTestId('gated')).toBeInTheDocument(); // some-other-route
  });
});

describe('Wallet UI Feature Flag', () => {
  it('WalletButton is hidden when flags.showWalletUI is false', () => {
    // flags.showWalletUI is mocked to false by default for this test file
    const { WalletButton } = require('../../src/components/wallet/WalletButton');
    render(<WalletButton />);
    expect(screen.queryByTestId('mock-wallet-button')).not.toBeInTheDocument();
  });

  it('NetworkSelector is hidden when flags.showWalletUI is false', () => {
    // flags.showWalletUI is mocked to false by default for this test file
    const { NetworkSelector } = require('../../src/components/wallet/NetworkSelector');
    render(<NetworkSelector />);
    expect(screen.queryByTestId('mock-network-selector')).not.toBeInTheDocument();
  });

  it('WalletButton is shown when flags.showWalletUI is true', () => {
    jest.resetModules(); // Clear module cache
    jest.doMock('../../src/config/flags', () => ({
      flags: {
        showWalletUI: true,
      },
    }));
    const { WalletButton } = require('../../src/components/wallet/WalletButton');
    // Mock useWallet to simulate connected state for WalletButton to render
    jest.mock('../../src/contexts/WalletContext', () => ({
      useWallet: () => ({
        isConnected: true,
        isConnecting: false,
        account: '0x123abc',
        chainId: 1,
        balance: 100,
        walletType: 'metamask',
        error: null,
        disconnect: jest.fn(),
      }),
    }));
    render(<WalletButton />);
    expect(screen.getByTestId('mock-wallet-button')).toBeInTheDocument();
  });

  it('NetworkSelector is shown when flags.showWalletUI is true and connected', () => {
    jest.resetModules(); // Clear module cache
    jest.doMock('../../src/config/flags', () => ({
      flags: {
        showWalletUI: true,
      },
    }));
    const { NetworkSelector } = require('../../src/components/wallet/NetworkSelector');
    // Mock useWallet to simulate connected state for NetworkSelector to render
    jest.mock('../../src/contexts/WalletContext', () => ({
      useWallet: () => ({
        isConnected: true,
        chainId: 1,
        switchNetwork: jest.fn(),
        error: null,
      }),
    }));
    render(<NetworkSelector />);
    expect(screen.getByTestId('mock-network-selector')).toBeInTheDocument();
  });
});