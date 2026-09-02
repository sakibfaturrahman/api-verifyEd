import { AuthRepository, ProfileRow } from './auth.repository';
import { RegisterDto, LoginDto, RefreshDto } from './auth.validation';
import { ConflictError } from '../../core/errors/ConflictError';
import { UnauthorizedError } from '../../core/errors/UnauthorizedError';
import { AppError } from '../../core/errors/AppError';
import { logger } from '../../app';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  session: AuthSession;
  profile: Omit<ProfileRow, 'updated_at'>;
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    // Check for duplicate email before creating auth user
    const exists = await this.authRepository.emailExists(dto.email);
    if (exists) {
      throw new ConflictError('An account with this email address already exists');
    }

    try {
      await this.authRepository.createAuthUser(dto.email, dto.password, dto.name);
      logger.info({ email: dto.email }, 'New user registered');

      return { message: 'Registration successful. You can now log in.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Supabase may return "already registered" for race conditions
      if (message.toLowerCase().includes('already')) {
        throw new ConflictError('An account with this email address already exists');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    let session: AuthSession;

    try {
      session = await this.authRepository.signIn(dto.email, dto.password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('credentials')
      ) {
        throw new UnauthorizedError('Invalid email or password');
      }
      throw err;
    }

    // Fetch profile to check status and return role
    const profile = await this.authRepository.findProfileById(
      await this.getUserIdFromToken(session.accessToken),
    );

    if (!profile) {
      throw new UnauthorizedError('User profile not found');
    }

    if (profile.status === 'inactive') {
      throw new AppError(
        'Your account has been deactivated. Please contact support.',
        403,
        'ACCOUNT_INACTIVE',
      );
    }

    logger.info({ userId: profile.id }, 'User logged in');

    return { session, profile };
  }

  async refresh(dto: RefreshDto): Promise<AuthSession> {
    try {
      return await this.authRepository.refreshSession(dto.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.signOut(userId);
    logger.info({ userId }, 'User logged out');
  }

  async getMe(userId: string): Promise<ProfileRow> {
    const profile = await this.authRepository.findProfileById(userId);
    if (!profile) {
      throw new UnauthorizedError('User profile not found');
    }
    return profile;
  }

  /**
   * Extracts the user ID from an access token without re-validating it.
   * Used only after successful signIn where we know the token is valid.
   */
  private async getUserIdFromToken(accessToken: string): Promise<string> {
    const { supabaseAnon } = await import('../../config/supabase');
    const { data } = await supabaseAnon.auth.getUser(accessToken);
    if (!data.user) throw new UnauthorizedError('Could not extract user from token');
    return data.user.id;
  }
}
