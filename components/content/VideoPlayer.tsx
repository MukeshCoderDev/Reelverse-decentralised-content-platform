import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../Icon';
import { WatermarkService, WatermarkData, WatermarkPosition } from '../../services/watermarkService';

interface VideoPlayerProps {
    src: string;
    title: string;
    poster?: string;
    autoPlay?: boolean;
    className?: string;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onEnded?: () => void;
    onError?: (error: string) => void;
    // Watermarking props
    enableWatermark?: boolean;
    watermarkData?: WatermarkData;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    title,
    poster,
    autoPlay = false,
    className = '',
    onTimeUpdate,
    onEnded,
    onError,
    enableWatermark = false,
    watermarkData
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [quality, setQuality] = useState('auto');
    const [showSettings, setShowSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [buffered, setBuffered] = useState(0);
    const [chapters, setChapters] = useState<Array<{time: number, title: string}>>([]);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [isPictureInPicture, setIsPictureInPicture] = useState(false);

    // Watermark state
    const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>({ x: 10, y: 10 });
    const [watermarkVisible, setWatermarkVisible] = useState(true);
    const watermarkIntervalRef = useRef<NodeJS.Timeout>();
    const watermarkService = WatermarkService.getInstance();

    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    // Watermark movement effect
    useEffect(() => {
        if (!enableWatermark || !watermarkData || !watermarkService.shouldShowWatermark(isPlaying, !!error, isLoading)) {
            if (watermarkIntervalRef.current) {
                clearInterval(watermarkIntervalRef.current);
            }
            return;
        }

        const config = watermarkService.getConfig();
        
        // Move watermark at configured intervals
        watermarkIntervalRef.current = setInterval(() => {
            const nextPosition = watermarkService.getNextPosition(watermarkPosition);
            
            // Log watermark display for audit
            watermarkService.logWatermarkDisplay(watermarkData, nextPosition);
            
            // Briefly hide watermark during transition
            setWatermarkVisible(false);
            setTimeout(() => {
                setWatermarkPosition(nextPosition);
                setWatermarkVisible(true);
            }, config.fadeTransition);
        }, config.moveInterval);

        return () => {
            if (watermarkIntervalRef.current) {
                clearInterval(watermarkIntervalRef.current);
            }
        };
    }, [enableWatermark, watermarkData, isPlaying, error, isLoading, watermarkPosition]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const time = video.currentTime;
            setCurrentTime(time);
            
            // Update buffered progress
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                setBuffered((bufferedEnd / video.duration) * 100);
            }
            
            // Update current chapter
            const chapterIndex = chapters.findIndex((chapter, index) => {
                const nextChapter = chapters[index + 1];
                return time >= chapter.time && (!nextChapter || time < nextChapter.time);
            });
            if (chapterIndex !== -1) {
                setCurrentChapter(chapterIndex);
            }
            
            // Call external callback
            if (onTimeUpdate) {
                onTimeUpdate(time, video.duration);
            }
        };

