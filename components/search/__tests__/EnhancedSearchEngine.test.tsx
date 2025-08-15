import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnhancedSearchEngine from '../EnhancedSearchEngine';

// Mock fetch for API calls
global.fetch = jest.fn();

const mockOnSearch = jest.fn();
const mockOnSuggestionSelect = jest.fn();

const defaultProps = {
  onSearch: mockOnSearch,
  onSuggestionSelect: mockOnSuggestionSelect,
  enableAI: true,
  showConfidenceScores: true,
  showAITags: true,
};

describe('EnhancedSearchEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders with AI-powered placeholder text', () => {
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    expect(screen.getByPlaceholderText(/AI-powered semantic understanding/)).toBeInTheDocument();
  });

  it('displays AI indicator when AI is enabled', () => {
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('handles search input and triggers search', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    
    await user.type(searchInput, 'test query');
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          searchType: 'hybrid',
          sortBy: 'relevance',
        }),
        undefined // No results initially
      );
    });
  });

  it('shows loading state during search', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed API response
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        json: () => Promise.resolve({
          status: 'success',
          data: { results: [], total: 0 }
        })
      }), 100))
    );
    
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    await user.type(searchInput, 'test');
    await user.keyboard('{Enter}');
    
    // Should show loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays AI suggestions with confidence scores', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    
    // Type to trigger suggestions
    await user.type(searchInput, 'blo');
    
    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByText(/blonde woman bedroom/)).toBeInTheDocument();
    });
    
    // Check for AI badge
    expect(screen.getByText('AI')).toBeInTheDocument();
    
    // Check for confidence score
    expect(screen.getByText(/92% match/)).toBeInTheDocument();
  });

  it('handles suggestion selection', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    await user.type(searchInput, 'blo');
    
    await waitFor(() => {
      expect(screen.getByText(/blonde woman bedroom/)).toBeInTheDocument();
    });
    
    // Click on suggestion
    await user.click(screen.getByText(/blonde woman bedroom/));
    
    expect(mockOnSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'blonde woman bedroom',
        type: 'ai-tag',
        aiGenerated: true,
      })
    );
  });

  it('shows and hides filters panel', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const filterButton = screen.getByRole('button', { name: /filter/i });
    
    // Open filters
    await user.click(filterButton);
    expect(screen.getByText('Search Type')).toBeInTheDocument();
    
    // Close filters
    await user.click(filterButton);
    expect(screen.queryByText('Search Type')).not.toBeInTheDocument();
  });

  it('updates search type filter', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);
    
    // Change search type
    const searchTypeSelect = screen.getByDisplayValue('Hybrid (AI + Keywords)');
    await user.selectOptions(searchTypeSelect, 'semantic');
    
    expect(screen.getByDisplayValue('Semantic (AI Only)')).toBeInTheDocument();
  });

  it('adjusts confidence threshold slider', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);
    
    // Find and adjust confidence slider
    const confidenceSlider = screen.getByRole('slider');
    fireEvent.change(confidenceSlider, { target: { value: '0.9' } });
    
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    // Open filters and change some values
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);
    
    const searchTypeSelect = screen.getByDisplayValue('Hybrid (AI + Keywords)');
    await user.selectOptions(searchTypeSelect, 'semantic');
    
    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearButton);
    
    expect(screen.getByDisplayValue('Hybrid (AI + Keywords)')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    await user.type(searchInput, 'test query');
    await user.keyboard('{Enter}');
    
    // Should still call onSearch even if API fails
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalled();
    });
  });

  it('works without AI when disabled', () => {
    render(<EnhancedSearchEngine {...defaultProps} enableAI={false} />);
    
    // Should not show AI indicator
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    
    // Should use regular placeholder
    expect(screen.getByPlaceholderText(/Search with AI-powered semantic understanding/)).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    
    // Focus input and type
    await user.click(searchInput);
    await user.type(searchInput, 'test');
    
    // Press Escape to close suggestions
    await user.keyboard('{Escape}');
    
    // Suggestions should be hidden
    expect(screen.queryByText(/blonde woman bedroom/)).not.toBeInTheDocument();
  });

  it('displays search analytics when available', async () => {
    const user = userEvent.setup();
    
    // Mock successful API response with analytics
    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({
        status: 'success',
        data: {
          results: [],
          total: 100,
          searchType: 'hybrid'
        }
      })
    });
    
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    await user.type(searchInput, 'test query');
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText('100 results')).toBeInTheDocument();
    });
  });

  it('maintains search history', async () => {
    const user = userEvent.setup();
    render(<EnhancedSearchEngine {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/AI-powered semantic understanding/);
    
    // Perform first search
    await user.type(searchInput, 'first query');
    await user.keyboard('{Enter}');
    
    // Clear input and focus to show history
    await user.clear(searchInput);
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Recent searches')).toBeInTheDocument();
      expect(screen.getByText('first query')).toBeInTheDocument();
    });
  });
});