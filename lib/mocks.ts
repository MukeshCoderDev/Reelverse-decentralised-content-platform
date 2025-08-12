
import { Content } from '../types';

export const mockContent: Content[] = Array.from({ length: 12 }).map((_, i) => ({
    id: `vid_${i}`,
    title: `Sample Reelverse Video Title That Can Be Quite Long ${i + 1}`,
    creator: ["TechGuru", "PixelPlays", "DIYDebi", "LensExplorer", "CryptoCadet"][i % 5],
    views: `${Math.floor(Math.random() * 900 + 100)}K views`,
    ago: `${Math.floor(Math.random() * 6 + 1)} days ago`,
    thumbnail: `https://picsum.photos/seed/reel${i}/480/270`,
    // TikTok-style engagement metrics
    likes: Math.floor(Math.random() * 50000 + 1000),
    comments: Math.floor(Math.random() * 5000 + 100),
    shares: Math.floor(Math.random() * 1000 + 50),
    trending: Math.random() > 0.7,
    engagementRate: Math.floor(Math.random() * 15 + 5),
    // YouTube-style algorithm hints
    algorithmHint: [
        "Because you watched TechGuru",
        "Trending in Gaming",
        "Popular with your subscriptions",
        "Recommended for you",
        "Similar to videos you liked"
    ][i % 5]
}));

export const mockSubs = [
    { creator: "Creator One", tier: "Plus", renewsAt: "in 27 days" },
    { creator: "Creator Two", tier: "Pro", renewsAt: "in 12 days" },
    { creator: "Another Creator", tier: "Basic", renewsAt: "in 3 days" },
];

export const mockNotifications = [
    { id: "1", type: "upload", text: "Creator One uploaded a new reel: 'Web3 Onboarding Simplified'", time: "2h ago" },
    { id: "2", type: "comment", text: "PixelPlays replied to your comment on 'The Future of Decentralized Storage'", time: "5h ago" },
    { id: "3", type: "mention", text: "You were mentioned in a post by LensExplorer.", time: "1 day ago" },
    { id: "4", type: "collect", text: "Someone collected your reel 'My First Reelverse Post!'", time: "2 days ago" },
];

export const mockThreads = [
    { id: "t1", title: "Collab with Creator One", last: "Sounds good, let’s split 50/50 via the RevenueSplitter contract." },
    { id: "t2", title: "Sponsor Deal - AwesomeCo", last: "Here is the draft contract for the integration. Please review." },
    { id: "t3", title: "GM", last: "gm" }
];
