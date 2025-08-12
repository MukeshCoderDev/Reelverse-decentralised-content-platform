
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const StatusPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="status" title="Status" />
            <EmptyState 
                icon="activity"
                title="System Status" 
                subtitle="Check the health of storage nodes, chains, and APIs." 
            />
        </div>
    );
};

export default StatusPage;
