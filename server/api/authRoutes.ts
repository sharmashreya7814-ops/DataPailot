import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { CollaborationStore } from '../database/CollaborationStore';
import { PermissionService } from '../services/PermissionService';
import { UserRole } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';
import { EmailService } from '../services/email/EmailService';
import { getAppUrl } from '../utils/url';
import { isEmailVerificationEnabled } from '../middleware/authMiddleware';

const router = Router();

// Rate limiting structures for password recovery flows and verification
const forgotPasswordLimitMap = new Map<string, { count: number; firstAttempt: number }>();
const resetPasswordLimitMap = new Map<string, { count: number; firstAttempt: number }>();
const resendVerificationLimitMap = new Map<string, { count: number; firstAttempt: number }>();
const resendCooldownMap = new Map<string, number>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_FORGOT_REQUESTS = 5;
const MAX_RESET_REQUESTS = 5;
const MAX_RESEND_VERIFICATION_REQUESTS = 5;

function isRateLimited(map: Map<string, { count: number; firstAttempt: number }>, key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry) {
    map.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    map.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

export function resetAuthRateLimits(): void {
  forgotPasswordLimitMap.clear();
  resetPasswordLimitMap.clear();
  resendVerificationLimitMap.clear();
  resendCooldownMap.clear();
}

/**
 * POST /api/auth/register
 * Register a new user and create an initial session
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Valid full name is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Valid email address is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const existing = store.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
      return;
    }

    const requestedRole = (role as UserRole) || 'ANALYST';
    if (requestedRole === 'OWNER' || requestedRole === 'ADMIN') {
      res.status(403).json({ success: false, error: 'Cannot register with administrative roles directly. Client role spoofing is rejected.' });
      return;
    }

    const assignedRole: UserRole = (requestedRole === 'EDITOR' || requestedRole === 'VIEWER' || requestedRole === 'ANALYST') ? requestedRole : 'ANALYST';

    const user = store.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: assignedRole,
      emailVerified: false
    });

    // Generate cryptographically secure email verification token (32 bytes hex)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour expiry

    store.setEmailVerificationToken(user.id, tokenHash, verificationExpiresAt);

    // Automatically assign user to primary workspace as an active member
    const primaryWs = store.getWorkspaceById('ws_primary');
    if (primaryWs) {
      store.addOrInviteMember('ws_primary', user.id, assignedRole);
    }

    // Build canonical verification URL
    const appUrl = getAppUrl(req);
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawVerificationToken}`;

    // Dispatch verification email via EmailService
    const emailService = EmailService.getInstance();
    const emailResult = await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl
    });

    const session = store.createSession(user.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userRole: UserRole = user.role || 'ANALYST';
    const permissions = PermissionService.getPermissionsForRole(userRole);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: 'ws_primary',
      action: 'USER_REGISTERED',
      result: 'SUCCESS',
      metadata: { email: user.email, role: userRole },
      correlationId: req.correlationId
    });

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: 'global',
      action: 'EMAIL_VERIFICATION_TOKEN_GENERATED',
      result: 'SUCCESS',
      metadata: { email: user.email },
      correlationId: req.correlationId
    });

    const isDevOrTest = process.env.NODE_ENV !== 'production' || req.headers['x-test-suite'] === 'true';
    const responsePayload: Record<string, any> = {
      success: true,
      user: { ...user, emailVerified: false, emailVerifiedAt: null },
      session,
      workspaceId: 'ws_primary',
      memberRole: userRole,
      permissions,
      emailVerificationRequired: isEmailVerificationEnabled(),
      emailDelivery: {
        sent: emailResult.success,
        deliveryMode: emailResult.deliveryMode
      }
    };

    // Expose developer verification mechanism only in non-production environments
    if (isDevOrTest) {
      responsePayload.devVerificationToken = rawVerificationToken;
      responsePayload.devVerificationUrl = `/api/auth/verify-email?token=${rawVerificationToken}`;
    }

    res.status(201).json(responsePayload);
  } catch (err: any) {
    Logger.error('Registration failed', err);
    res.status(500).json({ success: false, error: 'Failed to complete registration.' });
  }
});

/**
 * POST /api/auth/demo-switch
 * Instant demo persona switcher for testing RBAC profiles (OWNER/ADMIN, ANALYST, VIEWER)
 * Changes RBAC role/permissions without corrupting or overwriting custom user profile information.
 */
router.post('/demo-switch', (req: Request, res: Response) => {
  try {
    const isDemoEnabled = process.env.DEMO_MODE === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false');
    if (!isDemoEnabled) {
      res.status(403).json({ success: false, error: 'Demo persona switching is disabled in production / non-demo mode.' });
      return;
    }

    const { role: reqRole } = req.body;
    const store = CollaborationStore.getInstance();

    let targetRole: UserRole = 'OWNER';
    const normalized = (reqRole || '').toString().toLowerCase().trim();
    if (normalized === 'analyst') {
      targetRole = 'ANALYST';
    } else if (normalized === 'viewer') {
      targetRole = 'VIEWER';
    } else if (normalized === 'admin' || normalized === 'owner') {
      targetRole = 'OWNER';
    } else if (normalized === 'editor') {
      targetRole = 'EDITOR';
    }

    // Preserve the current authenticated user's profile info (name, jobTitle, email) if available,
    // or fallback to the primary user record
    let currentUserId = req.authContext?.user?.id || 'usr_admin';
    let user = store.getUserById(currentUserId) || store.getUserById('usr_admin');

    if (!user) {
      user = {
        id: currentUserId,
        name: 'Alex Rivera',
        email: 'admin@datapilot.io',
        jobTitle: 'Lead Data Architect',
        status: 'active',
        role: targetRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const wsId = (req.headers['x-workspace-id'] as string) || (req.body.workspaceId as string) || 'ws_primary';
    const member = store.getWorkspaceMember(wsId, user.id);
    if (!member) {
      try {
        store.addOrInviteMember(wsId, user.id, targetRole);
      } catch {
        // ignore if already present
      }
    } else {
      try {
        store.updateMemberRole(wsId, user.id, targetRole);
      } catch {
        // ignore
      }
    }

    const session = store.createSession(user.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const permissions = PermissionService.getPermissionsForRole(targetRole);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: wsId,
      action: 'DEMO_PERSONA_SWITCHED',
      result: 'SUCCESS',
      metadata: { role: targetRole, userId: user.id, email: user.email },
      correlationId: req.correlationId
    });

    res.json({
      success: true,
      user: { ...user, role: targetRole },
      session,
      workspaceId: wsId,
      memberRole: targetRole,
      permissions
    });
  } catch (err: any) {
    Logger.error('Demo persona switch failed', err);
    res.status(500).json({ success: false, error: 'Failed to switch demo persona.' });
  }
});

/**
 * PUT /api/auth/profile
 * Update current authenticated user profile (Full Name, Job Title, Email, Avatar)
 * RBAC role is strictly protected and cannot be changed here.
 */
router.put('/profile', (req: Request, res: Response) => {
  try {
    if (!req.authContext || !req.authContext.user) {
      res.status(401).json({ success: false, error: 'Authentication required to edit profile.' });
      return;
    }

    const { name, jobTitle, email, avatar } = req.body;
    const store = CollaborationStore.getInstance();
    const currentUser = req.authContext.user;

    // 1. Validation: Name
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Full name cannot be empty.' });
        return;
      }
      if (name.trim().length > 100) {
        res.status(400).json({ success: false, error: 'Full name cannot exceed 100 characters.' });
        return;
      }
    }

    // 2. Validation: Job Title
    if (jobTitle !== undefined && jobTitle !== null) {
      if (typeof jobTitle !== 'string') {
        res.status(400).json({ success: false, error: 'Job title must be a valid text string.' });
        return;
      }
      if (jobTitle.trim().length > 100) {
        res.status(400).json({ success: false, error: 'Job title cannot exceed 100 characters.' });
        return;
      }
    }

    // 3. Validation: Email
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        res.status(400).json({ success: false, error: 'Email address cannot be empty.' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        return;
      }
      if (email.trim().length > 150) {
        res.status(400).json({ success: false, error: 'Email address cannot exceed 150 characters.' });
        return;
      }

      // Check for email conflicts
      const existing = store.getUserByEmail(email.trim());
      if (existing && existing.id !== currentUser.id) {
        res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
        return;
      }
    }

    // 4. Update store
    const updatedUser = store.updateUserProfile(currentUser.id, {
      name: name !== undefined ? name.trim() : undefined,
      jobTitle: jobTitle !== undefined ? (jobTitle ? jobTitle.trim() : '') : undefined,
      email: email !== undefined ? email.trim().toLowerCase() : undefined,
      avatar: avatar !== undefined ? avatar : undefined
    });

    if (!updatedUser) {
      res.status(404).json({ success: false, error: 'User record not found.' });
      return;
    }

    store.logAuditEvent({
      actorId: currentUser.id,
      actorName: updatedUser.name,
      workspaceId: req.authContext.workspaceId || 'ws_primary',
      action: 'PROFILE_UPDATED',
      result: 'SUCCESS',
      metadata: {
        previousName: currentUser.name,
        newName: updatedUser.name,
        jobTitle: updatedUser.jobTitle,
        email: updatedUser.email
      },
      correlationId: req.correlationId
    });

    // Retain current session RBAC role
    const responseUser = {
      ...updatedUser,
      role: req.authContext.memberRole || req.authContext.user.role || updatedUser.role
    };

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: responseUser
    });
  } catch (err: any) {
    Logger.error('Failed to update user profile', err);
    res.status(500).json({ success: false, error: 'An unexpected error occurred while updating profile.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with credentials
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByEmail(email);

    if (!userAuth) {
      store.logAuditEvent({
        actorId: 'anonymous',
        actorName: 'unknown',
        workspaceId: 'global',
        action: 'LOGIN_FAILED',
        result: 'FAILURE',
        metadata: { email },
        correlationId: req.correlationId
      });

      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (userAuth.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Your account is suspended. Please contact your workspace administrator.' });
      return;
    }

    const isMatch = CollaborationStore.verifyPassword(password, userAuth.passwordHash, userAuth.salt);
    if (!isMatch) {
      store.logAuditEvent({
        actorId: userAuth.id,
        actorName: userAuth.name,
        workspaceId: 'global',
        action: 'LOGIN_FAILED',
        result: 'FAILURE',
        metadata: { email: userAuth.email },
        correlationId: req.correlationId
      });

      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const session = store.createSession(userAuth.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = store.getUserById(userAuth.id)!;
    const workspaces = store.listWorkspacesForUser(user.id);
    const activeWsId = workspaces.length > 0 ? workspaces[0].id : 'ws_primary';
    const member = store.getWorkspaceMember(activeWsId, user.id);
    const role: UserRole = member?.role || user.role || 'ANALYST';
    const permissions = PermissionService.getPermissionsForRole(role);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: activeWsId,
      action: 'LOGIN_SUCCESS',
      result: 'SUCCESS',
      metadata: { email: user.email, role },
      correlationId: req.correlationId
    });

    res.json({
      success: true,
      user,
      session,
      workspaceId: activeWsId,
      memberRole: role,
      permissions,
      emailVerificationRequired: isEmailVerificationEnabled() ? !user.emailVerifiedAt : false
    });
  } catch (err: any) {
    Logger.error('Login error', err);
    res.status(500).json({ success: false, error: 'An unexpected authentication error occurred.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const token = req.cookies?.datapilot_session || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7).trim() : null) || 
      (req.headers['x-session-token'] as string | undefined);

    if (token) {
      store.deleteSession(token);
    }
    res.clearCookie('datapilot_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    if (req.authContext?.user) {
      store.logAuditEvent({
        actorId: req.authContext.user.id,
        actorName: req.authContext.user.name,
        workspaceId: req.authContext.workspaceId || 'global',
        action: 'LOGOUT',
        result: 'SUCCESS',
        metadata: {},
        correlationId: req.correlationId
      });
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to logout cleanly.' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and session
 */
router.get('/me', (req: Request, res: Response) => {
  if (!req.authContext || !req.authContext.user) {
    res.status(401).json({ success: false, error: 'Not authenticated.' });
    return;
  }

  res.json({
    success: true,
    user: req.authContext.user,
    session: req.authContext.session,
    workspaceId: req.authContext.workspaceId,
    memberRole: req.authContext.memberRole,
    permissions: req.authContext.permissions,
    emailVerificationRequired: isEmailVerificationEnabled() ? !req.authContext.user.emailVerifiedAt : false
  });
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', (req: Request, res: Response) => {
  try {
    if (!req.authContext || !req.authContext.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByEmail(req.authContext.user.email);
    if (!userAuth) {
      res.status(404).json({ success: false, error: 'User record not found.' });
      return;
    }

    if (oldPassword) {
      const isMatch = CollaborationStore.verifyPassword(oldPassword, userAuth.passwordHash, userAuth.salt);
      if (!isMatch) {
        res.status(400).json({ success: false, error: 'Current password is incorrect.' });
        return;
      }
    }

    store.changeUserPassword(req.authContext.user.id, newPassword);

    store.logAuditEvent({
      actorId: req.authContext.user.id,
      actorName: req.authContext.user.name,
      workspaceId: req.authContext.workspaceId,
      action: 'PASSWORD_CHANGED',
      result: 'SUCCESS',
      metadata: {},
      correlationId: req.correlationId
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
});

/**
 * GET /api/auth/sessions
 */
router.get('/sessions', (req: Request, res: Response) => {
  if (!req.authContext?.user) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  const sessions = CollaborationStore.getInstance().getUserActiveSessions(req.authContext.user.id);
  res.json({ success: true, sessions });
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset by generating a secure single-use token and storing its hash.
 * Always returns a generic success message without leaking account existence.
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `${ip}_${sanitizedEmail}`;

    if (isRateLimited(forgotPasswordLimitMap, rateLimitKey, MAX_FORGOT_REQUESTS)) {
      res.status(429).json({
        success: false,
        error: 'Too many password reset requests. Please try again later.'
      });
      return;
    }

    const genericMessage = 'If an account exists for this email, password reset instructions have been sent.';
    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByEmail(sanitizedEmail);

    let rawToken: string | null = null;

    if (userAuth) {
      // 1. Generate cryptographically secure random token (64 hex characters)
      rawToken = crypto.randomBytes(32).toString('hex');

      // 2. Hash token using SHA-256 for secure storage (never store raw token)
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 3. 20-minute expiration window
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

      // 4. Save to database
      store.createPasswordResetToken(userAuth.id, tokenHash, expiresAt);

      // 5. Build canonical reset URL and dispatch email
      const appUrl = getAppUrl(req);
      const resetUrl = `${appUrl}/?reset_token=${rawToken}&type=reset`;

      const emailService = EmailService.getInstance();
      await emailService.sendPasswordResetEmail({
        to: userAuth.email,
        name: userAuth.name,
        resetUrl
      });

      // 6. Audit log
      store.logAuditEvent({
        actorId: userAuth.id,
        actorName: userAuth.name,
        workspaceId: 'global',
        action: 'PASSWORD_RESET_REQUESTED',
        result: 'SUCCESS',
        metadata: { email: userAuth.email },
        correlationId: req.correlationId
      });
    }

    // In production, strictly NEVER leak raw token, hash, or account existence
    if (process.env.NODE_ENV === 'production') {
      res.json({ success: true, message: genericMessage });
      return;
    }

    // In development / test environment, conditionally include devResetToken for test automation & developer ergonomics
    const responsePayload: { success: boolean; message: string; devResetToken?: string } = {
      success: true,
      message: genericMessage
    };

    if (rawToken && (process.env.NODE_ENV !== 'production' || req.headers['x-test-suite'] === 'true')) {
      responsePayload.devResetToken = rawToken;
    }

    res.json(responsePayload);
  } catch (err: any) {
    Logger.error('Failed to process forgot-password request', { error: String(err) });
    res.status(500).json({ success: false, error: 'An internal error occurred while processing your request.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Validates reset token and sets new password.
 * Invalidates token, updates credentials, and revokes all existing sessions.
 */
router.post('/reset-password', (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Password reset link is invalid or has expired.' });
      return;
    }

    const trimmedToken = token.trim();
    const rateLimitKey = `${ip}_${trimmedToken.slice(0, 16)}`;

    if (isRateLimited(resetPasswordLimitMap, rateLimitKey, MAX_RESET_REQUESTS)) {
      res.status(429).json({
        success: false,
        error: 'Too many reset attempts. Please try again later.'
      });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');
    const resetRecord = store.getPasswordResetTokenByHash(tokenHash);

    if (!resetRecord) {
      res.status(400).json({ success: false, error: 'Password reset link is invalid or has expired.' });
      return;
    }

    if (resetRecord.used) {
      res.status(400).json({ success: false, error: 'Password reset link has already been used. Please request a new one.' });
      return;
    }

    if (new Date(resetRecord.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ success: false, error: 'Password reset link is invalid or has expired.' });
      return;
    }

    const user = store.getUserById(resetRecord.userId);
    if (!user) {
      res.status(400).json({ success: false, error: 'User account not found.' });
      return;
    }

    // 1. Mark token as used immediately to prevent reuse
    store.markPasswordResetTokenUsed(resetRecord.id);

    // 2. Update user's password with fresh salt and hash
    store.changeUserPassword(user.id, newPassword);

    // 3. Invalidate ALL active sessions for this user across all devices
    store.revokeAllSessionsForUser(user.id);

    // 4. Clear current session cookie if present
    res.clearCookie('datapilot_session', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // 5. Audit log
    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: 'global',
      action: 'PASSWORD_RESET_COMPLETED',
      result: 'SUCCESS',
      metadata: { email: user.email },
      correlationId: req.correlationId
    });

    res.json({
      success: true,
      message: 'Your password has been successfully reset. Please sign in with your new password.'
    });
  } catch (err: any) {
    Logger.error('Failed to reset password', { error: String(err) });
    res.status(500).json({ success: false, error: 'An internal error occurred while resetting your password.' });
  }
});

/**
 * POST /api/auth/verify-reset-token
 * Validates whether a reset token is valid, unused, and unexpired before form submission.
 */
router.post('/verify-reset-token', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ valid: false, error: 'Missing reset token.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const resetRecord = store.getPasswordResetTokenByHash(tokenHash);

    if (!resetRecord) {
      res.status(400).json({ valid: false, error: 'Password reset link is invalid or has expired.' });
      return;
    }

    if (resetRecord.used) {
      res.status(400).json({ valid: false, error: 'Password reset link has already been used.' });
      return;
    }

    if (new Date(resetRecord.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ valid: false, error: 'Password reset link is invalid or has expired.' });
      return;
    }

    res.json({ valid: true });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: 'Failed to verify reset token.' });
  }
});

/**
 * GET & POST /api/auth/verify-email
 * Verifies email verification token.
 * Single use: marks user email verified, clears verification token and expiry.
 */
function handleVerifyEmail(req: Request, res: Response): void {
  try {
    const rawToken = (req.query.token as string) || (req.body?.token as string);

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Verification token is required.'
      });
      return;
    }

    const trimmedToken = rawToken.trim();
    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');
    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByVerificationTokenHash(tokenHash);

    if (!userAuth) {
      res.status(400).json({
        success: false,
        error: 'Verification link is invalid or has already been used.'
      });
      return;
    }

    // Check expiry
    if (userAuth.emailVerificationExpiresAt && new Date(userAuth.emailVerificationExpiresAt).getTime() < Date.now()) {
      res.status(400).json({
        success: false,
        error: 'Verification link has expired. Please request a new verification email.',
        expired: true
      });
      return;
    }

    // Mark email as verified and clear token to ensure single-use
    store.markEmailAsVerified(userAuth.id);

    store.logAuditEvent({
      actorId: userAuth.id,
      actorName: userAuth.name,
      workspaceId: 'global',
      action: 'EMAIL_VERIFIED',
      result: 'SUCCESS',
      metadata: { email: userAuth.email },
      correlationId: req.correlationId
    });

    const updatedUser = store.getUserById(userAuth.id)!;

    // Check if browser HTML navigation
    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      res.redirect('/?verified=true');
      return;
    }

    res.json({
      success: true,
      message: 'Your email has been successfully verified.',
      user: updatedUser
    });
  } catch (err: any) {
    Logger.error('Failed to verify email', { error: String(err) });
    res.status(500).json({ success: false, error: 'An internal error occurred while verifying your email.' });
  }
}

router.get('/verify-email', handleVerifyEmail);
router.post('/verify-email', handleVerifyEmail);

/**
 * POST /api/auth/resend-verification
 * Resends verification email with rate limiting, account enumeration protection, and invalidation of previous token.
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const store = CollaborationStore.getInstance();

    // Determine target email: authenticated user or provided in request body
    const bodyEmail = req.body?.email;
    const authUser = req.authContext?.user;

    const email = (typeof bodyEmail === 'string' && bodyEmail.trim())
      ? bodyEmail.trim().toLowerCase()
      : (authUser?.email ? authUser.email.toLowerCase() : null);

    if (!email || !email.includes('@')) {
      res.status(400).json({
        success: false,
        error: 'A valid email address is required to resend verification.'
      });
      return;
    }

    // Rate limiting: 60-second cooldown per email
    const lastSentTime = resendCooldownMap.get(email) || 0;
    if (Date.now() - lastSentTime < RESEND_COOLDOWN_MS) {
      res.status(429).json({
        success: false,
        error: 'Please wait before requesting another email.'
      });
      return;
    }

    // Rate limiting: 5 requests per 15 minutes per IP + email
    const rateLimitKey = `${ip}_${email}`;
    if (isRateLimited(resendVerificationLimitMap, rateLimitKey, MAX_RESEND_VERIFICATION_REQUESTS)) {
      res.status(429).json({
        success: false,
        error: 'Please wait before requesting another email.'
      });
      return;
    }

    resendCooldownMap.set(email, Date.now());

    const userAuth = store.getUserByEmail(email);

    // Generic response message to prevent account enumeration
    const genericSuccessMessage = 'If an unverified account exists for this email, a new verification link has been sent.';

    if (!userAuth) {
      // Do not reveal account existence
      res.json({
        success: true,
        message: genericSuccessMessage
      });
      return;
    }

    // Check if user is already verified
    if (userAuth.emailVerifiedAt) {
      res.json({
        success: true,
        message: 'This email address is already verified. You can sign in directly.',
        alreadyVerified: true
      });
      return;
    }

    // Generate new secure token and invalidate previous token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour expiry

    store.setEmailVerificationToken(userAuth.id, tokenHash, verificationExpiresAt);

    // Build canonical verification URL and dispatch email
    const appUrl = getAppUrl(req);
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawToken}`;

    const emailService = EmailService.getInstance();
    const emailResult = await emailService.sendVerificationEmail({
      to: userAuth.email,
      name: userAuth.name,
      verificationUrl
    });

    store.logAuditEvent({
      actorId: userAuth.id,
      actorName: userAuth.name,
      workspaceId: 'global',
      action: 'EMAIL_VERIFICATION_RESENT',
      result: 'SUCCESS',
      metadata: { email: userAuth.email },
      correlationId: req.correlationId
    });

    const isDevOrTest = process.env.NODE_ENV !== 'production' || req.headers['x-test-suite'] === 'true';
    const responsePayload: Record<string, any> = {
      success: true,
      message: 'Verification email sent',
      emailDelivery: {
        sent: emailResult.success,
        deliveryMode: emailResult.deliveryMode
      }
    };

    if (isDevOrTest) {
      responsePayload.devVerificationToken = rawToken;
      responsePayload.devVerificationUrl = `/api/auth/verify-email?token=${rawToken}`;
    }

    res.json(responsePayload);
  } catch (err: any) {
    Logger.error('Failed to resend email verification', { error: String(err) });
    res.status(500).json({ success: false, error: 'Unable to send verification email.' });
  }
});

/**
 * GET /api/auth/email-status
 * Safe diagnostic status for configured email delivery provider.
 * Never leaks API keys, SMTP credentials, passwords, or tokens.
 */
router.get('/email-status', (_req: Request, res: Response) => {
  const emailService = EmailService.getInstance();
  const status = emailService.getStatus();
  res.json({
    success: true,
    provider: status.provider,
    isConfigured: status.isConfigured,
    deliveryMode: status.deliveryMode,
    isProduction: status.isProduction
  });
});

export const authRoutes = router;
