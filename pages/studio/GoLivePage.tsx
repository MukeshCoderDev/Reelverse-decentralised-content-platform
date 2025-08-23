import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Stream quality preset options
 */
interface StreamQualityPreset {
  name: string;
  resolution: string;
  bitrate: string;
  fps: number;
  description: string;
}

/**
 * Stream settings interface
 */
interface StreamSettings {
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail?: File;
  privacy: 'public' | 'unlisted' | 'subscribers';
  chatEnabled: boolean;
  donationsEnabled: boolean;
  recordVOD: boolean;
  slowMode: boolean;
  subscriberOnly: boolean;
  qualityPreset: string;
}

/**
 * Quality presets for different streaming scenarios
 */
const QUALITY_PRESETS: StreamQualityPreset[] = [
  {
    name: 'ultra',
    resolution: '1920x1080',
    bitrate: '6000 kbps',
    fps: 60,
    description: 'Ultra quality for high-end gaming and professional content'
  },
  {
    name: 'high',
    resolution: '1920x1080',
    bitrate: '4500 kbps',
    fps: 30,
    description: 'High quality for most content types'
  },
  {
    name: 'medium',
    resolution: '1280x720',
    bitrate: '2500 kbps',
    fps: 30,
    description: 'Good balance of quality and performance'
  },
  {
    name: 'low',
    resolution: '854x480',
    bitrate: '1000 kbps',
    fps: 30,
    description: 'Lower quality for slower internet connections'
  }
];

/**
 * Popular streaming categories
 */
const CATEGORIES = [
  'Gaming', 'Music', 'IRL', 'Technology', 'Art', 'Education', 
  'Cooking', 'Fitness', 'Talk Shows', 'Science', 'Travel', 'Other'
];

/**
 * GoLivePage component for stream setup and configuration
 */
