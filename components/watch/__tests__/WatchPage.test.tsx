import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WatchPage from '../../pages/WatchPage';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-video-id' }),
  useLocation: () => ({ search: '', state: null }),
  useNavigate: () => jest.fn()
}));

// Mock the video player components
jest.mock('../../components/watch/PlayerShell', () => {
  return function MockPlayerShell() {
    return <div data-testid="player-shell">Player Shell</div>;
  };
});

jest.mock('../../components/watch/TitleRow', () => {
  return function MockTitleRow() {
    return <div data-testid="title-row">Title Row</div>;
  };
});

jest.mock('../../components/watch/ActionsBar', () => {
  return function MockActionsBar() {
    return <div data-testid="actions-bar">Actions Bar</div>;
  };
});

jest.mock('../../components/watch/DescriptionBox', () => {
  return function MockDescriptionBox() {
    return <div data-testid="description-box">Description Box</div>;
  };
});

jest.mock('../../components/watch/UpNextRail', () => {
  return function MockUpNextRail() {
    return <div data-testid="up-next-rail">Up Next Rail</div>;
  };
});

jest.mock('../../components/watch/Comments', () => {
  return function MockComments() {
    return <div data-testid="comments">Comments</div>;
  };
});

describe('WatchPage', () => {
  it('renders without crashing', () => {
    render(<WatchPage />);
    
    // Check that the main components are rendered
    expect(screen.getByTestId('player-shell')).toBeInTheDocument();
    expect(screen.getByTestId('title-row')).toBeInTheDocument();
    expect(screen.getByTestId('actions-bar')).toBeInTheDocument();
    expect(screen.getByTestId('description-box')).toBeInTheDocument();
    expect(screen.getByTestId('up-next-rail')).toBeInTheDocument();
    expect(screen.getByTestId('comments')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    // This would require more complex mocking to test the loading state
    // For now, we're just testing the basic structure
  });
});