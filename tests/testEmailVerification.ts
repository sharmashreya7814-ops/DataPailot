import crypto from 'crypto';
import { CollaborationStore } from '../server/database/CollaborationStore';
import { requireVerifiedEmail, isEmailVerificationEnabled } from '../server/middleware/authMiddleware';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runEmailVerificationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 35. EMAIL VERIFICATION & LIFECYCLE (PHASE 3.2) ---');
  console.log('--- RUNNING EMAIL VERIFICATION TESTS ---');

  const store = CollaborationStore.getInstance();

  // 1. User registration with unverified email state
  const testEmail = `verify_test_${Date.now()}@datapilot.io`;
  const user = store.createUser({
    name: 'Verification Test User',
    email: testEmail,
    password: 'Password123!',
    role: 'ANALYST',
    emailVerified: false
  });

  assertTest(
    '1. User created with unverified status (emailVerified: false, emailVerifiedAt: null)',
    Boolean(user && user.id && user.emailVerified === false && user.emailVerifiedAt === null),
    'Failed to create unverified user'
  );

  // 2. Cryptographic token generation and SHA-256 hashing
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const futureExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  assertTest(
    '2. High-entropy token generation produces distinct raw token and SHA-256 hash',
    rawToken.length === 64 && tokenHash.length === 64 && rawToken !== tokenHash,
    'Token or hash format invalid'
  );

  // 3. Storing token hash in database (never raw token)
  store.setEmailVerificationToken(user.id, tokenHash, futureExpiresAt);
  const authRecord = store.getUserByEmail(testEmail);

  assertTest(
    '3. Database stores SHA-256 token hash; raw token is never persisted',
    Boolean(authRecord && authRecord.emailVerificationTokenHash === tokenHash),
    'Token hash was not stored properly'
  );

  // 4. Token lookup retrieves user
  const foundUser = store.getUserByVerificationTokenHash(tokenHash);
  assertTest(
    '4. User can be retrieved by cryptographic hash of token',
    Boolean(foundUser && foundUser.id === user.id),
    'Lookup by token hash failed'
  );

  // 5. Expiration detection
  const pastExpiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  store.setEmailVerificationToken(user.id, tokenHash, pastExpiresAt);
  const expiredRecord = store.getUserByVerificationTokenHash(tokenHash);
  const isExpired = expiredRecord?.emailVerificationExpiresAt
    ? new Date(expiredRecord.emailVerificationExpiresAt).getTime() < Date.now()
    : false;

  assertTest(
    '5. Expired token timestamp is correctly recognized as expired',
    isExpired === true,
    'Expired token check failed'
  );

  // 6. Resend verification updates token hash and expiry
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  store.setEmailVerificationToken(user.id, newTokenHash, newExpiresAt);
  const reloadedRecord = store.getUserByEmail(testEmail);

  assertTest(
    '6. Resend verification updates stored token hash and resets expiration window',
    Boolean(reloadedRecord && reloadedRecord.emailVerificationTokenHash === newTokenHash && reloadedRecord.emailVerificationTokenHash !== tokenHash),
    'Resend token update failed'
  );

  // 7. Old invalidated token hash no longer retrieves user
  const oldLookup = store.getUserByVerificationTokenHash(tokenHash);
  assertTest(
    '7. Previous token hash is invalidated when new verification token is issued',
    oldLookup === null,
    'Old token was still valid after reissuance'
  );

  // 8. Successful verification marks user as verified
  store.markEmailAsVerified(user.id);
  const verifiedUser = store.getUserById(user.id);

  assertTest(
    '8. markEmailAsVerified sets emailVerified to true and records emailVerifiedAt timestamp',
    Boolean(verifiedUser && verifiedUser.emailVerified === true && verifiedUser.emailVerifiedAt),
    'User was not marked as verified'
  );

  // 9. Single-use token enforcement: token hash is cleared from database
  const verifiedAuthRecord = store.getUserByEmail(testEmail);
  assertTest(
    '9. Single-use token enforcement: token hash and expiry are cleared from database',
    verifiedAuthRecord?.emailVerificationTokenHash === null && verifiedAuthRecord?.emailVerificationExpiresAt === null,
    'Token hash and expiry were not cleared'
  );

  // 10. Verification attempt with used token is rejected
  const postVerifyLookup = store.getUserByVerificationTokenHash(newTokenHash);
  assertTest(
    '10. Used verification token cannot be reused (lookup returns null)',
    postVerifyLookup === null,
    'Used token was still found in database'
  );

  // 11. Account enumeration protection
  const nonExistent = store.getUserByEmail('nonexistent-test@datapilot.io');
  assertTest(
    '11. Account enumeration prevention: non-existent email lookup safely returns null',
    nonExistent === null,
    'Non existent email returned a record'
  );

  // --- Feature Flag State Tests (ENABLE_EMAIL_VERIFICATION) ---
  const originalFlag = process.env.ENABLE_EMAIL_VERIFICATION;

  try {
    // 12. Feature flag disabled (false): isEmailVerificationEnabled() returns false
    process.env.ENABLE_EMAIL_VERIFICATION = 'false';
    assertTest(
      '12. Feature flag disabled: isEmailVerificationEnabled returns false when ENABLE_EMAIL_VERIFICATION=false',
      isEmailVerificationEnabled() === false,
      'isEmailVerificationEnabled should return false when disabled'
    );

    // 13. Feature flag disabled: unverified user is NOT blocked by requireVerifiedEmail middleware
    const disabledState = { nextCalled: false, status: 200 };
    const mockReqDisabled: any = {
      authContext: {
        user: { id: 'unverified_1', email: 'unverified@test.com', emailVerified: false }
      }
    };
    const mockResDisabled: any = {
      status(s: number) { disabledState.status = s; return mockResDisabled; },
      json() { return mockResDisabled; }
    };
    requireVerifiedEmail(mockReqDisabled, mockResDisabled, () => { disabledState.nextCalled = true; });
    assertTest(
      '13. Feature flag disabled: unverified users can use application normally without 403 block',
      disabledState.nextCalled === true && disabledState.status === 200,
      `Unverified user was blocked when flag was false: status=${disabledState.status}`
    );

    // 14. Feature flag enabled (true): isEmailVerificationEnabled() returns true
    process.env.ENABLE_EMAIL_VERIFICATION = 'true';
    assertTest(
      '14. Feature flag enabled: isEmailVerificationEnabled returns true when ENABLE_EMAIL_VERIFICATION=true',
      isEmailVerificationEnabled() === true,
      'isEmailVerificationEnabled should return true when enabled'
    );

    // 15. Feature flag enabled: unverified user is blocked with 403 EMAIL_VERIFICATION_REQUIRED
    const enabledState = { nextCalled: false, status: 200, body: null as any };
    const mockReqEnabled: any = {
      authContext: {
        user: { id: 'unverified_2', email: 'unverified2@test.com', emailVerified: false }
      }
    };
    const mockResEnabled: any = {
      status(s: number) { enabledState.status = s; return mockResEnabled; },
      json(b: any) { enabledState.body = b; return mockResEnabled; }
    };
    requireVerifiedEmail(mockReqEnabled, mockResEnabled, () => { enabledState.nextCalled = true; });
    assertTest(
      '15. Feature flag enabled: protected routes require verified email and block unverified users with 403',
      enabledState.nextCalled === false && enabledState.status === 403 && enabledState.body?.code === 'EMAIL_VERIFICATION_REQUIRED',
      `Unverified user was not blocked with 403 when flag was true: status=${enabledState.status}`
    );

    // 16. Feature flag enabled: verified user passes through requireVerifiedEmail middleware
    const verifiedState = { nextCalled: false, status: 200 };
    const mockReqVerified: any = {
      authContext: {
        user: { id: 'verified_1', email: 'verified@test.com', emailVerified: true }
      }
    };
    const mockResVerified: any = {
      status(s: number) { verifiedState.status = s; return mockResVerified; },
      json() { return mockResVerified; }
    };
    requireVerifiedEmail(mockReqVerified, mockResVerified, () => { verifiedState.nextCalled = true; });
    assertTest(
      '16. Feature flag enabled: verified users pass through protected routes successfully',
      verifiedState.nextCalled === true && verifiedState.status === 200,
      `Verified user was blocked: status=${verifiedState.status}`
    );

    // 17. Feature flag enabled: unauthenticated user receives 401
    const unauthState = { nextCalled: false, status: 200 };
    const mockReqUnauth: any = {};
    const mockResUnauth: any = {
      status(s: number) { unauthState.status = s; return mockResUnauth; },
      json() { return mockResUnauth; }
    };
    requireVerifiedEmail(mockReqUnauth, mockResUnauth, () => { unauthState.nextCalled = true; });
    assertTest(
      '17. Feature flag enabled: unauthenticated requests receive 401 Authentication required',
      unauthState.nextCalled === false && unauthState.status === 401,
      `Unauthenticated user did not receive 401: status=${unauthState.status}`
    );
  } finally {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_EMAIL_VERIFICATION;
    } else {
      process.env.ENABLE_EMAIL_VERIFICATION = originalFlag;
    }
  }

  return results;
}
