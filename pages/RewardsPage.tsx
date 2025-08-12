
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const RewardsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="rewards" title="Rewards & Quests" />
            <EmptyState 
                icon="gift"
                title="Rewards & Quests" 
                subtitle="Complete missions to earn LibertyTokens and other rewards." 
            />
        </div>
    );
};

export default RewardsPage;
