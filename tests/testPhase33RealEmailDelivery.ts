import crypto from 'crypto';
import { EmailService } from '../server/services/email/EmailService';
import { ResendProvider } from '../server/services/email/providers/ResendProvider';
import { SmtpProvider } from '../server/services/email/providers/SmtpProvider';
import { DevelopmentFallbackProvider } from '../server/services/email/providers/DevelopmentFallbackProvider';
import { buildVerificationEmail, buildPasswordResetEmail } from '../server/services/email/templates';
import { maskEmail, extractDomain, IEmailProvider, EmailPayload } from '../server/services/email/types';
import { Logger } from '../server/utils/logger';
import { CollaborationStore } from '../server/database/CollaborationStore';
import { getAppUrl } from '../server/utils/url';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runRealEmailDeliveryTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('===========================================================');
  console.log('=== 36. PHASE 3.3 REAL EMAIL DELIVERY & SECURITY TESTS ===');
  console.log('===========================================================');

  // 1. Email masking utility
  const masked1 = maskEmail('alex@example.com');
  const masked2 = maskEmail('a@domain.org');
  const masked3 = maskEmail('robert.smith+analytics@company.co.uk');
  assertTest(
    '1. Email masking utility masks username correctly while retaining domain',
    masked1.includes('@example.com') && masked1.startsWith('a') && masked1.includes('*') &&
    masked2.includes('@domain.org') &&
    masked3.includes('@company.co.uk') && !masked3.includes('robert.smith'),
    'Email masking failed'
  );

  // 2. Recipient domain extraction
  const domain1 = extractDomain('analyst@sub.datapilot.io');
  const domain2 = extractDomain('invalid-email');
  assertTest(
    '2. Recipient domain extraction extracts domain and handles malformed strings safely',
    domain1 === 'sub.datapilot.io' && domain2 === 'unknown',
    'Domain extraction failed'
  );

  // 3. Verification email templates
  const dummyToken = crypto.randomBytes(32).toString('hex');
  const dummyVerifyUrl = `https://datapilot.io/api/auth/verify-email?token=${dummyToken}`;
  const verifyTemplate = buildVerificationEmail({
    to: 'tester@datapilot.io',
    name: 'Alex Vance',
    verificationUrl: dummyVerifyUrl
  });

  assertTest(
    '3. Verification email template contains required security notices, expiration (24 hours), and valid HTML/text',
    verifyTemplate.subject.toLowerCase().includes('verify') &&
    verifyTemplate.subject.includes('DataPilot') &&
    verifyTemplate.html.includes(dummyVerifyUrl) &&
    verifyTemplate.html.includes('24 hours') &&
    verifyTemplate.text.includes(dummyVerifyUrl) &&
    verifyTemplate.text.includes('If you did not create an account on DataPilot'),
    'Verification email template verification failed'
  );

  // 4. Password reset email templates
  const dummyResetUrl = `https://datapilot.io/?reset_token=${dummyToken}&type=reset`;
  const resetTemplate = buildPasswordResetEmail({
    to: 'tester@datapilot.io',
    name: 'Alex Vance',
    resetUrl: dummyResetUrl
  });

  assertTest(
    '4. Password reset email template contains 20-minute expiry, security notice, and single-use warning',
    resetTemplate.subject.includes('Reset your DataPilot password') &&
    resetTemplate.html.includes(dummyToken) &&
    resetTemplate.html.includes('20 minutes') &&
    resetTemplate.html.includes('only once') &&
    resetTemplate.text.includes(dummyResetUrl) &&
    resetTemplate.text.includes('If you did not request a password reset'),
    'Password reset email template verification failed'
  );

  // 5. ResendProvider configuration detection
  const origApiKey = process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_API_KEY;
  const unconfiguredResend = new ResendProvider();
  assertTest(
    '5. ResendProvider correctly detects unconfigured state when EMAIL_API_KEY is empty',
    unconfiguredResend.isConfigured === false,
    'Resend unconfigured detection failed'
  );

  process.env.EMAIL_API_KEY = 're_test_dummy_key_12345';
  const configuredResend = new ResendProvider();
  assertTest(
    '6. ResendProvider correctly detects configured state when valid API key is present',
    configuredResend.isConfigured === true && configuredResend.name === 'resend',
    'Resend configured detection failed'
  );
  if (origApiKey) process.env.EMAIL_API_KEY = origApiKey; else delete process.env.EMAIL_API_KEY;

  // 6. SmtpProvider configuration detection
  const origSmtpHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  const unconfiguredSmtp = new SmtpProvider();
  assertTest(
    '7. SmtpProvider correctly detects unconfigured state when SMTP_HOST is empty',
    unconfiguredSmtp.isConfigured === false,
    'SMTP unconfigured detection failed'
  );

  process.env.SMTP_HOST = 'smtp.example.com';
  const configuredSmtp = new SmtpProvider();
  assertTest(
    '8. SmtpProvider correctly detects configured state when host is supplied',
    configuredSmtp.isConfigured === true && configuredSmtp.name === 'smtp',
    'SMTP configured detection failed'
  );
  if (origSmtpHost) process.env.SMTP_HOST = origSmtpHost; else delete process.env.SMTP_HOST;

  // 7. DevelopmentFallbackProvider behavior
  const fallback = new DevelopmentFallbackProvider();
  const fallbackResult = await fallback.sendEmail({
    to: 'dev.user@example.com',
    name: 'Dev User',
    subject: 'Test Subject',
    html: '<p>Test</p>',
    text: 'Test',
    emailType: 'VERIFICATION'
  });
  assertTest(
    '9. DevelopmentFallbackProvider delivers mock message with development_fallback mode',
    fallbackResult.success === true &&
    fallbackResult.deliveryMode === 'development_fallback' &&
    Boolean(fallbackResult.messageId?.startsWith('dev_msg_')),
    'Fallback provider behavior failed'
  );

  // 8. EmailService provider abstraction and mock provider testing
  class MockTestingProvider implements IEmailProvider {
    public readonly name = 'mock_tester';
    public readonly isConfigured = true;
    public lastPayload: EmailPayload | null = null;

    public async sendEmail(payload: EmailPayload) {
      this.lastPayload = payload;
      return {
        success: true,
        messageId: `mock_${Date.now()}`,
        deliveryMode: 'real' as const
      };
    }
  }

  const mockProvider = new MockTestingProvider();
  const testEmailService = new EmailService(mockProvider);

  const origFlagFor10 = process.env.ENABLE_EMAIL_VERIFICATION;
  process.env.ENABLE_EMAIL_VERIFICATION = 'true';
  const testVerifyResult = await testEmailService.sendVerificationEmail({
    to: 'new.member@enterprise.com',
    name: 'New Member',
    verificationUrl: 'https://datapilot.io/api/auth/verify-email?token=mocktoken123'
  });

  assertTest(
    '10. EmailService dispatches verification email through configured provider',
    testVerifyResult.success === true &&
    testVerifyResult.provider === 'mock_tester' &&
    testVerifyResult.recipientMasked.includes('@enterprise.com') &&
    testVerifyResult.recipientDomain === 'enterprise.com' &&
    mockProvider.lastPayload !== null &&
    mockProvider.lastPayload.to === 'new.member@enterprise.com' &&
    mockProvider.lastPayload.html.includes('mocktoken123'),
    'EmailService verification dispatch failed'
  );

  // MODE A check: When verification is disabled, delivery is optional
  process.env.ENABLE_EMAIL_VERIFICATION = 'false';
  const testVerifyResultDisabled = await testEmailService.sendVerificationEmail({
    to: 'new.member@enterprise.com',
    name: 'New Member',
    verificationUrl: 'https://datapilot.io/api/auth/verify-email?token=mocktoken123'
  });
  assertTest(
    '10b. EmailService treats verification email as optional when ENABLE_EMAIL_VERIFICATION=false',
    testVerifyResultDisabled.success === true && testVerifyResultDisabled.deliveryMode === 'optional',
    'Disabled verification email check failed'
  );
  if (origFlagFor10 !== undefined) process.env.ENABLE_EMAIL_VERIFICATION = origFlagFor10; else delete process.env.ENABLE_EMAIL_VERIFICATION;

  const testResetResult = await testEmailService.sendPasswordResetEmail({
    to: 'recovery@enterprise.com',
    name: 'Recovery User',
    resetUrl: 'https://datapilot.io/?reset_token=mockreset123&type=reset'
  });

  assertTest(
    '11. EmailService dispatches password reset email through configured provider',
    testResetResult.success === true &&
    testResetResult.provider === 'mock_tester' &&
    testResetResult.recipientMasked.includes('@enterprise.com') &&
    mockProvider.lastPayload !== null &&
    mockProvider.lastPayload.to === 'recovery@enterprise.com' &&
    mockProvider.lastPayload.html.includes('mockreset123'),
    'EmailService password reset dispatch failed'
  );

  // 9. Production error safety: unconfigured provider in production fails safely
  class UnconfiguredMockProvider implements IEmailProvider {
    public readonly name = 'unconfigured_prod';
    public readonly isConfigured = false;
    public async sendEmail() {
      return { success: false, error: 'Provider unconfigured', deliveryMode: 'real' as const };
    }
  }

  const origNodeEnv = process.env.NODE_ENV;
  const origFlagFor12 = process.env.ENABLE_EMAIL_VERIFICATION;
  process.env.NODE_ENV = 'production';
  process.env.ENABLE_EMAIL_VERIFICATION = 'true'; // MODE B: enabled
  const prodEmailService = new EmailService(new UnconfiguredMockProvider());
  const prodResult = await prodEmailService.sendVerificationEmail({
    to: 'prod.user@datapilot.io',
    name: 'Prod User',
    verificationUrl: 'https://datapilot.io/api/auth/verify-email?token=prodtoken'
  });

  assertTest(
    '12. In production, unconfigured email service fails safely with generic message and does not crash',
    prodResult.success === false &&
    prodResult.error?.includes('unavailable') &&
    !prodResult.error.includes('apiKey') &&
    !prodResult.error.includes('secret'),
    'Production unconfigured failure safety failed'
  );

  // MODE A: In production with ENABLE_EMAIL_VERIFICATION=false, real email delivery is NOT required
  process.env.ENABLE_EMAIL_VERIFICATION = 'false';
  const prodResultDisabled = await prodEmailService.sendVerificationEmail({
    to: 'prod.user@datapilot.io',
    name: 'Prod User',
    verificationUrl: 'https://datapilot.io/api/auth/verify-email?token=prodtoken'
  });

  assertTest(
    '12b. In production with ENABLE_EMAIL_VERIFICATION=false, verification email delivery is not required',
    prodResultDisabled.success === true &&
    prodResultDisabled.deliveryMode === 'optional',
    'Disabled mode in production should not require email delivery'
  );

  process.env.NODE_ENV = origNodeEnv;
  if (origFlagFor12 !== undefined) process.env.ENABLE_EMAIL_VERIFICATION = origFlagFor12; else delete process.env.ENABLE_EMAIL_VERIFICATION;

  // 10. Log sanitization: tokens, API keys, passwords, secrets are never logged
  const loggedEntries: any[] = [];
  const origLogMethod = console.log;
  console.log = (...args: any[]) => {
    loggedEntries.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };

  Logger.info('Testing operational log redaction', {
    email: 'sensitive.user@datapilot.io',
    token: 'super_secret_raw_token_xyz',
    password: 'SuperSecretPassword123!',
    apiKey: 're_secret_api_key_456',
    url: 'https://datapilot.io/api/auth/verify-email?token=super_secret_raw_token_xyz'
  });

  console.log = origLogMethod;

  const logDump = loggedEntries.join('\n');
  assertTest(
    '13. Sensitive credentials (token, password, apiKey) are automatically redacted by Logger',
    !logDump.includes('super_secret_raw_token_xyz') &&
    !logDump.includes('SuperSecretPassword123!') &&
    !logDump.includes('re_secret_api_key_456'),
    'Log sanitization failed to redact credentials'
  );

  // 11. Canonical URL resolution with getAppUrl
  const origAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://app.datapilot.analytics.com/';
  const resolvedUrl = getAppUrl();
  assertTest(
    '14. getAppUrl strips trailing slashes and honors APP_URL environment variable',
    resolvedUrl === 'https://app.datapilot.analytics.com',
    'getAppUrl failed to resolve correctly'
  );
  if (origAppUrl) process.env.APP_URL = origAppUrl; else delete process.env.APP_URL;

  // 12. End-to-end user lifecycle integration with CollaborationStore
  const store = CollaborationStore.getInstance();
  const testUserEmail = `phase33_e2e_${Date.now()}@datapilot.io`;
  const e2eUser = store.createUser({
    name: 'E2E Email Test',
    email: testUserEmail,
    password: 'Password123!',
    role: 'ANALYST',
    emailVerified: false
  });

  const rawVerificationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
  store.setEmailVerificationToken(e2eUser.id, tokenHash, new Date(Date.now() + 86400000).toISOString());

  // Verify email using token hash and mark as verified
  const foundByToken = store.getUserByVerificationTokenHash(tokenHash);
  assert(Boolean(foundByToken && foundByToken.id === e2eUser.id), 'Token hash lookup failed');
  store.markEmailAsVerified(e2eUser.id);
  const verifiedUser = store.getUserById(e2eUser.id);
  assertTest(
    '15. User email verification successfully transitions user to verified state and clears token hash',
    Boolean(verifiedUser && verifiedUser.emailVerified === true && verifiedUser.emailVerifiedAt !== null),
    'User verification state transition failed'
  );

  const reloaded = store.getUserByEmail(testUserEmail);
  assertTest(
    '16. Verified user no longer holds pending verification token hash',
    reloaded?.emailVerificationTokenHash === null,
    'Verification token hash was not cleared'
  );

  // Print Summary
  console.log('\n--- TEST EXECUTION SUMMARY ---');
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    if (r.passed) {
      console.log(`[PASS] ${r.name}`);
      passCount++;
    } else {
      console.log(`[FAIL] ${r.name}: ${r.error}`);
      failCount++;
    }
  }

  console.log(`\nTotal: ${results.length}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) {
    throw new Error(`${failCount} tests failed in Phase 3.3 test suite`);
  }
  return results;
}

// If executed directly
if (process.argv[1]?.endsWith('testPhase33RealEmailDelivery.ts')) {
  runRealEmailDeliveryTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
