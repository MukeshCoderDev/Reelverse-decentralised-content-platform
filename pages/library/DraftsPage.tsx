
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const DraftsPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="drafts" title="Drafts" />
            <EmptyState icon="file-dashed" title="No Drafts" subtitle="Unfinished uploads will be saved here for you to complete later." />
        </div>
    );
};

export default DraftsPage;
