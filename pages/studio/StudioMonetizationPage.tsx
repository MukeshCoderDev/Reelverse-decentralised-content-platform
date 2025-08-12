
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioMonetizationPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioMonetization" title="Monetization" />
            <EmptyState 
                icon="coins"
                title="Monetization" 
                subtitle="Set collect prices, token gates, and licensing options here." 
            />
        </div>
    );
};

export default StudioMonetizationPage;
