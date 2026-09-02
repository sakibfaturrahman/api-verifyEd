import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all Supabase access BEFORE any real imports
vi.mock('../src/config/supabase', () => ({
  supabase: {
    auth: {
      admin: { createUser: vi.fn(), signOut: vi.fn() },
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn() })),
      })),
    })),
  },
  supabaseAnon: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id-123' } }, error: null }),
    },
  },
}));

vi.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 5001,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
    SUPABASE_STORAGE_BUCKET_ORIGINAL: 'certificates-original',
    SUPABASE_STORAGE_BUCKET_GENERATED: 'certificates-generated',
    CORS_ORIGIN: 'http://localhost:3000',
    MAX_FILE_SIZE: 10485760,
    MAX_BULK_FILES: 50,
    SIGNED_URL_EXPIRY: 3600,
    LOG_LEVEL: 'silent',
  },
  isDev: false,
}));

vi.mock('../src/app', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

// Import services directly (not via routes)
const { AppError } = await import('../src/core/errors/AppError');

// Build a minimal mock auth repository
const mockAuthRepository = {
  emailExists: vi.fn(),
  createAuthUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
  findProfileById: vi.fn(),
};

// Dynamically import AuthService AFTER mocks are set
const { AuthService } = await import('../src/modules/auth/auth.service');
const authService = new AuthService(mockAuthRepository as any);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a new user successfully', async () => {
    mockAuthRepository.emailExists.mockResolvedValue(false);
    mockAuthRepository.createAuthUser.mockResolvedValue({ userId: 'new-id', email: 'test@test.com' });

    const result = await authService.register({
      name: 'Test User',
      email: 'test@test.com',
      password: 'SecurePass123',
    });

    expect(result.message).toContain('successful');
    expect(mockAuthRepository.createAuthUser).toHaveBeenCalledWith(
      'test@test.com',
      'SecurePass123',
      'Test User',
    );
  });

  it('throws ConflictError (409) for duplicate email', async () => {
    mockAuthRepository.emailExists.mockResolvedValue(true);

    await expect(
      authService.register({ name: 'Test', email: 'taken@test.com', password: 'SecurePass123' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('AuthService.login', () => {
  beforeEach(() => vi.clearAllMocks());

  const mockSession = { accessToken: 'access-tok', refreshToken: 'refresh-tok', expiresAt: 9999 };
  const mockProfile = { id: 'user-id-123', email: 'user@test.com', role: 'user', status: 'active', name: 'Test' };

  it('returns session and profile on success', async () => {
    mockAuthRepository.signIn.mockResolvedValue(mockSession);
    mockAuthRepository.findProfileById.mockResolvedValue(mockProfile);

    const result = await authService.login({ email: 'user@test.com', password: 'SecurePass123' });

    expect(result.session.accessToken).toBe('access-tok');
    expect(result.profile.role).toBe('user');
  });

  it('throws 403 for inactive account', async () => {
    mockAuthRepository.signIn.mockResolvedValue(mockSession);
    mockAuthRepository.findProfileById.mockResolvedValue({ ...mockProfile, status: 'inactive' });

    await expect(
      authService.login({ email: 'user@test.com', password: 'SecurePass123' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_INACTIVE' });
  });

  it('throws 401 for wrong password', async () => {
    mockAuthRepository.signIn.mockRejectedValue(new Error('Invalid login credentials'));

    await expect(
      authService.login({ email: 'user@test.com', password: 'WrongPassword1' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.logout', () => {
  it('calls signOut with userId', async () => {
    mockAuthRepository.signOut.mockResolvedValue(undefined);
    await authService.logout('user-id-123');
    expect(mockAuthRepository.signOut).toHaveBeenCalledWith('user-id-123');
  });
});

describe('AuthService.refresh', () => {
  it('returns new session on valid refresh token', async () => {
    const newSession = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 9999 };
    mockAuthRepository.refreshSession.mockResolvedValue(newSession);
    const result = await authService.refresh({ refreshToken: 'valid-refresh-token' });
    expect(result.accessToken).toBe('new-access');
  });

  it('throws 401 for invalid refresh token', async () => {
    mockAuthRepository.refreshSession.mockRejectedValue(new Error('Token expired'));
    await expect(authService.refresh({ refreshToken: 'bad-token' })).rejects.toMatchObject({ statusCode: 401 });
  });
});
