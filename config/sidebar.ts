
import { SidebarGroup } from '../types';
import { FEATURES } from './featureFlags';

export const sidebar: readonly SidebarGroup[] = [
  { id: "upload", intent: "primary", items: [
    { id: "upload", label: "+ Upload", icon: "plus-circle", route: "/upload" }
  ] },

  { group: "Primary", items: [
    { id: "home", label: "Home", icon: "home", route: "/" },
    { id: "following", label: "Following", icon: "users", route: "/following" },
    { id: "trending", label: "Trending", icon: "flame", route: "/trending" },
    { id: "explore", label: "Explore", icon: "search", route: "/explore" },
    { id: "subs", label: "Subscriptions", icon: "badge-dollar", route: "/subs" },
    { id: "communities", label: "Communities", icon: "users-round", route: "/communities" },
    { id: "notifications", label: "Notifications", icon: "bell", route: "/notifications" },
    { id: "inbox", label: "Inbox", icon: "mail", route: "/inbox" }
  ]},

  { group: "Library", items: [
    { id: "profile", label: "Your Profile", icon: "person", route: "/u/me" },
    { id: "history", label: "History", icon: "clock", route: "/library/history" },
    { id: "liked", label: "Liked Videos", icon: "star", route: "/library/liked" },
    { id: "watch-later", label: "Watch Later", icon: "timer", route: "/library/watch-later" },
    { id: "collections", label: "Collections", icon: "folder", route: "/library/collections" },
    { id: "collects", label: "Collects & Purchases", icon: "diamond", route: "/library/collects" },
    { id: "drafts", label: "Drafts", icon: "file-dashed", route: "/library/drafts", role: "creator" }
  ]},

  { group: "Studio", role: "creator", items: [
    { id: "studio", label: "Dashboard", icon: "gauge", route: "/studio" },
    { id: "agency", label: "Agency Dashboard", icon: "users", route: "/agency" },
    { id: "studio-content", label: "Content", icon: "film", route: "/studio/content" },
    { id: "studio-monetization", label: "Monetization", icon: "coins", route: "/studio/monetization" },
    { id: "studio-subs", label: "Subscriptions", icon: "ticket", route: "/studio/subscriptions" },
    { id: "studio-splits", label: "Collabs & Splits", icon: "git-merge", route: "/studio/splits" },
    { id: "studio-analytics", label: "Analytics", icon: "chart", route: "/studio/analytics" },
    { id: "studio-moderation", label: "Comments & Moderation", icon: "shield-check", route: "/studio/moderation" },
    { id: "studio-verify", label: "Verification", icon: "shield-check", route: "/studio/verify" }
  ]},

  { group: "FINANCE", items: [
    ...(FEATURES.EARNINGS_ENABLED ? [{ id: "finance", label: "Earnings & Payouts", icon: "credit-card" as const, route: "/finance" }] : []),
    ...(FEATURES.WALLET_ENABLED ? [{ id: "wallet", label: "Wallet", icon: "wallet" as const, route: "/wallet" }] : []),
    ...(FEATURES.BUY_CRYPTO_ENABLED ? [{ id: "onramp", label: "Buy Crypto", icon: "credit-card" as const, route: "/buy-crypto" }] : [])
  ].filter(Boolean)},

  { group: "System", items: [
    { id: "settings", label: "Settings", icon: "settings", route: "/settings" },
    { id: "connections", label: "Connected Services", icon: "plug", route: "/settings/connections" },
    { id: "help", label: "Help & Feedback", icon: "lifebuoy", route: "/help" },
    { id: "status", label: "Status", icon: "activity", route: "/status" }
  ]},

  { group: "Phase2", featureFlag: true, items: [
    { id: "live", label: "Live", icon: "broadcast", route: "/live" },
    { id: "dao", label: "Governance", icon: "ballot", route: "/dao" },
    { id: "treasury", label: "Treasury", icon: "safe", route: "/dao/treasury" },
    { id: "rewards", label: "Rewards & Quests", icon: "gift", route: "/rewards" }
  ]}
];
