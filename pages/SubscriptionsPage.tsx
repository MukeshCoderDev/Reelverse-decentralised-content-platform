
import React, { useState, useEffect } from 'react';
import { SubscriptionList } from '../components/subs/SubscriptionList';
import { fetchSubs } from '../lib/fetchers';
import { EmptyState } from '../components/shared/EmptyState';
import Button from '../components/Button';
import Icon from '../components/Icon';

const SubscriptionsPage: React.FC = () => {
    const [items, setItems] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            fetchSubs()
                .then(setItems)
                .finally(() => setLoading(false));
        }, 500);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="h-8 w-48 animate-pulse rounded bg-muted mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                        ))}
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold">Subscriptions</h1>
                    <Button>
                        <Icon name="search" className="mr-2" size={16} />
                        Find Creators
                    </Button>
                </div>
                <p className="text-muted-foreground">
                    Manage your creator subscriptions and support your favorite content creators
                </p>
            </div>
            
            {items && items.length > 0 ? (
                <SubscriptionList items={items} />
            ) : (
                <div className="max-w-6xl mx-auto">
                    <EmptyState 
                        icon="badge-dollar" 
                        title="No Subscriptions Yet"
                        subtitle="Support your favorite creators to unlock exclusive content, early access, and special perks. Start building your creator community today!"
                    />
                </div>
            )}
        </div>
    );
};

export default SubscriptionsPage;
