
import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

const StudioVerifyPage: React.FC = () => {
    return (
        <div>
            <PageHeader id="studioVerify" title="Creator Verification" />
            <EmptyState 
                icon="shield-check"
                title="Creator Verification" 
                subtitle="Apply for and manage your creator verification status." 
            />
        </div>
    );
};

export default StudioVerifyPage;
