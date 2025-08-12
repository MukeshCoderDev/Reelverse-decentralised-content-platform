
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioAnalyticsPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioAnalytics" title="Analytics" />
            <EmptyState 
                icon="chart"
                title="Analytics" 
                subtitle="In-depth analytics on views, retention, and earnings are coming soon." 
            />
        </div>
    );
};

export default StudioAnalyticsPage;
