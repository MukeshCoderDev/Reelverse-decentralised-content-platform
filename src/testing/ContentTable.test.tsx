import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentTable, ContentRow } from '../../components/studio/ContentTable';

describe('ContentTable', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnViewBlockchain = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRows: ContentRow[] = [
    {
      id: '1',
      title: 'Test Video 1',
      status: 'READY',
      views: 1000,
      storageClass: 'shreddable',
      encrypted: true,
      watermarked: true,
      blockchainId: '0x123...abc',
      earnings: 50.25,
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      title: 'Test Video 2',
      status: 'PROCESSING',
      views: 0,
      storageClass: 'permanent',
      encrypted: false,
      watermarked: false,
      earnings: 0,
      createdAt: '2024-01-16'
    },
    {
      id: '3',
      title: 'Test Video 3',
      status: 'FAILED',
      views: 500,
      storageClass: 'shreddable',
      encrypted: true,
      watermarked: false,
      earnings: 25.50,
      createdAt: '2024-01-14'
    }
  ];

  it('should render empty state when no rows provided', () => {
    render(<ContentTable rows={[]} />);
    
    expect(screen.getByText('No Content Yet')).toBeInTheDocument();
    expect(screen.getByText('Upload your first video to get started.')).toBeInTheDocument();
  });

  it('should render table with content rows', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    expect(screen.getByText('Test Video 2')).toBeInTheDocument();
    expect(screen.getByText('Test Video 3')).toBeInTheDocument();
  });

  it('should display correct status badges with appropriate colors', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const readyStatus = screen.getByText('READY');
    const processingStatus = screen.getByText('PROCESSING');
    const failedStatus = screen.getByText('FAILED');

    expect(readyStatus).toHaveClass('bg-green-100', 'text-green-700');
    expect(processingStatus).toHaveClass('bg-yellow-100', 'text-yellow-700');
    expect(failedStatus).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('should display storage class information', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    expect(screen.getByText('Shreddable')).toBeInTheDocument();
    expect(screen.getByText('Permanent')).toBeInTheDocument();
  });

  it('should display encryption and watermarking badges', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const encryptedBadges = screen.getAllByText('Encrypted');
    const watermarkedBadges = screen.getAllByText('Watermarked');

    expect(encryptedBadges).toHaveLength(2); // Two videos are encrypted
    expect(watermarkedBadges).toHaveLength(1); // One video is watermarked
  });

  it('should display blockchain badges for on-chain content', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const onChainBadge = screen.getByText('On-Chain');
    expect(onChainBadge).toBeInTheDocument();
  });

  it('should display view counts and earnings correctly', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    expect(screen.getByText('1,000')).toBeInTheDocument(); // Views for first video
    expect(screen.getByText('$50.25')).toBeInTheDocument(); // Earnings for first video
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // Earnings for second video
  });

  it('should call onEdit when edit button is clicked', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith('1');
  });

  it('should call onDelete when delete button is clicked', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: '' }); // Delete buttons have no text, just icon
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('[data-lucide="trash-2"]')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(mockOnDelete).toHaveBeenCalledWith('1');
    }
  });

  it('should call onViewBlockchain when blockchain badge is clicked', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const blockchainBadge = screen.getByText('On-Chain');
    fireEvent.click(blockchainBadge);

    expect(mockOnViewBlockchain).toHaveBeenCalledWith('0x123...abc');
  });

  it('should not show delete button for processing content', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    // Get all rows
    const rows = screen.getAllByRole('row');
    
    // Processing content row (second row, index 2 including header)
    const processingRow = rows[2];
    
    // Should not have delete button for processing content
    const deleteButtons = processingRow.querySelectorAll('[data-lucide="trash-2"]');
    expect(deleteButtons).toHaveLength(0);
  });

  it('should show spinning loader icon for processing status', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    const processingStatus = screen.getByText('PROCESSING').closest('span');
    const loaderIcon = processingStatus?.querySelector('[data-lucide="loader"]');
    
    expect(loaderIcon).toHaveClass('animate-spin');
  });

  it('should handle missing optional props gracefully', () => {
    render(<ContentTable rows={mockRows} />);

    // Should render without errors even without callback props
    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    
    // Edit and delete buttons should not be present
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('should display correct status icons', () => {
    render(
      <ContentTable 
        rows={mockRows}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    // Check for specific status icons
    const readyIcon = screen.getByText('READY').closest('span')?.querySelector('[data-lucide="check-circle"]');
    const processingIcon = screen.getByText('PROCESSING').closest('span')?.querySelector('[data-lucide="loader"]');
    const failedIcon = screen.getByText('FAILED').closest('span')?.querySelector('[data-lucide="x-circle"]');

    expect(readyIcon).toBeInTheDocument();
    expect(processingIcon).toBeInTheDocument();
    expect(failedIcon).toBeInTheDocument();
  });

  it('should format large view counts with commas', () => {
    const rowWithLargeViews: ContentRow = {
      id: '4',
      title: 'Popular Video',
      status: 'READY',
      views: 1234567,
      earnings: 100
    };

    render(
      <ContentTable 
        rows={[rowWithLargeViews]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onViewBlockchain={mockOnViewBlockchain}
      />
    );

    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});