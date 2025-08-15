import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Organization, OrganizationMember, OrganizationService } from '../services/organizationService';
import { useWallet } from './WalletContext';

interface OrganizationState {
  currentOrganization: Organization | null;
  userOrganizations: Organization[];
  currentMember: OrganizationMember | null;
  organizationMembers: OrganizationMember[];
  isLoading: boolean;
  error: string | null;
}

interface OrganizationContextType extends OrganizationState {
  // Organization actions
  switchOrganization: (orgId: string) => Promise<void>;
  createOrganization: (data: { name: string; type: 'agency' | 'studio'; description?: string }) => Promise<Organization>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;
  
  // Member actions
  inviteMember: (email: string, role: 'manager' | 'uploader' | 'analyst', quota?: number) => Promise<void>;
  updateMember: (memberWallet: string, updates: any) => Promise<void>;
  removeMember: (memberWallet: string) => Promise<void>;
  
  // Utility functions
  hasPermission: (resource: string, action: string) => boolean;
  canManageMembers: () => boolean;
  canUploadContent: () => boolean;
  getRemainingQuota: () => number;
  
  // State management
  refreshOrganizations: () => Promise<void>;
  clearError: () => void;
}

const initialState: OrganizationState = {
  currentOrganization: null,
  userOrganizations: [],
  currentMember: null,
  organizationMembers: [],
  isLoading: false,
  error: null,
};

type OrganizationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER_ORGANIZATIONS'; payload: Organization[] }
  | { type: 'SET_CURRENT_ORGANIZATION'; payload: Organization | null }
  | { type: 'SET_CURRENT_MEMBER'; payload: OrganizationMember | null }
  | { type: 'SET_ORGANIZATION_MEMBERS'; payload: OrganizationMember[] }
  | { type: 'ADD_ORGANIZATION'; payload: Organization }
  | { type: 'UPDATE_ORGANIZATION'; payload: Organization }
  | { type: 'ADD_MEMBER'; payload: OrganizationMember }
  | { type: 'UPDATE_MEMBER'; payload: OrganizationMember }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'CLEAR_ALL' };

