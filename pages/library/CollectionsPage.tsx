
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const CollectionsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="collections" title="Collections" />
            <EmptyState icon="folder" title="No Collections" subtitle="Create and manage your video playlists here." />
        </div>
    );
};

export default CollectionsPage;
