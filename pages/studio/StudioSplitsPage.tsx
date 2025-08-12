
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioSplitsPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioSplits" title="Collabs & Splits" />
            <EmptyState 
                icon="git-merge"
                title="Collabs & Splits" 
                subtitle="Invite collaborators and set up on-chain revenue splits." 
            />
        </div>
    );
};

export default StudioSplitsPage;
