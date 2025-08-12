
import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';

const HelpPage: React.FC = () => {
    return (
        <div className="p-6">
            <PageHeader id="help" title="Help & Feedback" />
            <EmptyState 
                icon="lifebuoy"
                title="Help & Feedback" 
                subtitle="Find documentation, get support, and report bugs here." 
            />
        </div>
    );
};

export default HelpPage;
