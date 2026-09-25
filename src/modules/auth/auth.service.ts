import { AuthRepository, ProfileRow } from "./auth.repository";
import { RegisterDto, LoginDto, RefreshDto } from "./auth.validation";
import { NotificationService } from "../notifications/notification.service";
import { ConflictError } from "../../core/errors/ConflictError";
import { UnauthorizedError } from "../../core/errors/UnauthorizedError";
import { AppError } from "../../core/errors/AppError";
import { logger } from "../../app";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  session: AuthSession;
  profile: Omit<ProfileRow, "updated_at">;
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const exists = await this.authRepository.emailExists(dto.email);
    if (exists) {
      throw new ConflictError(
        "An account with this email address already exists",
      );
    }

    try {
      await this.authRepository.createAuthUser(dto.email, dto.password, {
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        description: dto.description,
      });

      const newProfile = await this.authRepository.findProfileByEmail(
        dto.email,
      );

      if (newProfile) {
        try {
          await this.notificationService.notifyUserWelcome(
            newProfile.id,
            dto.name,
          );
        } catch (userNotifErr) {
          logger.warn(
            { userNotifErr, userId: newProfile.id },
            "failed to create welcome notification for user",
          );
        }
      }

      try {
        await this.notificationService.notifyNewRegistration({
          name: dto.name,
          email: dto.email,
        });
      } catch (adminNotifErr) {
        logger.warn(
          { adminNotifErr, email: dto.email },
          "failed to create admin notification on register",
        );
      }

      logger.info({ email: dto.email }, "New user registered");

      return { message: "Registration successful. You can now log in." };
    } catch (err: unknown) {
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
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("credentials") ||
        message.toLowerCase().includes("email not confirmed")
      ) {
        throw new UnauthorizedError(
          "Email atau kata sandi tidak cocok, atau email belum dikonfirmasi.",
        );
      }
      throw err;
    }

    // Ambil user ID dari token
    const userId = await this.getUserIdFromToken(session.accessToken);

    // Ambil data profil pengguna
    let profile = await this.authRepository.findProfileById(userId);

    // Fallback: jika akun ada di auth.users tapi record public.profiles belum ada
    if (!profile) {
      logger.warn(
        { userId, email: dto.email },
        "Profile not found in table, creating default profile",
      );
      const isAdminEmail = dto.email.toLowerCase().includes("admin");

      const { supabase } = await import("../../config/supabase");
      const { data: newProfile, error: createProfileErr } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: dto.email,
          name: isAdminEmail ? "Administrator" : dto.email.split("@")[0],
          role: isAdminEmail ? "admin" : "user",
          status: "active",
        })
        .select("*")
        .single();

      if (createProfileErr || !newProfile) {
        throw new UnauthorizedError(
          "User profile not found. Silakan hubungi admin.",
        );
      }

      profile = newProfile as ProfileRow;
    }

    if (profile.status === "inactive") {
      throw new AppError(
        "Akun Anda telah dinonaktifkan. Silakan hubungi administrator.",
        403,
        "ACCOUNT_INACTIVE",
      );
    }

    logger.info(
      { userId: profile.id, role: profile.role },
      "User logged in successfully",
    );

    return { session, profile };
  }

  async refresh(dto: RefreshDto): Promise<AuthSession> {
    try {
      return await this.authRepository.refreshSession(dto.refreshToken);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.signOut(userId);
    logger.info({ userId }, "User logged out");
  }

  async getMe(userId: string): Promise<ProfileRow> {
    const profile = await this.authRepository.findProfileById(userId);
    if (!profile) {
      throw new UnauthorizedError("User profile not found");
    }
    return profile;
  }

  private async getUserIdFromToken(accessToken: string): Promise<string> {
    try {
      // Decode JWT payload langsung (klaim 'sub' berisi UUID user di Supabase)
      const base64Url = accessToken.split(".")[1];
      if (base64Url) {
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
        const parsed = JSON.parse(jsonPayload);
        if (parsed.sub) return parsed.sub;
      }
    } catch {}

    // Fallback verifikasi via Supabase client
    const { supabase } = await import("../../config/supabase");
    const { data } = await supabase.auth.getUser(accessToken);
    if (!data.user) {
      throw new UnauthorizedError("Sesi token tidak valid");
    }
    return data.user.id;
  }
}
