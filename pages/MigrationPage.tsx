import React from 'react';
import { MigrationDashboard } from '../components/migration/MigrationDashboard';
import { useAuth } from '../contexts/AuthContext';

export const MigrationPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <MigrationDashboard organizationId={user?.selectedOrganization} />
      </div>
    </div>
  );
};