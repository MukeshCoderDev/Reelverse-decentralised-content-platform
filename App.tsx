import React, { useEffect } from 'react';
import { flags } from './src/config/flags';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'; // Import useLocation
import { MobileLayout } from './components/mobile/MobileLayout';
import { WalletProvider } from './contexts/WalletContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeatureFlagProvider } from './lib/hooks/useFeatureFlags';
import { useAgeGate } from './src/hooks/useAgeGate'; // Import useAgeGate
import AgeGateModal from './src/components/compliance/AgeGateModal'; // Import AgeGateModal
import BlurUntilAdult from './src/components/compliance/BlurUntilAdult'; // Import BlurUntilAdult

// Page Imports
import HomePage from './pages/HomePage';
import CreatePage from './pages/CreatePage';
import FollowingPage from './pages/FollowingPage';
import TrendingPage from './pages/TrendingPage';
import ExplorePage from './pages/ExplorePage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CommunitiesPage from './pages/CommunitiesPage';
import NotificationsPage from './pages/NotificationsPage';
import InboxPage from './pages/InboxPage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/library/HistoryPage';
import LikedPage from './pages/library/LikedPage';
import WatchLaterPage from './pages/library/WatchLaterPage';
import CollectionsPage from './pages/library/CollectionsPage';
import CollectsPage from './pages/library/CollectsPage';
import DraftsPage from './pages/library/DraftsPage';
import StudioLayout from './pages/studio/StudioLayout';
import StudioDashboardPage from './pages/studio/StudioDashboardPage';
import StudioContentPage from './pages/studio/StudioContentPage';
import StudioMonetizationPage from './pages/studio/StudioMonetizationPage';
import StudioSubscriptionsPage from './pages/studio/StudioSubscriptionsPage';
import StudioSplitsPage from './pages/studio/StudioSplitsPage';
import StudioAnalyticsPage from './pages/studio/StudioAnalyticsPage';
import StudioModerationPage from './pages/studio/StudioModerationPage';
import StudioVerifyPage from './pages/studio/StudioVerifyPage';
import WalletPage from './pages/WalletPage';
import EarningsPage from './pages/EarningsPage';
import BuyCryptoPage from './pages/BuyCryptoPage';
import SettingsPage from './pages/SettingsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import HelpPage from './pages/HelpPage';
import StatusPage from './pages/StatusPage';
import LivePage from './pages/LivePage';
import DaoPage from './pages/dao/DaoPage';
import TreasuryPage from './pages/dao/TreasuryPage';
import RewardsPage from './pages/RewardsPage';
import AgencyDashboardPage from './pages/AgencyDashboardPage'; // Assuming this path
import NotFoundPage from './pages/NotFoundPage'; // Assuming this path
import WatchPage from './pages/WatchPage'; // Import WatchPage
const AppContent: React.FC = () => {
  const { accepted, accept, config, shouldGate } = useAgeGate();
  const location = useLocation();

  const gateActive = shouldGate(location.pathname);

  const handleLeave = () => {
    window.location.href = 'https://www.google.com'; // Redirect to a safe page
  };

  useEffect(() => {
    // Block page scroll when age gate is active
    if (gateActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = ''; // Restore scroll
    }
    return () => {
      document.body.style.overflow = ''; // Cleanup on unmount
    };
  }, [gateActive]);
return (
  <>
    {gateActive && (
      <AgeGateModal
        isOpen={true} // Always open if gateActive is true
        onAccept={accept}
        onLeave={handleLeave}
        minAge={config.minAge}
      />
    )}
    <div data-testid="app-loaded">
      <MobileLayout>
        {gateActive ? (
          <BlurUntilAdult>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/following" element={<FollowingPage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/subs" element={<SubscriptionsPage />} />
              <Route path="/communities" element={<CommunitiesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/watch/:contentId" element={<WatchPage />} /> {/* New Watch Page Route */}

              {/* Library Routes */}
              <Route path="/u/me" element={<ProfilePage />} />
              <Route path="/library/history" element={<HistoryPage />} />
              <Route path="/library/liked" element={<LikedPage />} />
              <Route path="/library/watch-later" element={<WatchLaterPage />} />
              <Route path="/library/collections" element={<CollectionsPage />} />
              <Route path="/library/collects" element={<CollectsPage />} />
              <Route path="/library/drafts" element={<DraftsPage />} />

              {/* Studio Routes */}
              <Route path="/studio" element={<StudioLayout />}>
                <Route index element={<StudioDashboardPage />} />
                <Route path="content" element={<StudioContentPage />} />
                <Route path="monetization" element={<StudioMonetizationPage />} />
                <Route path="subscriptions" element={<StudioSubscriptionsPage />} />
                <Route path="splits" element={<StudioSplitsPage />} />
                <Route path="analytics" element={<StudioAnalyticsPage />} />
                <Route path="moderation" element={<StudioModerationPage />} />
                <Route path="verify" element={<StudioVerifyPage />} />
              </Route>

              {/* Web3 Routes */}
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/earnings" element={<EarningsPage />} />
              <Route path="/buy-crypto" element={<BuyCryptoPage />} />

              {/* System Routes */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/connections" element={<ConnectionsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/status" element={<StatusPage />} />

              {/* Phase 2 Routes */}
              <Route path="/live" element={<LivePage />} />
              <Route path="/dao" element={<DaoPage />} />
              <Route path="/dao/treasury" element={<TreasuryPage />} />
              <Route path="/rewards" element={<RewardsPage />} />

              {/* Agency Routes */}
              <Route path="/agency" element={<AgencyDashboardPage />} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BlurUntilAdult>
        ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/following" element={<FollowingPage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/subs" element={<SubscriptionsPage />} />
            <Route path="/communities" element={<CommunitiesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/watch/:contentId" element={<WatchPage />} /> {/* New Watch Page Route */}

            {/* Library Routes */}
            <Route path="/u/me" element={<ProfilePage />} />
            <Route path="/library/history" element={<HistoryPage />} />
            <Route path="/library/liked" element={<LikedPage />} />
            <Route path="/library/watch-later" element={<WatchLaterPage />} />
            <Route path="/library/collections" element={<CollectionsPage />} />
            <Route path="/library/collects" element={<CollectsPage />} />
            <Route path="/library/drafts" element={<DraftsPage />} />

            {/* Studio Routes */}
            <Route path="/studio" element={<StudioLayout />}>
              <Route index element={<StudioDashboardPage />} />
              <Route path="content" element={<StudioContentPage />} />
              <Route path="monetization" element={<StudioMonetizationPage />} />
              <Route path="subscriptions" element={<StudioSubscriptionsPage />} />
              <Route path="splits" element={<StudioSplitsPage />} />
              <Route path="analytics" element={<StudioAnalyticsPage />} />
              <Route path="moderation" element={<StudioModerationPage />} />
              <Route path="verify" element={<StudioVerifyPage />} />
            </Route>

            {/* Web3 Routes */}
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/buy-crypto" element={<BuyCryptoPage />} />

            {/* System Routes */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/connections" element={<ConnectionsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/status" element={<StatusPage />} />

            {/* Phase 2 Routes */}
            <Route path="/live" element={<LivePage />} />
            <Route path="/dao" element={<DaoPage />} />
            <Route path="/dao/treasury" element={<TreasuryPage />} />
            <Route path="/rewards" element={<RewardsPage />} />

            {/* Agency Routes */}
            <Route path="/agency" element={<AgencyDashboardPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
      </MobileLayout>
    </div>
  </>
);
};

const App: React.FC = () => {
  useEffect(() => {
    document.documentElement.setAttribute('data-show-wallet-ui', flags.showWalletUI ? 'true' : 'false');
  }, []);

  return (
    <ErrorBoundary>
      <WalletProvider>
        <FeatureFlagProvider>
          <OrganizationProvider>
            <HashRouter>
              <AppContent />
            </HashRouter>
          </OrganizationProvider>
        </FeatureFlagProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
};

export default App;
