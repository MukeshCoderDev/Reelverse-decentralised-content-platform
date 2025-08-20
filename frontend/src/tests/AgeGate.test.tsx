import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAgeGate } from '../../src/hooks/useAgeGate'; // Adjust path as needed
import AgeGateModal from '../../src/components/compliance/AgeGateModal'; // Adjust path as needed
import BlurUntilAdult from '../../src/components/compliance/BlurUntilAdult'; // Adjust path as needed
import Cookies from 'js-cookie';

// Mock the useAgeGate hook
jest.mock('../../src/hooks/useAgeGate', () => ({
  useAgeGate: jest.fn(),
}));

// Mock js-cookie
jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

const mockUseAgeGate = useAgeGate as jest.MockedFunction<typeof useAgeGate>;
const mockCookies = Cookies as jest.Mocked<typeof Cookies>;

describe('AgeGateModal', () => {
  const mockOnAccept = jest.fn();
  const mockOnLeave = jest.fn();
  const minAge = 18;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for useAgeGate for modal tests
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: mockOnAccept,
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
  });

  it('renders the modal when isOpen is true', () => {
    render(
      <AgeGateModal
        isOpen={true}
        onAccept={mockOnAccept}
        onLeave={mockOnLeave}
        minAge={minAge}
      />
    );
    expect(screen.getByRole('dialog', { name: /age verification required/i })).toBeInTheDocument();
    expect(screen.getByText(`You must be ${minAge}+ to access this content.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `I am ${minAge}+ Enter` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
  });

  it('does not render the modal when isOpen is false', () => {
    render(
      <AgeGateModal
        isOpen={false}
        onAccept={mockOnAccept}
        onLeave={mockOnLeave}
        minAge={minAge}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onAccept when "I am 18+ Enter" button is clicked', () => {
    render(
      <AgeGateModal
        isOpen={true}
        onAccept={mockOnAccept}
        onLeave={mockOnLeave}
        minAge={minAge}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: `I am ${minAge}+ Enter` }));
    expect(mockOnAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onLeave when "Leave" button is clicked', () => {
    render(
      <AgeGateModal
        isOpen={true}
        onAccept={mockOnAccept}
        onLeave={mockOnLeave}
        minAge={minAge}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /leave/i }));
    expect(mockOnLeave).toHaveBeenCalledTimes(1);
  });

  it('disables ESC key to close the modal', () => {
    const { container } = render(
      <AgeGateModal
        isOpen={true}
        onAccept={mockOnAccept}
        onLeave={mockOnLeave}
        minAge={minAge}
      />
    );
    fireEvent.keyDown(container, { key: 'Escape', code: 'Escape' });
    expect(mockOnAccept).not.toHaveBeenCalled();
    expect(mockOnLeave).not.toHaveBeenCalled();
  });
});

describe('BlurUntilAdult', () => {
  const minAge = 18;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.location.pathname for safe routes
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
      },
      writable: true,
    });
  });

  it('renders blurred content and banner when not accepted and not on safe route', () => {
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: jest.fn(),
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    // Mock VITE_AGE_GATE_ENABLED to be true
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    expect(screen.getByText('Sensitive Content')).toBeInTheDocument();
    expect(screen.getByText('Content is for 18+ only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify age/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // Modal should not be open initially
  });

  it('renders unblurred content when accepted', () => {
    mockUseAgeGate.mockReturnValue({
      accepted: true,
      accept: jest.fn(),
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    expect(screen.getByText('Sensitive Content')).toBeInTheDocument();
    expect(screen.queryByText('Content is for 18+ only.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify age/i })).not.toBeInTheDocument();
  });

  it('renders unblurred content when on a safe route', () => {
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: jest.fn(),
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/legal/terms', // Simulate a safe route
      },
      writable: true,
    });

    render(
      <BlurUntilAdult safeRoutes={['/legal', '/privacy']}>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    expect(screen.getByText('Sensitive Content')).toBeInTheDocument();
    expect(screen.queryByText('Content is for 18+ only.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify age/i })).not.toBeInTheDocument();
  });

  it('opens AgeGateModal when "Verify Age" button is clicked', () => {
    const mockAccept = jest.fn();
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: mockAccept,
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    fireEvent.click(screen.getByRole('button', { name: /verify age/i }));
    expect(screen.getByRole('dialog', { name: /age verification required/i })).toBeInTheDocument();
  });

  it('closes AgeGateModal and accepts age when "I am 18+ Enter" is clicked in modal', async () => {
    const mockAccept = jest.fn();
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: mockAccept,
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    fireEvent.click(screen.getByRole('button', { name: /verify age/i })); // Open modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `I am ${minAge}+ Enter` }));
    });

    expect(mockAccept).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // Modal should be closed
  });

  it('redirects when "Leave" is clicked in modal', async () => {
    const mockAccept = jest.fn();
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: mockAccept,
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'true';

    // Mock window.location.href setter
    const assignMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'initial',
        assign: assignMock,
      },
      writable: true,
    });

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    fireEvent.click(screen.getByRole('button', { name: /verify age/i })); // Open modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /leave/i }));
    });

    expect(window.location.href).toBe('https://www.google.com');
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('does not render age gate if VITE_AGE_GATE_ENABLED is false', () => {
    mockUseAgeGate.mockReturnValue({
      accepted: false,
      accept: jest.fn(),
      reset: jest.fn(),
      config: { minAge, rememberDays: 30 },
    });
    import.meta.env.VITE_AGE_GATE_ENABLED = 'false'; // Disable age gate

    render(
      <BlurUntilAdult>
        <div>Sensitive Content</div>
      </BlurUntilAdult>
    );

    expect(screen.getByText('Sensitive Content')).toBeInTheDocument();
    expect(screen.queryByText('Content is for 18+ only.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify age/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});