export default function GoLivePage() {
  const [streamSettings, setStreamSettings] = useState<StreamSettings>({
    title: '',
    description: '',
    category: 'Gaming',
    tags: [],
    privacy: 'public',
    chatEnabled: true,
    donationsEnabled: true,
    recordVOD: true,
    slowMode: false,
    subscriberOnly: false,
    qualityPreset: 'high'
  });

  const [streamKey, setStreamKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'setup' | 'preview' | 'live' | 'ending'>('setup');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Generate stream key on component mount
  useEffect(() => {
    generateStreamKey();
  }, []);

  // Generate new stream key
  const generateStreamKey = async () => {
    setIsGeneratingKey(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newKey = `rv_live_${Math.random().toString(36).substring(2, 15)}`;
    setStreamKey(newKey);
    setIsGeneratingKey(false);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Show toast notification
  };

  // Handle tag addition
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !streamSettings.tags.includes(tag) && streamSettings.tags.length < 10) {
      setStreamSettings(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setStreamSettings(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Start preview
  const startPreview = () => {
    setStreamStatus('preview');
    setPreviewError(null);
    
    // Simulate preview connection
    setTimeout(() => {
      if (Math.random() > 0.1) {
        // 90% success rate
        console.log('Preview started successfully');
      } else {
        setPreviewError('Failed to connect. Check your streaming software and stream key.');
        setStreamStatus('setup');
      }
    }, 2000);
  };

  // Start broadcasting
  const startBroadcast = () => {
    setStreamStatus('live');
    // TODO: Integrate with actual streaming API
  };

  // End stream
  const endStream = () => {
    setStreamStatus('ending');
    setTimeout(() => {
      setStreamStatus('setup');
    }, 2000);
  };

  const selectedPreset = QUALITY_PRESETS.find(p => p.name === streamSettings.qualityPreset);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link 
              to="/studio"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-white">Go Live</h1>
            {streamStatus === 'live' && (
              <div className="flex items-center gap-2 ml-4">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 font-semibold">LIVE</span>
              </div>
            )}
          </div>
          <p className="text-slate-400">
            Set up your live stream and start broadcasting to your audience
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stream Configuration */}
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Stream Details</h2>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Stream Title *
                  </label>
                  <input
                    type="text"
                    value={streamSettings.title}
                    onChange={(e) => setStreamSettings(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="What are you streaming today?"
                    maxLength={100}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="text-xs text-slate-500 mt-1 text-right">
                    {streamSettings.title.length}/100
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={streamSettings.description}
                    onChange={(e) => setStreamSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Tell viewers what your stream is about..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={streamSettings.category}
                    onChange={(e) => setStreamSettings(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tags ({streamSettings.tags.length}/10)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {streamSettings.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-violet-600/20 text-violet-400 rounded text-sm"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-violet-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add a tag..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={addTag}
                      disabled={!tagInput.trim() || streamSettings.tags.length >= 10}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Settings */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Privacy & Features</h2>
              
              <div className="space-y-4">
                {/* Privacy */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Privacy
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'public', label: 'Public', desc: 'Anyone can find and watch' },
                      { value: 'unlisted', label: 'Unlisted', desc: 'Only people with the link can watch' },
                      { value: 'subscribers', label: 'Subscribers only', desc: 'Only your subscribers can watch' }
                    ].map(option => (
                      <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          value={option.value}
                          checked={streamSettings.privacy === option.value}
                          onChange={(e) => setStreamSettings(prev => ({ ...prev, privacy: e.target.value as any }))}
                          className="mt-1 text-violet-600 focus:ring-violet-500"
                        />
                        <div>
                          <div className="text-white font-medium">{option.label}</div>
                          <div className="text-sm text-slate-400">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Feature toggles */}
                <div className="space-y-3">
                  {[
                    { key: 'chatEnabled', label: 'Enable Chat', desc: 'Allow viewers to chat' },
                    { key: 'donationsEnabled', label: 'Enable Tips', desc: 'Allow viewers to send USDC tips' },
                    { key: 'recordVOD', label: 'Record VOD', desc: 'Save recording for replay' },
                    { key: 'slowMode', label: 'Slow Mode', desc: 'Limit how often users can chat' },
                    { key: 'subscriberOnly', label: 'Subscriber Chat', desc: 'Only subscribers can chat' }
                  ].map(setting => (
                    <label key={setting.key} className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-white font-medium">{setting.label}</div>
                        <div className="text-sm text-slate-400">{setting.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={streamSettings[setting.key as keyof StreamSettings] as boolean}
                        onChange={(e) => setStreamSettings(prev => ({ ...prev, [setting.key]: e.target.checked }))}
                        className="text-violet-600 focus:ring-violet-500 rounded"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Technical Setup */}
          <div className="space-y-6">
            {/* Stream Key */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Stream Configuration</h2>
              
              <div className="space-y-4">
                {/* Stream Key */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Stream Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={streamKey}
                      readOnly
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(streamKey)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      title="Copy stream key"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={generateStreamKey}
                      disabled={isGeneratingKey}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
                      title="Generate new key"
                    >
                      {isGeneratingKey ? '⟳' : '🔄'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Keep this private! Anyone with your stream key can stream to your channel.
                  </p>
                </div>

                {/* Ingest URLs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Primary Ingest (WHIP) - Ultra Low Latency
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value="https://live.reelverse.com/whip"
                        readOnly
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard('https://live.reelverse.com/whip')}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Fallback Ingest (RTMP) - Compatible
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value="rtmp://live.reelverse.com/app"
                        readOnly
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard('rtmp://live.reelverse.com/app')}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quality Preset */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Quality Preset
                  </label>
                  <select
                    value={streamSettings.qualityPreset}
                    onChange={(e) => setStreamSettings(prev => ({ ...prev, qualityPreset: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {QUALITY_PRESETS.map(preset => (
                      <option key={preset.name} value={preset.name}>
                        {preset.resolution} @ {preset.fps}fps ({preset.bitrate})
                      </option>
                    ))}
                  </select>
                  {selectedPreset && (
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedPreset.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Stream Status & Controls */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Stream Control</h2>
              
              {/* Preview Error */}
              {previewError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-sm">
                  {previewError}
                </div>
              )}

              {/* Stream Status */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-300">Status:</span>
                  <span className={`text-sm font-semibold ${
                    streamStatus === 'live' ? 'text-red-400' :
                    streamStatus === 'preview' ? 'text-yellow-400' :
                    streamStatus === 'ending' ? 'text-orange-400' :
                    'text-slate-400'
                  }`}>
                    {streamStatus === 'live' ? 'LIVE' :
                     streamStatus === 'preview' ? 'PREVIEW' :
                     streamStatus === 'ending' ? 'ENDING' :
                     'READY TO GO LIVE'}
                  </span>
                </div>
                
                {streamStatus === 'live' && (
                  <div className="text-sm text-slate-400">
                    Stream duration: 00:15:30 • 1,337 viewers
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="space-y-3">
                {streamStatus === 'setup' && (
                  <>
                    <button
                      onClick={startPreview}
                      disabled={!streamSettings.title.trim()}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                    >
                      Start Preview
                    </button>
                    <p className="text-xs text-slate-400 text-center">
                      Test your stream setup before going live
                    </p>
                  </>
                )}

                {streamStatus === 'preview' && (
                  <>
                    <button
                      onClick={startBroadcast}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      🔴 Go Live
                    </button>
                    <button
                      onClick={() => setStreamStatus('setup')}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      Stop Preview
                    </button>
                  </>
                )}

                {streamStatus === 'live' && (
                  <>
                    <button
                      onClick={endStream}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      End Stream
                    </button>
                    <Link
                      to={`/live/current_stream_id`}
                      className="block w-full py-2 bg-violet-600 hover:bg-violet-700 text-white text-center rounded-lg transition-colors"
                    >
                      View Live Stream
                    </Link>
                  </>
                )}

                {streamStatus === 'ending' && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-2"></div>
                    <p className="text-slate-400">Ending stream...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}