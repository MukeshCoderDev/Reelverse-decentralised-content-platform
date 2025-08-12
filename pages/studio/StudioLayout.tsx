
import React from 'react';
import { Outlet } from 'react-router-dom';
import { StudioNav } from '../../components/studio/StudioNav';

const StudioLayout: React.FC = () => {
    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row gap-8">
                <StudioNav />
                <div className="min-h-[60vh] flex-1">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default StudioLayout;
