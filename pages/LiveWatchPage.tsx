import { useParams, Link } from 'react-router-dom';
import { LivePlayer } from '../components/live/LivePlayer';
import { LiveChat } from '../components/live/LiveChat';
import { getLiveById } from '../lib/liveData';

/**
 * LiveWatchPage - Resilient live stream viewing with fallback handling
 * Always provides a playable stream using fallback source when needed
 * Maintains chat functionality regardless of stream status
 */
export default function LiveWatchPage() {
  const { id = '' } = useParams();
  const stream = getLiveById(id);
  
  // Always provide a playable stream source - fallback ensures no broken state
  const src = stream?.src ?? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main video and info section */}
      <div className="lg:col-span-2 space-y-4">
        {/* Live Player - always playable */}
        <LivePlayer 
          id={id} 
          src={src} 
          poster={stream?.posterUrl} 
          autoplay={true}
          className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden"
        />
        
        {/* Stream info */}
        <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/50">
          <h1 className="text-xl font-semibold text-slate-100">
            {stream?.title ?? 'Live stream'}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </span>
            <span>{stream?.viewers?.toLocaleString() ?? '0'} viewers</span>
            {stream?.category && <span>#{stream.category}</span>}
          </div>
          
          {/* Creator info */}
          {stream?.creator && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
              <img 
                src={stream.creator.avatarUrl} 
                alt={stream.creator.name}
                className="h-10 w-10 rounded-full"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-200">{stream.creator.name}</h3>
                  {stream.creator.verified && (
                    <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-sm text-slate-400">@{stream.creator.username}</p>
              </div>
              
              {/* Quick actions */}
              <div className="ml-auto flex items-center gap-2">
                <button className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors">
                  Follow
                </button>
                <button className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors">
                  💰 Tip
                </button>
              </div>
            </div>
          )}
          
          <p className="text-slate-400 mt-4">
            {stream?.description ?? 'Tip in USDC — gas covered by the Reelverse Treasury.'}
          </p>
        </div>
      </div>
      
      {/* Chat sidebar - always functional */}
      <div className="h-[70vh]">
        <LiveChat 
          streamId={id} 
          enabled={true}
          className="h-full"
        />
      </div>
      
      {/* User-friendly error message for invalid streams */}
      {!stream && (
        <div className="col-span-full text-center text-slate-400 mt-8">
          <p className="mb-2">Couldn't find that stream.</p>
          <Link 
            to="/live" 
            className="text-violet-400 hover:text-violet-300 underline"
          >
            Browse live streams →
          </Link>
        </div>
      )}
    </div>
  );
}