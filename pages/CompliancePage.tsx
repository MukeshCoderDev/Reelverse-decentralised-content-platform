import React from 'react';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { useAuth } from '../contexts/AuthContext';

export const CompliancePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <ComplianceDashboard organizationId={user?.selectedOrganization} />
      </div>
    </div>
  );
};