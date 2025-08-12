import { GoogleGenAI, Type } from "@google/genai";
import { VideoShelf } from '../types';

// Ensure you have the API_KEY in your environment variables.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY not found. Mock data will be used. Please provide a valid API key in environment variables to use Gemini.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const videoSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique UUID for the video." },
        title: { type: Type.STRING, description: "A catchy, viral-style video title, under 60 characters." },
        creator: { type: Type.STRING, description: "The name of the content creator." },
        creatorAvatar: { type: Type.STRING, description: "A URL for a placeholder avatar image using picsum.photos API (e.g., https://picsum.photos/40/40)." },
        views: { type: Type.STRING, description: "A formatted view count, e.g., '1.2M' or '345K'." },
        uploadedAt: { type: Type.STRING, description: "A relative time string, e.g., '3 hours ago' or '2 days ago'." },
        thumbnailUrl: { type: Type.STRING, description: "A URL for a placeholder thumbnail image using picsum.photos API, with aspect ratio 16:9 (e.g., https://picsum.photos/320/180)." },
    },
     propertyOrdering: ["id", "title", "creator", "creatorAvatar", "views", "uploadedAt", "thumbnailUrl"],
};

const homePageContentSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            shelfTitle: { type: Type.STRING, description: "Title for the content shelf, e.g., 'Trending Now' or 'For You'." },
            videos: {
                type: Type.ARRAY,
                description: "An array of 4 video objects for this shelf.",
                items: videoSchema,
            },
        },
        propertyOrdering: ["shelfTitle", "videos"],
    },
};

const getMockContent = (): VideoShelf[] => {
    return [
        {
            shelfTitle: "Trending Now (Mock)",
            videos: Array.from({ length: 4 }, (_, i) => ({
                id: `mock-trending-${i}`,
                title: `Mock Trending Video ${i + 1}`,
                creator: `Creator ${i + 1}`,
                creatorAvatar: `https://picsum.photos/seed/${i+10}/40/40`,
                views: `${Math.floor(Math.random() * 1000)}K`,
                uploadedAt: `${i + 1} days ago`,
                thumbnailUrl: `https://picsum.photos/seed/${i}/320/180`,
            })),
        },
        {
            shelfTitle: "For You (Mock)",
            videos: Array.from({ length: 4 }, (_, i) => ({
                id: `mock-foryou-${i}`,
                title: `Mock Personalized Video ${i + 1}`,
                creator: `Creator ${i + 5}`,
                creatorAvatar: `https://picsum.photos/seed/${i+20}/40/40`,
                views: `${Math.floor(Math.random() * 500)}K`,
                uploadedAt: `${i + 2} hours ago`,
                thumbnailUrl: `https://picsum.photos/seed/${i+4}/320/180`,
            })),
        }
    ];
};


export const generateHomePageContent = async (): Promise<VideoShelf[]> => {
    if (!API_KEY) {
        console.log("Using mock data for home page content.");
        return getMockContent();
    }
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a list of 3 shelves of video content for a platform like YouTube. The shelves should be 'Trending Now', 'For You', and 'Based on your recent activity'. Each shelf should contain exactly 4 videos. The content should be diverse, covering topics like tech, gaming, comedy, and vlogs.",
            config: {
                responseMimeType: "application/json",
                responseSchema: homePageContentSchema,
            },
        });

        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);
        
        // Basic validation
        if (Array.isArray(data) && data.every(shelf => shelf.shelfTitle && Array.isArray(shelf.videos))) {
             return data as VideoShelf[];
        } else {
            console.error("Gemini response did not match expected schema.", data);
            return getMockContent();
        }

    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        console.log("Falling back to mock data due to Gemini API error.");
        return getMockContent();
    }
};