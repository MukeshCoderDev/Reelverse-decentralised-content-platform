
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioModerationPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioModeration" title="Comments & Moderation" />
            <EmptyState 
                icon="shield-check"
                title="Comments & Moderation" 
                subtitle="Tools for comment filtering, keyword blocking, and user bans will be here." 
            />
        </div>
    );
};

export default StudioModerationPage;