function organizationReducer(state: OrganizationState, action: OrganizationAction): OrganizationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_USER_ORGANIZATIONS':
      return { ...state, userOrganizations: action.payload };

    case 'SET_CURRENT_ORGANIZATION':
      return { ...state, currentOrganization: action.payload };

    case 'SET_CURRENT_MEMBER':
      return { ...state, currentMember: action.payload };

    case 'SET_ORGANIZATION_MEMBERS':
      return { ...state, organizationMembers: action.payload };

    case 'ADD_ORGANIZATION':
      return {
        ...state,
        userOrganizations: [...state.userOrganizations, action.payload],
      };

    case 'UPDATE_ORGANIZATION':
      return {
        ...state,
        userOrganizations: state.userOrganizations.map(org =>
          org.id === action.payload.id ? action.payload : org
        ),
        currentOrganization: state.currentOrganization?.id === action.payload.id 
          ? action.payload 
          : state.currentOrganization,
      };

    case 'ADD_MEMBER':
      return {
        ...state,
        organizationMembers: [...state.organizationMembers, action.payload],
      };

    case 'UPDATE_MEMBER':
      return {
        ...state,
        organizationMembers: state.organizationMembers.map(member =>
          member.wallet === action.payload.wallet ? action.payload : member
        ),
        currentMember: state.currentMember?.wallet === action.payload.wallet 
          ? action.payload 
          : state.currentMember,
      };

    case 'REMOVE_MEMBER':
      return {
        ...state,
        organizationMembers: state.organizationMembers.filter(member => member.wallet !== action.payload),
      };

    case 'CLEAR_ALL':
      return initialState;

    default:
      return state;
  }
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(organizationReducer, initialState);
  const { isConnected, account, isAuthenticated } = useWallet();
  const organizationService = OrganizationService.getInstance();

  // Load user organizations when wallet connects
  useEffect(() => {
    if (isConnected && account && isAuthenticated) {
      loadUserOrganizations();
    } else {
      dispatch({ type: 'CLEAR_ALL' });
    }
  }, [isConnected, account, isAuthenticated]);

  // Load organization members when current organization changes
  useEffect(() => {
    if (state.currentOrganization) {
      loadOrganizationMembers();
      loadCurrentMember();
    }
  }, [state.currentOrganization, account]);

  const loadUserOrganizations = async () => {
    if (!account) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const organizations = await organizationService.getUserOrganizations(account);
      dispatch({ type: 'SET_USER_ORGANIZATIONS', payload: organizations });

      // Set default organization (individual account or first available)
      const defaultOrg = organizations.find(org => org.type === 'individual') || organizations[0];
      if (defaultOrg && !state.currentOrganization) {
        dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: defaultOrg });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadOrganizationMembers = async () => {
    if (!state.currentOrganization) return;

    try {
      const members = await organizationService.getOrganizationMembers(state.currentOrganization.id);
      dispatch({ type: 'SET_ORGANIZATION_MEMBERS', payload: members });
    } catch (error: any) {
      console.error('Failed to load organization members:', error);
    }
  };

  const loadCurrentMember = async () => {
    if (!state.currentOrganization || !account) return;

    try {
      const members = await organizationService.getOrganizationMembers(state.currentOrganization.id);
      const currentMember = members.find(member => member.wallet.toLowerCase() === account.toLowerCase());
      dispatch({ type: 'SET_CURRENT_MEMBER', payload: currentMember || null });
    } catch (error: any) {
      console.error('Failed to load current member:', error);
    }
  };

  const switchOrganization = async (orgId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const organization = await organizationService.getOrganization(orgId);
      dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: organization });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createOrganization = async (data: { name: string; type: 'agency' | 'studio'; description?: string }) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const newOrg = await organizationService.createOrganization(data);
      dispatch({ type: 'ADD_ORGANIZATION', payload: newOrg });
      dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: newOrg });
      
      return newOrg;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateOrganization = async (orgId: string, updates: Partial<Organization>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const updatedOrg = await organizationService.updateOrganization(orgId, updates);
      dispatch({ type: 'UPDATE_ORGANIZATION', payload: updatedOrg });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const inviteMember = async (email: string, role: 'manager' | 'uploader' | 'analyst', quota?: number) => {
    if (!state.currentOrganization) throw new Error('No organization selected');

    try {
      dispatch({ type: 'SET_ERROR', payload: null });

      const uploadQuota = quota || organizationService.getDefaultUploadQuota(role);
      const permissions = organizationService.getDefaultPermissions(role);

      await organizationService.inviteMember(state.currentOrganization.id, {
        email,
        role,
        uploadQuota,
        permissions,
      });

      // Refresh members list
      await loadOrganizationMembers();
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const updateMember = async (memberWallet: string, updates: any) => {
    if (!state.currentOrganization) throw new Error('No organization selected');

    try {
      dispatch({ type: 'SET_ERROR', payload: null });

      const updatedMember = await organizationService.updateMember(
        state.currentOrganization.id,
        memberWallet,
        updates
      );
      dispatch({ type: 'UPDATE_MEMBER', payload: updatedMember });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const removeMember = async (memberWallet: string) => {
    if (!state.currentOrganization) throw new Error('No organization selected');

    try {
      dispatch({ type: 'SET_ERROR', payload: null });

      await organizationService.removeMember(state.currentOrganization.id, memberWallet);
      dispatch({ type: 'REMOVE_MEMBER', payload: memberWallet });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!state.currentMember) return false;
    return organizationService.hasPermission(state.currentMember, resource, action);
  };

  const canManageMembers = (): boolean => {
    return hasPermission('members', 'manage') || hasPermission('members', 'write');
  };

  const canUploadContent = (): boolean => {
    return hasPermission('content', 'write');
  };

  const getRemainingQuota = (): number => {
    if (!state.currentMember) return 0;
    return Math.max(0, state.currentMember.uploadQuota - state.currentMember.quotaUsed);
  };

  const refreshOrganizations = async () => {
    await loadUserOrganizations();
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  const contextValue: OrganizationContextType = {
    // State
    ...state,

    // Actions
    switchOrganization,
    createOrganization,
    updateOrganization,
    inviteMember,
    updateMember,
    removeMember,

    // Utility functions
    hasPermission,
    canManageMembers,
    canUploadContent,
    getRemainingQuota,

    // State management
    refreshOrganizations,
    clearError,
  };

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};