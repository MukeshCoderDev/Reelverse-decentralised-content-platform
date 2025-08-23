import React, { Suspense, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { ShelfRow } from '../components/content/ShelfRow';
import VideoCard, { VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCardLight';
import { fetchHome } from '../lib/fetchers';
import { RowSkeleton } from '../components/shared/Skeletons';
import { Content } from '../types';
import { useReturnTo } from '../src/hooks/useReturnTo';

interface HomeContentProps {
  items: Content[];
}

const HomeContent: React.FC<HomeContentProps> = ({ items }) => {
  // YouTube-style algorithm-driven content organization
  const trendingContent = items.filter(item => item.trending).slice(0, 12);
  const personalizedContent = items.slice(0, 12);
  const recentActivityContent = items.slice(4, 16);
  
  // Convert Content to VideoCard props
  const convertToVideoProps = (content: Content) => ({
    v: {
      id: content.id,
      title: content.title,
      posterUrl: content.thumbnail || '/placeholder.svg',
      durationSec: Math.floor(Math.random() * 600 + 60), // Mock duration
      author: { name: content.creator },
      counts: { views: parseViewCount(content.views) },
      uploadedAt: '2 days ago', // Mock upload time
      quality: Math.random() > 0.7 ? 'HD' as const : undefined,
    }
  });
  
  return (
    <div className="mx-auto max-w-container px-4 py-4 space-y-8">
      {/* YouTube-style trending section */}
      {trendingContent.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="material-symbols:trending-up" className="text-live text-[24px]" />
            <h2 className="text-title font-semibold text-text">
              Trending Now
            </h2>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {trendingContent.map(content => (
              <VideoCard key={content.id} {...convertToVideoProps(content)} />
            ))}
          </div>
        </section>
      )}
      
      {/* YouTube-style personalized recommendations */}
      <section>
        <h2 className="text-title font-semibold text-text mb-4">
          Recommended
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {personalizedContent.map(content => (
            <VideoCard key={content.id} {...convertToVideoProps(content)} />
          ))}
        </div>
      </section>
      
      {/* YouTube-style activity-based recommendations */}
      <section>
        <h2 className="text-title font-semibold text-text mb-4">
          Popular Videos
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {recentActivityContent.map(content => (
            <VideoCard key={content.id} {...convertToVideoProps(content)} />
          ))}
        </div>
      </section>
    </div>
  );
};

// Helper function to parse view counts
function parseViewCount(views: string): number {
  if (!views) return 0;
  const num = parseFloat(views.replace(/[^0-9.]/g, ''));
  if (views.includes('K')) return Math.floor(num * 1000);
  if (views.includes('M')) return Math.floor(num * 1000000);
  return Math.floor(num);
}

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
    <div className="min-h-screen bg-bg">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link focus:top-6"
      >
        Skip to main content
      </a>
      
      {/* Main content */}
      <main id="main-content">
        {isLoading ? (
          <div className="mx-auto max-w-container px-4 py-4">
            <div className="mb-4">
              <div className="h-6 bg-border rounded w-48 mb-4"></div>
            </div>
            <VideoGridSkeleton count={12} />
            
            <div className="mt-8 mb-4">
              <div className="h-6 bg-border rounded w-32 mb-4"></div>
            </div>
            <VideoGridSkeleton count={12} />
          </div>
        ) : items ? (
          <Suspense fallback={
            <div className="mx-auto max-w-container px-4 py-4">
              <VideoGridSkeleton count={12} />
            </div>
          }>
            <HomeContent items={items} />
          </Suspense>
        ) : (
          <div className="mx-auto max-w-container px-4 py-4">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Icon 
                  icon="material-symbols:video-library-outline" 
                  className="mx-auto mb-4 text-text-2 text-[48px]" 
                />
                <h3 className="text-heading font-medium mb-2 text-text">No content available</h3>
                <p className="text-text-2">Check back later for new videos</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;