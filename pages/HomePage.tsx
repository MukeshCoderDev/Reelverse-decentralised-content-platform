
import React, { Suspense, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ShelfRow } from '../components/content/ShelfRow';
import { fetchHome } from '../lib/fetchers';
import { RowSkeleton } from '../components/shared/Skeletons';
import { Content } from '../types';
import Icon from '../components/Icon';
import { useReturnTo } from '../src/hooks/useReturnTo';

interface HomeContentProps {
  items: Content[];
}

const HomeContent: React.FC<HomeContentProps> = ({ items }) => {
  // YouTube-style algorithm-driven content organization
  const trendingContent = items.filter(item => item.trending).slice(0, 8);
  const personalizedContent = items.slice(0, 8);
  const recentActivityContent = items.slice(4, 12);
  
  return (
    <div className="space-y-8">
      {/* TikTok-style trending section with special styling */}
      {trendingContent.length > 0 && (
        <section className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="flame" size={24} className="text-red-500" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Trending Now
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent ml-4" />
          </div>
          <ShelfRow title="" items={trendingContent} />
        </section>
      )}
      
      {/* YouTube-style personalized recommendations */}
      <ShelfRow title="Recommended for you" items={personalizedContent} />
      
      {/* YouTube-style activity-based recommendations */}
      <ShelfRow title="Based on your recent activity" items={recentActivityContent} />
      
      {/* Additional algorithm-driven shelves */}
      <ShelfRow title="Popular on Reelverse" items={items.slice(6, 14)} />
      <ShelfRow title="From your subscriptions" items={items.slice(8, 16)} />
    </div>
  );
};

const HomePage: React.FC = () => {
  const [items, setItems] = React.useState<Content[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const location = useLocation();
  const { saveScroll, restoreScroll } = useReturnTo();

  useEffect(() => {
    restoreScroll(location.pathname);
    fetchHome()
      .then(setItems)
      .finally(() => setIsLoading(false));

    return () => {
      saveScroll(location.pathname, window.scrollY);
    };
  }, [location.pathname, saveScroll, restoreScroll]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Content area starts immediately below sticky CenterNav */}
      <div className="py-6">
        {isLoading ? (
          <RowSkeleton />
        ) : items ? (
          <HomeContent items={items} />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Icon name="video" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No content available</h3>
              <p className="text-muted-foreground">Check back later for new videos</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
