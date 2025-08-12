
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ContentTable } from '../../components/studio/ContentTable';
import Button from '../../components/Button';

const StudioContentPage: React.FC = () => {
    const rows = [
        { id: "1", title: "How to build on Lens", status: "READY", views: 12345 },
        { id: "2", title: "Web3 Storage Deep Dive", status: "PAID", views: 6789 },
        { id: "3", title: "My first Reelverse Reel!", status: "PROCESSING", views: 102 }
    ];

    return (
        <div>
            <PageHeader
                id="studioContent"
                title="Content Manager"
                actions={<Button>Upload</Button>}
            />
            <ContentTable rows={rows} />
        </div>
    );
};

export default StudioContentPage;
