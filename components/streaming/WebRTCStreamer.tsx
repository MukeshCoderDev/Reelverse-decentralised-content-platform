import React, { useRef, useEffect, useState, useCallback } from 'react';
import Icon from '../Icon';

interface WebRTCStreamerProps {
    isStreaming: boolean;
    onStreamStart: () => void;
    onStreamStop: () => void;
    onError: (error: string) => void;
    streamKey?: string;
}

interface StreamStats {
    bitrate: number;
    fps: number;
    resolution: string;
    droppedFrames: number;
    bandwidth: number;
    latency: number;
}

export const WebRTCStreamer: React.FC<WebRTCStreamerProps> = ({
    isStreaming,
    onStreamStart,
    onStre