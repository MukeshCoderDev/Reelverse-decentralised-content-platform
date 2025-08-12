
import React, { useState, useEffect } from 'react';
import { Inbox } from '../components/comms/Inbox';
import { fetchThreads } from '../lib/fetchers';
import { EmptyState } from '../components/shared/EmptyState';

const InboxPage: React.FC = () => {
    const [threads, setThreads] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            fetchThreads()
                .then(setThreads)
                .finally(() => setLoading(false));
        }, 500);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="h-8 w-32 animate-pulse rounded bg-muted mb-6" />
                <div className="h-[calc(100vh-8rem)] animate-pulse rounded-xl bg-muted" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Inbox</h1>
                <p className="text-muted-foreground">Connect with creators and your community</p>
            </div>
            
            {threads && threads.length > 0 ? (
                <Inbox threads={threads} />
            ) : (
                <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
                    <EmptyState 
                        icon="mail"
                        title="No Messages Yet"
                        subtitle="Start conversations with creators and other community members. Your messages will appear here."
                    />
                </div>
            )}
        </div>
    );
};

export default InboxPage;
