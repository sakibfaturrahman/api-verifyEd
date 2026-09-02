import { UserRepository } from './user.repository';
import { ProfileRow } from '../auth/auth.repository';
import { UpdateProfileDto, ChangePasswordDto } from './user.validation';
import { NotFoundError } from '../../core/errors/NotFoundError';
import { UnauthorizedError } from '../../core/errors/UnauthorizedError';
import { parsePagination, buildPaginationMeta } from '../../core/utils/pagination';
import { supabase } from '../../config/supabase';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<ProfileRow> {
    const profile = await this.userRepository.findById(userId);
    if (!profile) throw new NotFoundError('Profile');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileRow> {
    const profile = await this.userRepository.findById(userId);
    if (!profile) throw new NotFoundError('Profile');
    return this.userRepository.update(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    // Re-authenticate with current password to verify it
    const profile = await this.userRepository.findById(userId);
    if (!profile) throw new NotFoundError('Profile');

    // Verify current password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: dto.currentPassword,
    });

    if (signInError) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Update the password via admin API
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: dto.newPassword,
    });

    if (error) throw error;
  }

  // Admin operations
  async listUsers(rawPage: unknown, rawLimit: unknown, search?: string, status?: string, role?: string) {
    const { page, limit, offset } = parsePagination(rawPage, rawLimit);
    const { data, total } = await this.userRepository.findAll({ page, limit, offset, search, status, role });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getUserById(id: string): Promise<ProfileRow> {
    const profile = await this.userRepository.findById(id);
    if (!profile) throw new NotFoundError('User');
    return profile;
  }

  async updateUserStatus(id: string, status: 'active' | 'inactive'): Promise<ProfileRow> {
    const profile = await this.userRepository.findById(id);
    if (!profile) throw new NotFoundError('User');
    return this.userRepository.updateStatus(id, status);
  }

  async deleteUser(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) {
      throw new UnauthorizedError('You cannot delete your own account');
    }
    const profile = await this.userRepository.findById(id);
    if (!profile) throw new NotFoundError('User');
    await this.userRepository.deleteUser(id);
  }
}
