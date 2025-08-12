
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const CollectsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="collects" title="Collects & Purchases" />
            <EmptyState icon="diamond" title="No Collects or Purchases" subtitle="Your on-chain collects and other purchases will appear here." />
        </div>
    );
};

export default CollectsPage;
