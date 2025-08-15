/**
 * Watermark Service
 * Handles dynamic watermark generation and positioning for video content
 */

export interface WatermarkData {
  userAddress: string;
  sessionId: string;
  contentId: string;
  timestamp?: number;
}

export interface WatermarkPosition {
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
}

export interface WatermarkConfig {
  moveInterval: number; // Milliseconds between position changes
  fadeTransition: number; // Milliseconds for fade transition
  positions: WatermarkPosition[];
  style: {
    backgroundColor: string;
    textColor: string;
    fontSize: string;
    padding: string;
    borderRadius: string;
    opacity: number;
  };
}

export class WatermarkService {
  private static instance: WatermarkService;
  private config: WatermarkConfig;

  private constructor() {
    this.config = {
      moveInterval: 10000, // Move every 10 seconds
      fadeTransition: 200, // 200ms fade
      positions: [
        { x: 10, y: 10 },   // Top-left
        { x: 50, y: 10 },   // Top-center
        { x: 90, y: 10 },   // Top-right
        { x: 10, y: 30 },   // Upper-left
        { x: 90, y: 30 },   // Upper-right
        { x: 10, y: 50 },   // Middle-left
        { x: 90, y: 50 },   // Middle-right
        { x: 10, y: 70 },   // Lower-left
        { x: 90, y: 70 },   // Lower-right
        { x: 10, y: 90 },   // Bottom-left
        { x: 50, y: 90 },   // Bottom-center
        { x: 90, y: 90 }    // Bottom-right
      ],
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        textColor: '#ffffff',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        opacity: 0.8
      }
    };
  }

  public static getInstance(): WatermarkService {
    if (!WatermarkService.instance) {
      WatermarkService.instance = new WatermarkService();
    }
    return WatermarkService.instance;
  }

  /**
   * Generate watermark text from data
   */
  generateWatermarkText(data: WatermarkData): string {
    const parts = [];
    
    // Format wallet address
    if (data.userAddress) {
      const addr = data.userAddress.toLowerCase();
      parts.push(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
    }
    
    // Add session identifier
    if (data.sessionId) {
      parts.push(`S:${data.sessionId.slice(0, 8)}`);
    }
    
    // Add content identifier
    if (data.contentId) {
      parts.push(`C:${data.contentId.slice(0, 6)}`);
    }
    
    // Add timestamp
    const timestamp = data.timestamp || Date.now();
    const date = new Date(timestamp);
    parts.push(date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    }));
    
    return parts.join(' • ');
  }

  /**
   * Get next random position that's different from current
   */
  getNextPosition(currentPosition?: WatermarkPosition): WatermarkPosition {
    const availablePositions = currentPosition 
      ? this.config.positions.filter(pos => 
          pos.x !== currentPosition.x || pos.y !== currentPosition.y
        )
      : this.config.positions;
    
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    return availablePositions[randomIndex];
  }

  /**
   * Create watermark session data
   */
  createSession(userAddress: string, contentId: string): WatermarkData {
    return {
      userAddress,
      contentId,
      sessionId: this.generateSessionId(),
      timestamp: Date.now()
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${random}`;
  }

  /**
   * Get watermark configuration
   */
  getConfig(): WatermarkConfig {
    return { ...this.config };
  }

  /**
   * Update watermark configuration
   */
  updateConfig(updates: Partial<WatermarkConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Validate watermark data
   */
  validateWatermarkData(data: WatermarkData): boolean {
    return !!(
      data.userAddress && 
      data.sessionId && 
      data.contentId &&
      data.userAddress.match(/^0x[a-fA-F0-9]{40}$/) // Valid Ethereum address
    );
  }

  /**
   * Generate CSS styles for watermark
   */
  generateWatermarkStyles(position: WatermarkPosition): React.CSSProperties {
    return {
      position: 'absolute',
      left: `${position.x}%`,
      top: `${position.y}%`,
      transform: 'translate(-50%, -50%)',
      backgroundColor: this.config.style.backgroundColor,
      color: this.config.style.textColor,
      fontSize: this.config.style.fontSize,
      padding: this.config.style.padding,
      borderRadius: this.config.style.borderRadius,
      opacity: this.config.style.opacity,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 1000,
      whiteSpace: 'nowrap',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(2px)',
      transition: `all ${this.config.fadeTransition}ms ease-in-out`
    };
  }

  /**
   * Check if watermark should be visible based on video state
   */
  shouldShowWatermark(isPlaying: boolean, hasError: boolean, isLoading: boolean): boolean {
    return isPlaying && !hasError && !isLoading;
  }

  /**
   * Generate anti-tampering hash for watermark verification
   */
  generateVerificationHash(data: WatermarkData): string {
    const payload = `${data.userAddress}:${data.sessionId}:${data.contentId}:${data.timestamp}`;
    // In a real implementation, this would use a proper cryptographic hash
    // For now, we'll use a simple hash for demonstration
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create watermark for Picture-in-Picture mode
   */
  createPiPWatermark(data: WatermarkData): string {
    return data.userAddress ? 
      `${data.userAddress.slice(0, 6)}...${data.userAddress.slice(-4)}` : 
      'Protected Content';
  }

  /**
   * Log watermark display for audit trail
   */
  logWatermarkDisplay(data: WatermarkData, position: WatermarkPosition): void {
    if (import.meta.env.DEV) {
      console.log('Watermark displayed:', {
        user: data.userAddress,
        session: data.sessionId,
        content: data.contentId,
        position,
        timestamp: new Date().toISOString()
      });
    }
    
    // In production, this would send to analytics/audit service
    this.sendAuditLog({
      type: 'watermark_display',
      data,
      position,
      timestamp: Date.now()
    });
  }

  /**
   * Send audit log (placeholder for real implementation)
   */
  private async sendAuditLog(logData: any): Promise<void> {
    try {
      // In production, send to audit service
      if (!import.meta.env.DEV) {
        await fetch('/api/v1/audit/watermark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Failed to send watermark audit log:', error);
    }
  }
}