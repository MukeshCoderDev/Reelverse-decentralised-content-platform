import React from 'react';
import { PromoKitDashboard } from '../components/promo/PromoKitDashboard';
import { useAuth } from '../contexts/AuthContext';

export const PromoKitPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <PromoKitDashboard organizationId={user?.selectedOrganization} />
      </div>
    </div>
  );
};