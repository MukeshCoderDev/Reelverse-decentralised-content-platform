
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const LikedPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="liked" title="Liked Videos" />
            <EmptyState icon="star" title="No Liked Videos" subtitle="Videos you like will appear here." />
        </div>
    );
};

export default LikedPage;
