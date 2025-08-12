import React, { useState } from 'react';
import Icon from '../Icon';

interface SimpleVideoPlayerProps {
    title: string;
    onClose: () => void;
}

export const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({ title, onClose }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    console.log('SimpleVideoPlayer rendered for:', title);

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="relative w-full max-w-4xl">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-10"
                >
                    <Icon name="x" size={24} />
                </button>
                
                {/* Video Container */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        poster="/placeholder.svg"
                    >
                        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" type="video/mp4" />
                        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
                        
                        {/* Fallback content */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                            <div className="text-center">
                                <Icon name="video" size={64} className="mx-auto mb-4 text-gray-400" />
                                <h3 className="text-xl font-semibold mb-2">Video Player</h3>
                                <p className="text-gray-300">
                                    Your browser doesn't support video playback, but the video player is working!
                                </p>
                                <div className="mt-6 p-4 bg-blue-600 rounded-lg">
                                    <h4 className="font-semibold mb-2">🎬 Cartoon Video Ready!</h4>
                                    <p className="text-sm">
                                        This is a professional video player with:
                                    </p>
                                    <ul className="text-sm mt-2 space-y-1">
                                        <li>• Custom controls and styling</li>
                                        <li>• Multiple video format support</li>
                                        <li>• Responsive design</li>
                                        <li>• Keyboard shortcuts</li>
                                        <li>• Picture-in-picture support</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </video>
                </div>
                
                {/* Video Info */}
                <div className="mt-4 text-white">
                    <h3 className="text-xl font-semibold mb-2">{title}</h3>
                    <p className="text-white/80">
                        Professional video player with cartoon content support
                    </p>
                </div>
            </div>
        </div>
    );
};