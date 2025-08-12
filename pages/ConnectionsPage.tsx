
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const ConnectionsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="connections" title="Connected Services" />
            <EmptyState 
                icon="plug"
                title="Connected Services" 
                subtitle="Link your Crossmint, Lens, Discord, and other social accounts." 
            />
        </div>
    );
};

export default ConnectionsPage;
