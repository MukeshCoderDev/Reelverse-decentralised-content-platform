import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UploadWizard from '../../components/studio/UploadWizard';
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

describe('UploadWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the file selection step initially', () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Select File')).toBeInTheDocument();
    expect(screen.getByText('Choose a video file')).toBeInTheDocument();
    expect(screen.getByText('MP4, MOV, AVI up to 2GB')).toBeInTheDocument();
  });

  it('should show progress steps', () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Select File')).toBeInTheDocument();
    expect(screen.getByText('Upload Options')).toBeInTheDocument();
    expect(screen.getByText('Content Details')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('should validate file type and show error for non-video files', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    const fileInput = screen.getByLabelText(/choose a video file/i);
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Please select a valid video file')).toBeInTheDocument();
    });
  });

  it('should validate file size and show error for large files', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    const fileInput = screen.getByLabelText(/choose a video file/i);
    // Create a mock file larger than 2GB
    const largeFile = new File(['test'], 'large-video.mp4', { 
      type: 'video/mp4' 
    });
    
    // Mock the file size property
    Object.defineProperty(largeFile, 'size', {
      value: 3 * 1024 * 1024 * 1024, // 3GB
      writable: false
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 2GB')).toBeInTheDocument();
    });
  });

  it('should accept valid video file and enable next button', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });

    fireEvent.change(fileInput, { target: { files: [videoFile] } });

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('should navigate to options step after file selection', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Select a file
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });

    // Click next
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Storage Options')).toBeInTheDocument();
      expect(screen.getByText('Shreddable Storage')).toBeInTheDocument();
      expect(screen.getByText('Permanent Storage')).toBeInTheDocument();
    });
  });

  it('should allow storage class selection', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate to options step
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Storage Options')).toBeInTheDocument();
    });

    // Select permanent storage
    const permanentOption = screen.getByText('Permanent Storage').closest('div');
    fireEvent.click(permanentOption!);

    // Should highlight the selected option
    expect(permanentOption).toHaveClass('border-blue-500');
  });

  it('should allow processing options configuration', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate to options step
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Processing Options')).toBeInTheDocument();
    });

    // Check encryption and watermarking options
    const encryptionCheckbox = screen.getByLabelText(/enable encryption/i);
    const watermarkingCheckbox = screen.getByLabelText(/enable watermarking/i);

    expect(encryptionCheckbox).toBeChecked();
    expect(watermarkingCheckbox).toBeChecked();

    // Toggle encryption off
    fireEvent.click(encryptionCheckbox);
    expect(encryptionCheckbox).not.toBeChecked();
  });

  it('should navigate to metadata step and require title', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate through steps
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    // Start upload button should be disabled without title
    const startButton = screen.getByRole('button', { name: /start upload/i });
    expect(startButton).toBeDisabled();

    // Enter title
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Video Title' } });

    // Start upload button should be enabled
    expect(startButton).not.toBeDisabled();
  });

  it('should allow adding and removing tags', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate to metadata step
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      const tagsInput = screen.getByPlaceholderText(/enter tags separated by commas/i);
      
      // Add a tag
      fireEvent.change(tagsInput, { target: { value: 'test-tag' } });
      fireEvent.keyDown(tagsInput, { key: 'Enter' });

      expect(screen.getByText('test-tag')).toBeInTheDocument();
    });
  });

  it('should start processing when upload is initiated', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate through all steps
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'Test Video Title' } });
      
      const startButton = screen.getByRole('button', { name: /start upload/i });
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Processing Your Content')).toBeInTheDocument();
      expect(screen.getByText('Upload Progress')).toBeInTheDocument();
    });
  });

  it('should call onComplete when processing finishes', async () => {
    jest.useFakeTimers();
    
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate through all steps and start upload
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'Test Video Title' } });
      
      const startButton = screen.getByRole('button', { name: /start upload/i });
      fireEvent.click(startButton);
    });

    // Fast-forward through the simulated upload process
    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(expect.stringMatching(/^content_\d+$/));
    });

    jest.useRealTimers();
  });

  it('should call onCancel when cancel button is clicked', () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel upload/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should allow navigation back through steps', async () => {
    renderWithProviders(
      <UploadWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
    );

    // Navigate to options step
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const videoFile = new File(['test'], 'test-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [videoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Storage Options')).toBeInTheDocument();
    });

    // Go back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Choose a video file')).toBeInTheDocument();
    });
  });
});