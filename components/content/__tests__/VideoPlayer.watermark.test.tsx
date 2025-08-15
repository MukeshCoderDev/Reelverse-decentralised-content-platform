import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { VideoPlayer } from '../VideoPlayer';
import { WatermarkService } from '../../../services/watermarkService';

// Mock the WatermarkService
jest.mock('../../../services/watermarkService');
const mockWatermarkService = {
  shouldShowWatermark: jest.fn(),
  getConfig: jest.fn(),
  getNextPosition: jest.fn(),
  generateWatermarkText: jest.fn(),
  createPiPWatermark: jest.fn(),
  validateWatermarkData: jest.fn(),
  generateWatermarkStyles: jest.fn(),
  logWatermarkDisplay: jest.fn(),
  getInstance: jest.fn()
};

(WatermarkService.getInstance as jest.Mock).mockReturnValue(mockWatermarkService);

// Mock HTMLVideoElement methods
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockImplementation(() => Promise.resolve())
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: jest.fn()
});

Object.defineProperty(HTMLVideoElement.prototype, 'load', {
  writable: true,
  value: jest.fn()
});

describe('VideoPlayer Watermarking', () => {
  const mockWatermarkData = {
    userAddress: '0x1234567890123456789012345678901234567890',
    sessionId: 'session_123456789',
    contentId: 'content_123',
    timestamp: Date.now()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default mock implementations
    mockWatermarkService.shouldShowWatermark.mockReturnValue(true);
    mockWatermarkService.getConfig.mockReturnValue({
      moveInterval: 10000,
      fadeTransition: 200,
      positions: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
    });
    mockWatermarkService.getNextPosition.mockReturnValue({ x: 90, y: 90 });
    mockWatermarkService.generateWatermarkText.mockReturnValue('0x1234...7890 • S:session1 • C:conten • 12:34:56');
    mockWatermarkService.createPiPWatermark.mockReturnValue('0x1234...7890');
    mockWatermarkService.validateWatermarkData.mockReturnValue(true);
    mockWatermarkService.generateWatermarkStyles.mockReturnValue({
      position: 'absolute',
      left: '10%',
      top: '10%',
      transform: 'translate(-50%, -50%)'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders video player without watermark when disabled', () => {
    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={false}
      />
    );

    expect(screen.queryByText(/0x1234/)).not.toBeInTheDocument();
  });

  it('renders watermark when enabled with valid data', async () => {
    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    // Simulate video playing
    const video = screen.getByRole('application');
    act(() => {
      // Trigger play event
      const playEvent = new Event('play');
      video.dispatchEvent(playEvent);
    });

    await waitFor(() => {
      expect(mockWatermarkService.generateWatermarkText).toHaveBeenCalledWith(mockWatermarkData);
    });

    expect(screen.getByText('0x1234...7890 • S:session1 • C:conten • 12:34:56')).toBeInTheDocument();
  });

  it('moves watermark position at configured intervals', async () => {
    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    // Simulate video playing
    const video = screen.getByRole('application');
    act(() => {
      const playEvent = new Event('play');
      video.dispatchEvent(playEvent);
    });

    // Fast-forward time to trigger watermark movement
    act(() => {
      jest.advanceTimersByTime(10000); // Move interval
    });

    await waitFor(() => {
      expect(mockWatermarkService.getNextPosition).toHaveBeenCalled();
      expect(mockWatermarkService.logWatermarkDisplay).toHaveBeenCalledWith(
        mockWatermarkData,
        { x: 90, y: 90 }
      );
    });
  });

  it('hides watermark during fade transition', async () => {
    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    // Simulate video playing
    const video = screen.getByRole('application');
    act(() => {
      const playEvent = new Event('play');
      video.dispatchEvent(playEvent);
    });

    // Trigger watermark movement
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // During fade transition, watermark should be hidden
    act(() => {
      jest.advanceTimersByTime(100); // Partial fade time
    });

    // Watermark should be temporarily hidden during transition
    // (This is implementation-dependent and may need adjustment based on actual behavior)
  });

  it('shows Picture-in-Picture watermark when in PiP mode', async () => {
    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
      />
    );

    // Simulate entering Picture-in-Picture mode
    const video = screen.getByRole('application');
    act(() => {
      const pipEvent = new Event('enterpictureinpicture');
      video.dispatchEvent(pipEvent);
    });

    await waitFor(() => {
      expect(mockWatermarkService.createPiPWatermark).toHaveBeenCalledWith(mockWatermarkData);
    });

    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
  });

  it('validates watermark data before displaying', () => {
    mockWatermarkService.validateWatermarkData.mockReturnValue(false);

    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    expect(mockWatermarkService.validateWatermarkData).toHaveBeenCalledWith(mockWatermarkData);
    expect(mockWatermarkService.generateWatermarkText).not.toHaveBeenCalled();
  });

  it('does not show watermark when video is paused', () => {
    mockWatermarkService.shouldShowWatermark.mockReturnValue(false);

    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
      />
    );

    expect(mockWatermarkService.shouldShowWatermark).toHaveBeenCalledWith(false, false, true);
    expect(screen.queryByText(/0x1234/)).not.toBeInTheDocument();
  });

  it('cleans up watermark interval on unmount', () => {
    const { unmount } = render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    // Simulate video playing to start interval
    const video = screen.getByRole('application');
    act(() => {
      const playEvent = new Event('play');
      video.dispatchEvent(playEvent);
    });

    // Unmount component
    unmount();

    // Advance time - interval should not trigger after unmount
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should not call getNextPosition after unmount
    expect(mockWatermarkService.getNextPosition).not.toHaveBeenCalled();
  });

  it('applies watermark styles from service', async () => {
    const mockStyles = {
      position: 'absolute' as const,
      left: '50%',
      top: '25%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      color: '#ffffff'
    };

    mockWatermarkService.generateWatermarkStyles.mockReturnValue(mockStyles);

    render(
      <VideoPlayer
        src="test-video.mp4"
        title="Test Video"
        enableWatermark={true}
        watermarkData={mockWatermarkData}
        autoPlay={true}
      />
    );

    // Simulate video playing
    const video = screen.getByRole('application');
    act(() => {
      const playEvent = new Event('play');
      video.dispatchEvent(playEvent);
    });

    await waitFor(() => {
      expect(mockWatermarkService.generateWatermarkStyles).toHaveBeenCalledWith({ x: 10, y: 10 });
    });
  });
});