
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const DaoPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="dao" title="Governance" />
            <EmptyState 
                icon="ballot"
                title="Governance" 
                subtitle="Create proposals, vote on the future of Reelverse, and delegate your votes." 
            />
        </div>
    );
};

export default DaoPage;
