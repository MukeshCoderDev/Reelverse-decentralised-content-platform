
import React, { useState, useEffect, useCallback } from 'react';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { PageHeader } from '../components/layout/PageHeader';

type UploadStatus = 'idle' | 'selected' | 'estimating' | 'ready' | 'processing' | 'success' | 'error';
type Visibility = 'public' | 'unlisted' | 'private';
type Category = 'gaming' | 'music' | 'tech' | 'education' | 'entertainment' | 'sports' | 'news' | 'other';

const CreatePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [cost, setCost] = useState<{ totalWei: string; usdEstimate: number } | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('selected');
      setCost(null);
      
      // TikTok-style instant preview generation
      if (selectedFile.type.startsWith('video/')) {
        const url = URL.createObjectURL(selectedFile);
        setThumbnail(url);
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim()) && tags.length < 10) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  
  const estimateCost = useCallback(() => {
    if (!file) return;
    setStatus('estimating');
    // Simulate API call to cost oracle
    setTimeout(() => {
      const fileSizeInMB = file.size / 1024 / 1024;
      const usd = 0.05 + fileSizeInMB * 0.1; // mock calculation
      setCost({
        totalWei: (usd * 1e18 / 3000).toFixed(0), // mock ETH conversion
        usdEstimate: parseFloat(usd.toFixed(2)),
      });
      setStatus('ready');
    }, 1500);
  }, [file]);

  useEffect(() => {
    if (status === 'selected') {
      estimateCost();
    }
  }, [status, estimateCost]);

  const handlePayment = (method: 'crypto' | 'card') => {
    setStatus('processing');
    setProgress(0);
    // Simulate Trident storage job
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus('success');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };
  
  const resetFlow = () => {
      setFile(null);
      setTitle('');
      setDescription('');
      setTags([]);
      setTagInput('');
      setCategory('other');
      setVisibility('public');
      setThumbnail(null);
      setScheduledDate('');
      setStatus('idle');
      setCost(null);
      setProgress(0);
  };

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <div className="text-center p-8 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-xl border border-green-500/20">
            <div className="relative">
              <Icon name="shield-check" size={64} className="mx-auto text-green-500 mb-4" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Icon name="star" size={12} className="text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
              Upload Complete!
            </h2>
            <p className="text-muted-foreground mb-4">Your content is now live on Reelverse</p>
            <div className="flex items-center justify-center gap-4 mb-6 text-sm">
              <div className="flex items-center gap-1 text-green-500">
                <Icon name="eye" size={16} />
                <span>Ready to view</span>
              </div>
              <div className="flex items-center gap-1 text-blue-500">
                <Icon name="share" size={16} />
                <span>Ready to share</span>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={resetFlow} variant="outline">
                Upload Another
              </Button>
              <Button>
                <Icon name="eye" className="mr-2" size={16} />
                View Content
              </Button>
            </div>
          </div>
        );
      case 'processing':
        return (
          <div className="text-center p-8 bg-secondary rounded-xl">
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-primary to-blue-500 flex items-center justify-center">
                <Spinner className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Icon name="trending-up" size={16} className="text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Your Content</h2>
            <p className="text-muted-foreground mb-6">
              Uploading to decentralized storage and optimizing for the best viewing experience
            </p>
            
            {/* YouTube-style detailed progress */}
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span>Upload Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Processing steps */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className={`flex items-center gap-1 ${progress > 30 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <Icon name={progress > 30 ? 'shield-check' : 'clock'} size={12} />
                  <span>Arweave</span>
                </div>
                <div className={`flex items-center gap-1 ${progress > 60 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <Icon name={progress > 60 ? 'shield-check' : 'clock'} size={12} />
                  <span>Filecoin</span>
                </div>
                <div className={`flex items-center gap-1 ${progress > 90 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <Icon name={progress > 90 ? 'shield-check' : 'clock'} size={12} />
                  <span>Storj</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Upload & Preview (TikTok-style) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Upload Zone */}
              <div className="relative">
                <div className={`p-8 border-2 border-dashed rounded-xl text-center transition-all ${
                  file ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}>
                  {file ? (
                    <div className="space-y-4">
                      {/* TikTok-style preview */}
                      {thumbnail && (
                        <div className="relative w-32 h-48 mx-auto rounded-lg overflow-hidden bg-muted">
                          <video 
                            src={thumbnail} 
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => e.currentTarget.pause()}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Icon name="play" size={24} className="text-white" />
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-green-600">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setFile(null)} size="sm">
                        <Icon name="slash-circle" className="mr-2" size={16} />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon name="film" size={32} className="text-primary" />
                      </div>
                      <div>
                        <label htmlFor="file-upload" className="text-primary font-semibold cursor-pointer hover:underline text-lg">
                          Choose your content
                        </label>
                        <input 
                          id="file-upload" 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileChange} 
                          accept="video/*,image/*" 
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Video or image files up to 2GB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column - YouTube-style Metadata */}
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input 
                    type="text" 
                    placeholder="Add a catchy title..." 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-input p-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea 
                    placeholder="Tell viewers about your content..." 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-input p-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{description.length}/5000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                          <Icon name="slash-circle" size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add tags..." 
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1 bg-input p-2 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <Button onClick={addTag} disabled={!tagInput.trim() || tags.length >= 10} size="sm">
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tags.length}/10 tags</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value as Category)}
                      className="w-full bg-input p-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    >
                      <option value="gaming">Gaming</option>
                      <option value="music">Music</option>
                      <option value="tech">Tech</option>
                      <option value="education">Education</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="sports">Sports</option>
                      <option value="news">News</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Visibility</label>
                    <select 
                      value={visibility} 
                      onChange={e => setVisibility(e.target.value as Visibility)}
                      className="w-full bg-input p-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Schedule (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="w-full bg-input p-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Payment & Publishing */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-6">
                <div className="p-6 bg-secondary rounded-xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Icon name="shield-check" size={20} />
                    Publish & Store
                  </h3>
                  
                  <div className="space-y-4">
                    {status === 'estimating' && (
                      <div className="flex items-center text-muted-foreground">
                        <Spinner className="mr-2" size={16} />
                        Calculating storage cost...
                      </div>
                    )}
                    
                    {cost && (
                      <div className="p-4 bg-background rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Storage Cost</p>
                          <p className="text-2xl font-bold text-primary">${cost.usdEstimate.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Permanent decentralized storage
                          </p>
                        </div>
                        
                        <div className="mt-4 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span>Arweave Storage</span>
                            <span>${(cost.usdEstimate * 0.4).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Filecoin Backup</span>
                            <span>${(cost.usdEstimate * 0.3).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Storj Distribution</span>
                            <span>${(cost.usdEstimate * 0.3).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <Button 
                        onClick={() => handlePayment('crypto')} 
                        disabled={status !== 'ready' || !title.trim()}
                        className="w-full"
                      >
                        <Icon name="wallet" className="mr-2" size={16} />
                        Pay with Crypto
                      </Button>
                      
                      <Button 
                        onClick={() => handlePayment('card')} 
                        disabled={status !== 'ready' || !title.trim()}
                        variant="outline"
                        className="w-full"
                      >
                        <Icon name="credit-card" className="mr-2" size={16} />
                        Pay with Card
                      </Button>
                    </div>
                    
                    {scheduledDate && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-500 text-sm">
                          <Icon name="clock" size={16} />
                          <span>Scheduled for {new Date(scheduledDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TikTok-style quick tips */}
                <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                  <h4 className="font-semibold mb-2 text-purple-400">💡 Pro Tips</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Use trending hashtags for better discovery</li>
                    <li>• Add captions for accessibility</li>
                    <li>• Upload during peak hours (7-9 PM)</li>
                    <li>• Engage with comments quickly</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* YouTube-style header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="p-6">
          <PageHeader id="create" title="Create Content" />
        </div>
      </div>
      
      {/* Content area */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
