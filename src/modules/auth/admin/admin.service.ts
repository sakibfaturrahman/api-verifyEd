import { AuthRepository, ProfileRow } from "../../auth/auth.repository";
import { CreateAdminDto, UpdateAdminDto } from "./admin.validation";
import { ConflictError } from "../../../core/errors/ConflictError";
import { AppError } from "../../../core/errors/AppError";
import { NotFoundError } from "../../../core/errors/NotFoundError";
import { env } from "../../../config/env";

export class AdminService {
  constructor(private readonly authRepository: AuthRepository) {}

  private checkSuperAdmin(targetAdminId: string): void {
    if (targetAdminId === env.SUPER_ADMIN_ID) {
      throw new AppError(
        "Action forbidden: Super Admin cannot be modified or deleted.",
        403,
        "FORBIDDEN",
      );
    }
  }

  async getAllAdmins(): Promise<ProfileRow[]> {
    return await this.authRepository.getAdmins();
  }

  async createAdmin(
    dto: CreateAdminDto,
  ): Promise<{ message: string; userId: string }> {
    const exists = await this.authRepository.emailExists(dto.email);
    if (exists) {
      throw new ConflictError(
        "An account with this email address already exists",
      );
    }

    const { userId } = await this.authRepository.createAdminUser(
      dto.email,
      dto.password,
      dto.name,
    );
    return { message: "Admin account created successfully", userId };
  }

  async updateAdmin(adminId: string, dto: UpdateAdminDto): Promise<ProfileRow> {
    // 1. Proteksi Admin Utama
    this.checkSuperAdmin(adminId);

    // 2. Pastikan target memang ada dan ber-role admin
    const target = await this.authRepository.findProfileById(adminId);
    if (!target || target.role !== "admin") {
      throw new NotFoundError("Admin account not found");
    }

    return await this.authRepository.updateAdminProfile(adminId, dto);
  }

  async deleteAdmin(adminId: string): Promise<void> {
    // 1. Proteksi Admin Utama
    this.checkSuperAdmin(adminId);

    // 2. Pastikan target memang ada dan ber-role admin
    const target = await this.authRepository.findProfileById(adminId);
    if (!target || target.role !== "admin") {
      throw new NotFoundError("Admin account not found");
    }

    await this.authRepository.deleteAdminUser(adminId);
  }
}
