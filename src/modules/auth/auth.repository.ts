import { supabase } from "../../config/supabase";

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  description: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export class AuthRepository {
  /**
   * Creates a new user in Supabase Auth.
   * The profile row is auto-created by the on_auth_user_created DB trigger.
   */
  // auth.repository.ts
  async createAuthUser(
    email: string,
    password: string,
    metadata: {
      name: string;
      phone?: string;
      address?: string;
      description?: string;
    },
  ): Promise<{ userId: string; email: string }> {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) throw error;
    if (!data.user) throw new Error("User creation failed");

    // Update profil untuk memastikan kolom nullable terisi
    await supabase
      .from("profiles")
      .update({
        phone: metadata.phone || null,
        address: metadata.address || null,
        description: metadata.description || null,
      })
      .eq("id", data.user.id);

    return { userId: data.user.id, email: data.user.email! };
  }

  // Tambahkan di AuthRepository
  async createAdminUser(
    email: string,
    password: string,
    name: string,
  ): Promise<{ userId: string; email: string }> {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "admin" },
    });

    if (error) throw error;
    if (!data.user) throw new Error("Failed to create admin user");

    // Update paksa kolom role di tabel profiles menjadi admin
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.user.id);

    if (profileError) throw profileError;

    return { userId: data.user.id, email: data.user.email! };
  }

  async getAdmins(): Promise<ProfileRow[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as ProfileRow[];
  }

  async updateAdminProfile(
    adminId: string,
    payload: Partial<Pick<ProfileRow, "name" | "phone" | "address" | "status">>,
  ): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", adminId)
      .select()
      .single();

    if (error) throw error;
    return data as ProfileRow;
  }

  async deleteAdminUser(adminId: string): Promise<void> {
    // Hapus akun dari auth Supabase (cascade ke profiles via database constraint)
    const { error } = await supabase.auth.admin.deleteUser(adminId);
    if (error) throw error;
  }
  /**
   * Signs in a user using Supabase Auth and returns the session.
   * Uses anon key sign-in path (not admin) to generate proper tokens.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session) throw new Error("Sign in failed: no session returned");

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  }

  /**
   * Refreshes an access token using a refresh token.
   */
  async refreshSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) throw error;
    if (!data.session) throw new Error("Refresh failed: no session returned");

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  }

  /**
   * Signs out a user by revoking all sessions.
   */
  async signOut(userId: string): Promise<void> {
    await supabase.auth.admin.signOut(userId, "global");
  }

  /**
   * Fetches a user profile from public.profiles by ID.
   */
  async findProfileById(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) return null;
    return data as ProfileRow;
  }

  /**
   * Checks if an email is already registered in profiles.
   */
  async emailExists(email: string): Promise<boolean> {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    return !!data;
  }

  // cari data profil pengguna berdasarkan alamat email
  async findProfileByEmail(email: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return null;
    return data as ProfileRow;
  }
}
