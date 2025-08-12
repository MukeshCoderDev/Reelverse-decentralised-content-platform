
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const BuyCryptoPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="buyCrypto" title="Buy Crypto" />
            <EmptyState 
                icon="credit-card"
                title="Buy Crypto" 
                subtitle="Our on-ramp integration with Crossmint will be available here." 
            />
        </div>
    );
};

export default BuyCryptoPage;
