
import { mockContent, mockSubs, mockNotifications, mockThreads } from './mocks';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// In a real app, these would hit API endpoints. For now, they return mock data.
// A short delay is added to simulate network latency.

export async function fetchHome() {
    await delay(500);
    // try { const r = await fetch("/api/content/home"); if (r.ok) return await r.json(); } catch {}
    return mockContent;
}

export async function fetchFollowing() {
    await delay(300);
    // try { const r = await fetch("/api/content/following"); if (r.ok) return await r.json(); } catch {}
    return mockContent.slice(0, 6);
}

export async function fetchTrending() {
    await delay(400);
    // try { const r = await fetch("/api/content/trending"); if (r.ok) return await r.json(); } catch {}
    return mockContent;
}

export async function fetchExplore() {
    await delay(450);
    // try { const r = await fetch("/api/content/explore"); if (r.ok) return await r.json(); } catch {}
    return { 
        categories: [
            { id: "gaming", name: "Gaming" }, 
            { id: "music", name: "Music" }, 
            { id: "tech", name: "Tech" }, 
            { id: "news", name: "News" },
            { id: "defi", name: "DeFi" },
            { id: "nfts", name: "NFTs" },
        ], 
        items: mockContent 
    };
}

export async function fetchSubs() {
    await delay(200);
    // try { const r = await fetch("/api/subs/me"); if (r.ok) return await r.json(); } catch {}
    return mockSubs;
}

export async function fetchNotifications() {
    await delay(250);
    // try { const r = await fetch("/api/notifications"); if (r.ok) return await r.json(); } catch {}
    return mockNotifications;
}

export async function fetchThreads() {
    await delay(350);
    // try { const r = await fetch("/api/inbox/threads"); if (r.ok) return await r.json(); } catch {}
    return mockThreads;
}
