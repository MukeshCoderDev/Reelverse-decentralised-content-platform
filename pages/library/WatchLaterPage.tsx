
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const WatchLaterPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="watchLater" title="Watch Later" />
            <EmptyState icon="timer" title="No Videos to Watch Later" subtitle="Save videos to watch later and they'll show up here." />
        </div>
    );
};

export default WatchLaterPage;
