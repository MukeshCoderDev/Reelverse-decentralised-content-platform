
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioSubscriptionsPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioSubs" title="Subscriptions Manager" />
            <EmptyState 
                icon="ticket"
                title="Subscriptions Manager" 
                subtitle="Create membership tiers, define perks, and view your subscribers." 
            />
        </div>
    );
};

export default StudioSubscriptionsPage;
