
export type IconName = 
  | 'plus' | 'home' | 'users' | 'flame' | 'search' | 'badge-dollar' | 'users-round'
  | 'bell' | 'mail' | 'user' | 'clock' | 'star' | 'timer' | 'folder' | 'diamond'
  | 'file-dashed' | 'gauge' | 'film' | 'coins' | 'ticket' | 'git-merge' | 'chart'
  | 'shield-check' | 'wallet' | 'banknote' | 'credit-card' | 'settings' | 'plug'
  | 'lifebuoy' | 'activity' | 'broadcast' | 'ballot' | 'safe' | 'gift' | 'person'
  | 'info' | 'video' | 'image' | 'slash-circle' | 'filter' | 'heart' | 'message-circle'
  | 'share' | 'trending-up' | 'eye' | 'play' | 'chevron-right' | 'chevron-left'
  | 'gamepad-2' | 'music' | 'cpu' | 'graduation-cap' | 'tv' | 'trophy' | 'newspaper'
  | 'trending-down' | 'list' | 'grid' | 'check' | 'trash' | 'more-horizontal' | 'x'
  | 'download' | 'pause' | 'volume-x' | 'volume-1' | 'volume-2' | 'minimize' | 'maximize'
  | 'menu' | 'pin' | 'copy' | 'external-link' | 'refresh-cw' | 'loader' | 'alert-circle'
  | 'check-circle' | 'wifi' | 'wifi-off' | 'link' | 'unlink' | 'globe';

export interface SidebarItem {
  id: string;
  label: string;
  icon: IconName;
  route: string;
  role?: 'creator';
}

export interface SidebarGroup {
  id?: string;
  group?: string;
  items: readonly SidebarItem[];
  intent?: 'primary';
  role?: 'creator';
  featureFlag?: boolean;
}

export interface Content {
    id: string;
    title: string;
    creator: string;
    views: string;
    ago: string;
    thumbnail?: string;
    // TikTok-style engagement metrics
    likes?: number;
    comments?: number;
    shares?: number;
    trending?: boolean;
    // YouTube-style algorithm hints
    algorithmHint?: string;
    engagementRate?: number;
}

export interface Video {
    id: string;
    title: string;
    creator: string;
    creatorAvatar: string;
    views: string;
    uploadedAt: string;
    thumbnailUrl: string;
}

export interface VideoShelf {
  shelfTitle: string;
  videos: Video[];
}
