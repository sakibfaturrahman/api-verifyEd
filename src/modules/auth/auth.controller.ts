import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { successResponse } from "../../core/utils/response";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // registrasi pengguna atau organisasi baru
  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      successResponse({ res, message: result.message, statusCode: 201 });
    } catch (err) {
      next(err);
    }
  };

  // masuk akun dan dapatkan token autentikasi
  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { session, profile } = await this.authService.login(req.body);
      successResponse({
        res,
        message: "Login successful",
        data: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          profile: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            status: profile.status,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // keluar akun dan batalkan sesi aktif
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.authService.logout(req.user!.id);
      successResponse({ res, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  };

  // perbarui access token menggunakan refresh token
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.authService.refresh(req.body);
      successResponse({
        res,
        message: "Token refreshed successfully",
        data: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // dapatkan profil pengguna yang sedang login
  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const profile = await this.authService.getMe(req.user!.id);
      successResponse({
        res,
        message: "Profile retrieved successfully",
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  };
}
