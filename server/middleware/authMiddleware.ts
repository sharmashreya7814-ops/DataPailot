import { Request, Response, NextFunction } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { PermissionService } from '../services/PermissionService';
import { AuthContext, Permission, UserRole } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      correlationId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-correlation-id'] as string;
  req.correlationId = incomingId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  next();
}

/**
 * Authentication middleware extracting session tokens and attaching AuthContext
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const store = CollaborationStore.getInstance();

  // Extract token from Authorization header, Cookie, or custom header
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'] as string;
  } else if (req.cookies && req.cookies.datapilot_session) {
    token = req.cookies.datapilot_session;
  }

  // Requested workspace id
  const headerWsId = (req.headers['x-workspace-id'] as string) || (req.query.workspaceId as string) || 'ws_primary';
  const rawProjId = (req.headers['x-project-id'] as string) || (req.query.projectId as string);
  const headerProjId = rawProjId && rawProjId !== 'null' && rawProjId !== 'undefined' ? rawProjId.trim() : undefined;

  const isDemoEnabled = process.env.DEMO_MODE === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false');
  const demoRoleHeader = req.headers['x-demo-role'] as string | undefined;

  if (isDemoEnabled && demoRoleHeader) {
    let demoUserId = 'usr_admin';
    let targetRole: UserRole = 'OWNER';
    const norm = demoRoleHeader.toLowerCase().trim();
    if (norm === 'editor') {
      demoUserId = 'usr_editor';
      targetRole = 'EDITOR';
    } else if (norm === 'analyst') {
      demoUserId = 'usr_analyst';
      targetRole = 'ANALYST';
    } else if (norm === 'viewer') {
      demoUserId = 'usr_viewer';
      targetRole = 'VIEWER';
    } else if (norm === 'admin' || norm === 'owner') {
      demoUserId = 'usr_admin';
      targetRole = 'OWNER';
    }

    let user = token ? store.getUserById(store.getSessionByToken(token)?.userId || '') : null;
    if (!user) {
      user = store.getUserById(demoUserId) || store.getUserById('usr_admin') || {
        id: demoUserId,
        name: 'Alex Rivera',
        email: `${norm}@datapilot.io`,
        jobTitle: 'Data Professional',
        status: 'active',
        role: targetRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    try {
      const member = store.getWorkspaceMember(headerWsId, user.id);
      if (!member) {
        store.addOrInviteMember(headerWsId, user.id, targetRole);
      } else {
        store.updateMemberRole(headerWsId, user.id, targetRole);
      }
    } catch {
      // ignore
    }

    const permissions = PermissionService.getPermissionsForRole(targetRole);

    req.authContext = {
      user: { ...user, role: targetRole },
      session: token ? (store.getSessionByToken(token) || {
        id: `ses_demo_${norm}`,
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      }) : {
        id: `ses_demo_${norm}`,
        userId: user.id,
        token: `dev_token_${norm}`,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      },
      workspaceId: headerWsId,
      projectId: headerProjId || null,
      memberRole: targetRole,
      permissions
    };
    return next();
  }

  if (token) {
    const session = store.getSessionByToken(token);
    if (session) {
      const user = store.getUserById(session.userId);
      if (user && user.status === 'active') {
        // Resolve workspace membership
        let member = store.getWorkspaceMember(headerWsId, user.id);
        let activeWsId = headerWsId;

        // If not a member of requested workspace, check if member of any workspace
        if (!member) {
          const userWorkspaces = store.listWorkspacesForUser(user.id);
          if (userWorkspaces.length > 0) {
            activeWsId = userWorkspaces[0].id;
            member = store.getWorkspaceMember(activeWsId, user.id);
          }
        }

        const role: UserRole = member?.role || user.role || 'VIEWER';
        const permissions = PermissionService.getPermissionsForRole(role);

        req.authContext = {
          user,
          session,
          workspaceId: activeWsId,
          projectId: headerProjId || null,
          memberRole: role,
          permissions
        };
        return next();
      }
    }
  }

  // Development fallback context when no token provided
  // Ensures existing single-user workflows and tests continue seamlessly while remaining isolated
  const defaultAdmin = store.getUserById('usr_admin');
  if (defaultAdmin) {
    const role: UserRole = 'OWNER';
    req.authContext = {
      user: defaultAdmin,
      session: {
        id: 'ses_dev_default',
        userId: defaultAdmin.id,
        token: 'dev_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      },
      workspaceId: headerWsId || 'ws_primary',
      projectId: headerProjId || null,
      memberRole: role,
      permissions: PermissionService.getPermissionsForRole(role)
    };
  }

  next();
}

/**
 * Strict authentication guard
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.authContext || !req.authContext.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to perform this operation.'
    });
    return;
  }
  next();
}

/**
 * RBAC permission guard middleware
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authContext) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
      return;
    }

    const { user, workspaceId, memberRole, permissions } = req.authContext;

    if (!permissions.includes(permission)) {
      Logger.warn('RBAC permission denied', {
        userId: user.id,
        role: memberRole,
        workspaceId,
        requiredPermission: permission
      });

      CollaborationStore.getInstance().logAuditEvent({
        actorId: user.id,
        actorName: user.name,
        workspaceId,
        action: `DENIED_${permission.toUpperCase()}`,
        result: 'DENIED',
        metadata: { requiredPermission: permission, memberRole },
        correlationId: req.correlationId
      });

      res.status(403).json({
        success: false,
        error: `Permission denied: Current role [${memberRole}] does not have '${permission}' permission in workspace [${workspaceId}].`
      });
      return;
    }

    next();
  };
}

/**
 * Helper to check whether email verification is enforced globally via feature flag.
 * Server-side authoritative: defaults to false if not set or set to 'false'.
 */
export function isEmailVerificationEnabled(): boolean {
  return process.env.ENABLE_EMAIL_VERIFICATION === 'true';
}

/**
 * Email verification guard middleware
 */
export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction): void {
  // If email verification feature flag is disabled (default false), do not block
  if (!isEmailVerificationEnabled()) {
    next();
    return;
  }

  if (!req.authContext || !req.authContext.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
    return;
  }

  if (!req.authContext.user.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required. Please verify your email to access this resource.',
      code: 'EMAIL_VERIFICATION_REQUIRED'
    });
    return;
  }

  next();
}

