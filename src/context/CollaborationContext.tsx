import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Workspace,
  Project,
  Notification,
  ActivityItem,
  UserRole,
  Permission
} from '../types/collaboration';
import { CollaborationApiClient } from '../services/collaborationApi';
import { ImportApiClient } from '../services/importApi';
import { DatabaseApiClient } from '../services/databaseApi';
import { CleaningApiClient } from '../services/cleaningApi';
import { DashboardService } from '../services/dashboardService';
import { PipelineStorage } from '../utils/pipelineStorage';

export const syncAllWorkspaceClients = (workspaceId: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('datapilot_active_workspace_id', workspaceId);
  }
  CollaborationApiClient.setWorkspaceId(workspaceId);
  ImportApiClient.setWorkspaceId(workspaceId);
  DatabaseApiClient.setWorkspaceId(workspaceId);
  CleaningApiClient.setWorkspaceId(workspaceId);
  DashboardService.setWorkspaceId(workspaceId);
  PipelineStorage.setWorkspaceId(workspaceId);
};

export const syncAllProjectClients = (projectId: string | null) => {
  if (typeof localStorage !== 'undefined') {
    if (projectId) {
      localStorage.setItem('datapilot_active_project_id', projectId);
    } else {
      localStorage.removeItem('datapilot_active_project_id');
    }
  }
  CollaborationApiClient.setProjectId(projectId);
  ImportApiClient.setProjectId(projectId);
  DatabaseApiClient.setProjectId(projectId);
  CleaningApiClient.setProjectId(projectId);
  DashboardService.setProjectId(projectId);
  PipelineStorage.setProjectId(projectId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datapilot:project-changed', { detail: { projectId } }));
  }
};

interface CollaborationContextType {
  user: User | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  activeProject: Project | null;
  activeProjectId: string | null;
  projects: Project[];
  role: UserRole;
  permissions: Permission[];
  unreadNotificationsCount: number;
  notifications: Notification[];
  activities: ActivityItem[];
  isLoadingAuth: boolean;
  emailVerificationRequired: boolean;
  can: (permission: Permission) => boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  switchProject: (projectId: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<{ success: boolean; error?: string; user?: User; devVerificationToken?: string; devVerificationUrl?: string; emailVerificationRequired?: boolean }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string; message?: string; user?: User; expired?: boolean }>;
  resendVerification: (email?: string) => Promise<{ success: boolean; error?: string; message?: string; devVerificationToken?: string; devVerificationUrl?: string; alreadyVerified?: boolean }>;
  updateProfile: (profile: { name: string; jobTitle?: string; email?: string; avatar?: string }) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  switchDemoUser: (role: 'admin' | 'analyst' | 'viewer') => Promise<void>;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState<UserRole>('OWNER');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState<boolean>(false);

