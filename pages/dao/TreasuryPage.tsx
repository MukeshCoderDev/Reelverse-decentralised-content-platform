
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const TreasuryPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="treasury" title="Treasury" />
            <EmptyState 
                icon="safe"
                title="Treasury" 
                subtitle="View the DAO treasury balances and transaction history." 
            />
        </div>
    );
};

export default TreasuryPage;
