
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const EarningsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="earnings" title="Earnings & Payouts" />
            <EmptyState 
                icon="banknote"
                title="Earnings & Payouts" 
                subtitle="A detailed breakdown of your revenue from subs, collects, and splits." 
            />
        </div>
    );
};

export default EarningsPage;
