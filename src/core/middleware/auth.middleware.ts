import { Request, Response, NextFunction } from 'express';
import { supabaseAnon, supabase } from '../../config/supabase';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { AppError } from '../errors/AppError';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

// Extend Express Request type to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authenticates the request by validating the Bearer token against Supabase Auth.
 * On success, attaches `req.user` with profile data from `public.profiles`.
 * Throws UnauthorizedError for missing/invalid tokens.
 * Throws AppError(403) if the account is inactive.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    // Validate the JWT against Supabase Auth
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !authData.user) {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    // Fetch the profile from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedError('User profile not found');
    }

    // Block inactive accounts
    if (profile.status === 'inactive') {
      throw new AppError('Account is deactivated. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    req.user = {
      id: profile.id as string,
      email: profile.email as string,
      role: profile.role as 'admin' | 'user',
      status: profile.status as 'active' | 'inactive',
    };

    next();
  } catch (err) {
    next(err);
  }
}