        const handleDurationChange = () => {
            setDuration(video.duration);
            setIsLoading(false);
            
            // Generate mock chapters for demo
            if (video.duration > 0) {
                const mockChapters = [
                    { time: 0, title: 'Introduction' },
                    { time: video.duration * 0.25, title: 'Main Content' },
                    { time: video.duration * 0.75, title: 'Conclusion' }
                ];
                setChapters(mockChapters);
            }
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        const handleLoadStart = () => setIsLoading(true);
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e: Event) => {
            console.error('Video error:', e);
            setError('Failed to load video. Please try again.');
            setIsLoading(false);
            if (onError) {
                onError('Failed to load video');
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            if (onEnded) {
                onEnded();
            }
        };

        const handleEnterpictureinpicture = () => setIsPictureInPicture(true);
        const handleLeavepictureinpicture = () => setIsPictureInPicture(false);

        // Add all event listeners
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('enterpictureinpicture', handleEnterpictureinpicture);
        video.addEventListener('leavepictureinpicture', handleLeavepictureinpicture);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('enterpictureinpicture', handleEnterpictureinpicture);
            video.removeEventListener('leavepictureinpicture', handleLeavepictureinpicture);
        };
    }, [chapters, onTimeUpdate, onEnded, onError]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;

        const newTime = parseFloat(e.target.value);
        video.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;

        const newVolume = parseFloat(e.target.value);
        video.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const toggleFullscreen = () => {
        const video = videoRef.current;
        if (!video) return;

        if (!isFullscreen) {
            if (video.requestFullscreen) {
                video.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    };

    const changePlaybackRate = (rate: number) => {
        const video = videoRef.current;
        if (!video) return;

        video.playbackRate = rate;
        setPlaybackRate(rate);
        setShowSettings(false);
    };

    const togglePictureInPicture = async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (isPictureInPicture) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('Picture-in-Picture error:', error);
        }
    };

    const jumpToChapter = (chapterIndex: number) => {
        const video = videoRef.current;
        if (!video || !chapters[chapterIndex]) return;

        video.currentTime = chapters[chapterIndex].time;
        setCurrentChapter(chapterIndex);
    };

    const skipForward = () => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.min(duration, currentTime + 10);
    };

    const skipBackward = () => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, currentTime - 10);
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getWatermarkText = () => {
        if (!watermarkData || !watermarkService.validateWatermarkData(watermarkData)) {
            return '';
        }
        return watermarkService.generateWatermarkText(watermarkData);
    };

    const getPiPWatermarkText = () => {
        if (!watermarkData) return 'Protected Content';
        return watermarkService.createPiPWatermark(watermarkData);
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, currentTime - 10);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(duration, currentTime + 10);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(1, volume + 0.1));
                if (videoRef.current) {
                    videoRef.current.volume = Math.min(1, volume + 0.1);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, volume - 0.1));
                if (videoRef.current) {
                    videoRef.current.volume = Math.max(0, volume - 0.1);
                }
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                toggleMute();
                break;
        }
    };

    return (
        <div 
            className={`relative bg-black rounded-lg overflow-hidden group ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                poster={poster}
                autoPlay={autoPlay}
                preload="metadata"
                className="w-full h-full object-contain"
                onClick={togglePlay}
                controls={false}
            >
                <source src={src} type="video/mp4" />
                <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center text-white">
                        <Icon name="x" size={48} className="mx-auto mb-4 text-red-500" />
                        <h3 className="text-lg font-semibold mb-2">Video Error</h3>
                        <p className="text-sm opacity-80">{error}</p>
                        <button
                            onClick={() => {
                                setError(null);
                                if (videoRef.current) {
                                    videoRef.current.load();
                                }
                            }}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Play/Pause Overlay */}
            {!isPlaying && !error && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <button
                        onClick={togglePlay}
                        className="p-4 bg-white/20 rounded-full hover:bg-white/30 transition-colors backdrop-blur-sm"
                    >
                        <Icon name="play" size={48} className="text-white ml-1" />
                    </button>
                </div>
            )}

            {/* Loading Spinner */}
            {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
            )}

            {/* Dynamic Watermark Overlay */}
            {enableWatermark && watermarkData && watermarkService.shouldShowWatermark(isPlaying, !!error, isLoading) && watermarkVisible && (
                <div 
                    className="absolute pointer-events-none select-none z-30"
                    style={watermarkService.generateWatermarkStyles(watermarkPosition)}
                >
                    {getWatermarkText()}
                </div>
            )}

            {/* Watermark for Picture-in-Picture */}
            {enableWatermark && watermarkData && isPictureInPicture && (
                <div className="absolute top-2 left-2 pointer-events-none select-none z-30">
                    <div className="bg-black/60 text-white px-2 py-1 rounded text-xs font-mono">
                        {getPiPWatermarkText()}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
            }`}>
                {/* Progress Bar with Buffered Content */}
                <div className="mb-4 relative">
                    {/* Buffered progress */}
                    <div className="absolute inset-0 h-1 bg-white/30 rounded-lg">
                        <div 
                            className="h-full bg-white/50 rounded-lg transition-all duration-300"
                            style={{ width: `${buffered}%` }}
                        ></div>
                    </div>
                    
                    {/* Chapter markers */}
                    {chapters.map((chapter, index) => (
                        <div
                            key={index}
                            className="absolute top-0 w-1 h-1 bg-yellow-400 rounded-full cursor-pointer hover:scale-150 transition-transform"
                            style={{ left: `${(chapter.time / duration) * 100}%` }}
                            onClick={() => jumpToChapter(index)}
                            title={chapter.title}
                        ></div>
                    ))}
                    
                    {/* Main progress bar */}
                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="relative w-full h-1 bg-transparent rounded-lg appearance-none cursor-pointer slider z-10"
                        style={{
                            background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(currentTime / duration) * 100}%, transparent ${(currentTime / duration) * 100}%, transparent 100%)`
                        }}
                    />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                        {/* Skip Backward */}
                        <button
                            onClick={skipBackward}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            title="Skip back 10s"
                        >
                            <Icon name="chevron-left" size={16} />
                            <span className="text-xs">10</span>
                        </button>

                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
                        </button>

                        {/* Skip Forward */}
                        <button
                            onClick={skipForward}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            title="Skip forward 10s"
                        >
                            <span className="text-xs">10</span>
                            <Icon name="chevron-right" size={16} />
                        </button>

                        {/* Volume */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleMute}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <Icon 
                                    name={isMuted || volume === 0 ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2'} 
                                    size={20} 
                                />
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Time Display with Chapter */}
                        <div className="text-sm">
                            <div>{formatTime(currentTime)} / {formatTime(duration)}</div>
                            {chapters[currentChapter] && (
                                <div className="text-xs text-white/70">
                                    {chapters[currentChapter].title}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Settings */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <Icon name="settings" size={20} />
                            </button>

                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/20 rounded-lg p-2 min-w-32">
                                    <div className="text-sm font-medium mb-2">Playback Speed</div>
                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => changePlaybackRate(rate)}
                                            className={`block w-full text-left px-2 py-1 text-sm hover:bg-white/20 rounded ${
                                                playbackRate === rate ? 'text-red-500' : ''
                                            }`}
                                        >
                                            {rate}x {rate === 1 ? '(Normal)' : ''}
                                        </button>
                                    ))}
                                    
                                    <hr className="my-2 border-white/20" />
                                    
                                    <div className="text-sm font-medium mb-2">Quality</div>
                                    {['auto', '1080p', '720p', '480p'].map(q => (
                                        <button
                                            key={q}
                                            onClick={() => setQuality(q)}
                                            className={`block w-full text-left px-2 py-1 text-sm hover:bg-white/20 rounded ${
                                                quality === q ? 'text-red-500' : ''
                                            }`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Picture-in-Picture */}
                        <button
                            onClick={togglePictureInPicture}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            title="Picture-in-Picture"
                        >
                            <Icon name="minimize" size={20} />
                        </button>

                        {/* Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={20} />
                        </button>
                    </div>
                </div>
            </div>


        </div>
    );
};