  // Initialize Auth and Workspace State
  const initAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      if (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_logged_out') === 'true') {
        setUser(null);
        setIsLoadingAuth(false);
        return;
      }
      const res = await CollaborationApiClient.getCurrentAuth();
      if (res.success && (res as any).user) {
        const authData: any = res;
        setUser(authData.user);
        setEmailVerificationRequired(Boolean(authData.emailVerificationRequired));
        setRole(authData.memberRole || authData.user?.role || 'OWNER');
        setPermissions(authData.permissions || []);

        const wsRes = await CollaborationApiClient.listWorkspaces();
        if (wsRes.success && wsRes.workspaces) {
          setWorkspaces(wsRes.workspaces);
          const currentWs = wsRes.workspaces.find((w: any) => w.id === authData.workspaceId) || wsRes.workspaces[0];
          if (currentWs) {
            setActiveWorkspace(currentWs);
            syncAllWorkspaceClients(currentWs.id);
          }
        }
      } else {
        setUser(null);
        setEmailVerificationRequired(false);
      }
    } catch (err) {
      console.error('Failed to init auth context', err);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listWorkspaces();
      if (res.success && res.workspaces) {
        setWorkspaces(res.workspaces);
        if (activeWorkspace) {
          const updated = res.workspaces.find(w => w.id === activeWorkspace.id);
          if (updated) setActiveWorkspace(updated);
        }
      }
    } catch (err) {
      console.error('Failed to refresh workspaces', err);
    }
  }, [activeWorkspace]);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listProjects();
      if (res.success && res.projects) {
        setProjects(res.projects);
        const savedProjectId = typeof localStorage !== 'undefined' ? localStorage.getItem('datapilot_active_project_id') : null;
        if (savedProjectId) {
          const match = res.projects.find(p => p.id === savedProjectId);
          if (match) {
            setActiveProject(match);
            syncAllProjectClients(match.id);
          } else {
            setActiveProject(null);
            syncAllProjectClients(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to refresh projects', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        CollaborationApiClient.listNotifications(),
        CollaborationApiClient.getUnreadCount()
      ]);
      if (listRes.success) setNotifications(listRes.notifications);
      if (countRes.success) setUnreadNotificationsCount(countRes.count);
    } catch (err) {
      console.error('Failed to refresh notifications', err);
    }
  }, []);

  const refreshActivities = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listActivity(30);
      if (res.success) setActivities(res.activities);
    } catch (err) {
      console.error('Failed to refresh activities', err);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (activeWorkspace) {
      refreshProjects();
      refreshNotifications();
      refreshActivities();
    }
  }, [activeWorkspace, refreshProjects, refreshNotifications, refreshActivities]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setActiveWorkspace(ws);
      setActiveProject(null);
      syncAllWorkspaceClients(ws.id);
      syncAllProjectClients(null);
      // Re-fetch auth context for this workspace to get member role and permissions
      const authRes = await CollaborationApiClient.getCurrentAuth();
      if (authRes.success) {
        const authData: any = authRes;
        setRole(authData.memberRole || 'ANALYST');
        setPermissions(authData.permissions || []);
      }
      await refreshProjects();
      await refreshNotifications();
      await refreshActivities();
    }
  }, [workspaces, refreshProjects, refreshNotifications, refreshActivities]);

  const switchProject = useCallback((projectId: string | null) => {
    if (!projectId) {
      setActiveProject(null);
      syncAllProjectClients(null);
    } else {
      const found = projects.find(p => p.id === projectId) || ({ id: projectId, name: projectId, workspaceId: activeWorkspace?.id || '' } as Project);
      setActiveProject(found);
      syncAllProjectClients(found.id);
    }
    refreshActivities();
  }, [projects, activeWorkspace, refreshActivities]);

  const can = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  const login = async (email: string, password: string) => {
    const res = await CollaborationApiClient.login(email, password);
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('datapilot_logged_out');
      }
      setUser(res.user);
      setRole(res.memberRole || res.user?.role || 'ANALYST');
      setPermissions(res.permissions || []);
      await initAuth();
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = async (name: string, email: string, password: string, regRole?: UserRole) => {
    const res = await CollaborationApiClient.register(name, email, password, regRole);
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('datapilot_logged_out');
      }
      setUser(res.user);
      setRole(res.memberRole || regRole || 'ANALYST');
      setPermissions(res.permissions || []);
      await initAuth();
      return {
        success: true,
        user: res.user,
        devVerificationToken: res.devVerificationToken,
        devVerificationUrl: res.devVerificationUrl,
        emailVerificationRequired: res.emailVerificationRequired
      };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const verifyEmail = async (token: string) => {
    try {
      const res = await CollaborationApiClient.verifyEmail(token);
      if (res.success) {
        if (res.user) {
          setUser(res.user);
        }
        await initAuth();
      }
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Email verification failed.' };
    }
  };

  const resendVerification = async (email?: string) => {
    try {
      return await CollaborationApiClient.resendVerification(email);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend verification.' };
    }
  };

  const logout = async () => {
    try {
      await CollaborationApiClient.logout();
    } catch (err) {
      console.error('Logout error', err);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('datapilot_logged_out', 'true');
    }
    CollaborationApiClient.setSessionToken(null);
    CollaborationApiClient.setDemoRole(null);
    setUser(null);
    setActiveWorkspace(null);
    setWorkspaces([]);
    setActiveProject(null);
    setProjects([]);
    setRole('VIEWER');
    setPermissions([]);
    setNotifications([]);
    setUnreadNotificationsCount(0);
    setActivities([]);
  };

  const updateProfile = async (profileData: { name: string; jobTitle?: string; email?: string; avatar?: string }): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const res = await CollaborationApiClient.updateProfile(profileData);
      if (res && res.success && res.user) {
        setUser(prev => ({
          ...res.user,
          role: role || res.user.role
        }));
        await refreshWorkspaces();
        await refreshActivities();
        return { success: true, user: res.user };
      }
      return { success: false, error: res.error || 'Failed to update profile' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  // Demo user fast-switcher for testing roles and collaboration flows
  const switchDemoUser = async (demoRole: 'admin' | 'analyst' | 'viewer' | string) => {
    try {
      setIsLoadingAuth(true);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('datapilot_logged_out');
      }
      const normalizedRole: UserRole = demoRole.toLowerCase() === 'analyst' ? 'ANALYST' : demoRole.toLowerCase() === 'viewer' ? 'VIEWER' : 'OWNER';
      CollaborationApiClient.setDemoRole(normalizedRole);

      const res = await CollaborationApiClient.demoSwitch(demoRole);
      if (res && res.success) {
        setUser(res.user);
        setRole(res.memberRole || normalizedRole);
        setPermissions(res.permissions || []);
        if (res.session?.token) {
          CollaborationApiClient.setSessionToken(res.session.token);
        }
      } else {
        const fallbackUsers: Record<string, User> = {
          OWNER: {
            id: 'usr_admin',
            name: user?.name || 'Alex Rivera',
            email: user?.email || 'admin@datapilot.io',
            jobTitle: user?.jobTitle || 'Lead Data Architect',
            status: 'active',
            role: 'OWNER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          ANALYST: {
            id: 'usr_analyst',
            name: user?.name || 'Sarah Chen',
            email: user?.email || 'analyst@datapilot.io',
            jobTitle: user?.jobTitle || 'Senior Analyst',
            status: 'active',
            role: 'ANALYST',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          VIEWER: {
            id: 'usr_viewer',
            name: user?.name || 'Marcus Brody',
            email: user?.email || 'viewer@datapilot.io',
            jobTitle: user?.jobTitle || 'Stakeholder',
            status: 'active',
            role: 'VIEWER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        const fallbackPermissions: Record<string, Permission[]> = {
          OWNER: [
            'workspace.read', 'workspace.update', 'workspace.delete', 'member.read', 'member.invite', 'member.update', 'member.remove',
            'dataset.read', 'dataset.create', 'dataset.update', 'dataset.delete',
            'query.read', 'query.create', 'query.update', 'query.delete',
            'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
            'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
            'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
            'report.read', 'report.create', 'report.export', 'audit.read'
          ],
          ANALYST: [
            'workspace.read', 'member.read',
            'dataset.read', 'dataset.create', 'dataset.update',
            'query.read', 'query.create', 'query.update', 'query.delete',
            'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
            'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
            'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
            'report.read', 'report.create', 'report.export'
          ],
          VIEWER: [
            'workspace.read', 'member.read',
            'dataset.read', 'query.read', 'pipeline.read', 'visualization.read', 'dashboard.read',
            'report.read', 'report.export'
          ]
        };
        setUser(fallbackUsers[normalizedRole] || fallbackUsers.OWNER);
        setRole(normalizedRole);
        setPermissions(fallbackPermissions[normalizedRole] || fallbackPermissions.VIEWER);
      }
      await refreshProjects();
      await refreshNotifications();
      await refreshActivities();
    } catch (err) {
      console.error('Failed to switch demo persona', err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const activeProjectId = activeProject?.id || null;

  const value = useMemo(() => ({
    user,
    activeWorkspace,
    workspaces,
    activeProject,
    activeProjectId,
    projects,
    role,
    permissions,
    unreadNotificationsCount,
    notifications,
    activities,
    isLoadingAuth,
    emailVerificationRequired,
    can,
    switchWorkspace,
    switchProject,
    refreshWorkspaces,
    refreshProjects,
    refreshNotifications,
    refreshActivities,
    login,
    register,
    verifyEmail,
    resendVerification,
    updateProfile,
    logout,
    switchDemoUser
  }), [
    user,
    activeWorkspace,
    workspaces,
    activeProject,
    activeProjectId,
    projects,
    role,
    permissions,
    unreadNotificationsCount,
    notifications,
    activities,
    isLoadingAuth,
    emailVerificationRequired,
    can,
    switchWorkspace,
    switchProject,
    refreshWorkspaces,
    refreshProjects,
    refreshNotifications,
    refreshActivities
  ]);

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export const useCollaboration = (): CollaborationContextType => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};
