import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import type { UserSession } from '../types';
import type { Session, User } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────
export interface AuthResult {
  session: UserSession | null;
  error: string | null;
}

// ─── Admin: Sign Up (creates auth user + company + membership) ───
export const signUpWithEmail = async (
  email: string,
  password: string,
  companyName: string
): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { company_name: companyName, role: 'admin' },
    },
  });

  if (error) return { session: null, error: error.message };
  if (!data.user) return { session: null, error: 'Sign up failed — no user returned.' };

  // After signup, try to get the company_member record
  // (created via DB trigger or we create it inline)
  const userSession = await buildSessionFromUser(data.user, data.session);
  if (!userSession) {
    return { session: null, error: 'Account created. Please check your email to confirm, then log in.' };
  }

  return { session: userSession, error: null };
};

// ─── Admin: Login ────────────────────────────────────────
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { session: null, error: error.message };
  if (!data.user) return { session: null, error: 'Login failed.' };

  const userSession = await buildSessionFromUser(data.user, data.session);
  if (!userSession) {
    return { session: null, error: 'No company membership found. Contact support.' };
  }

  return { session: userSession, error: null };
};

// ─── Admin: Password Reset ──────────────────────────────
export const sendPasswordReset = async (email: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error: error?.message ?? null };
};

// ─── Crew Login (email + password → real Supabase Auth session) ───
export const crewLogin = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { session: null, error: error.message };
  if (!data.user) return { session: null, error: 'Login failed.' };

  const userSession = await buildSessionFromUser(data.user, data.session);
  if (!userSession) {
    return { session: null, error: 'No crew membership found. Contact your administrator.' };
  }

  // Ensure they're actually a crew member
  if (userSession.role !== 'crew') {
    return { session: null, error: 'This account is not a crew login. Use Admin Access instead.' };
  }

  return { session: userSession, error: null };
};

// ─── Create Crew Auth Account (called by admin from Profile page) ──
// Uses a separate, non-persisted Supabase client so the admin
// stays logged in while the crew auth user is created.
export const createCrewAuthAccount = async (
  companyId: string,
  memberId: string,
  email: string,
  password: string,
  crewName: string
): Promise<{ userId: string | null; error: string | null }> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Throwaway client — won't touch the admin's session
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'crew',
        company_id: companyId,
        member_id: memberId,
        crew_name: crewName,
      },
    },
  });

  if (error) return { userId: null, error: error.message };
  if (!data.user) return { userId: null, error: 'Signup failed — no user returned.' };

  // The DB trigger (handle_new_user) will link this auth user to the
  // existing company_members row using member_id + company_id.
  return { userId: data.user.id, error: null };
};

// ─── Sign Out ────────────────────────────────────────────
export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
  localStorage.removeItem('foamProSession');
};

// ─── Session Recovery ────────────────────────────────────
export const getCurrentSession = async (): Promise<UserSession | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return buildSessionFromUser(session.user, session);
};

// ─── Auth State Listener ─────────────────────────────────
export const onAuthStateChange = (
  callback: (session: UserSession | null) => void
) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const userSession = await buildSessionFromUser(session.user, session);
      callback(userSession);
    } else if (event === 'SIGNED_OUT') {
      callback(null);
    }
  });
};

// ─── Build UserSession from Supabase user ────────────────
const buildSessionFromUser = async (
  user: User,
  session: Session | null
): Promise<UserSession | null> => {
  // Query company_members for this user's company & role
  const { data: membership, error } = await supabase
    .from('company_members')
    .select(`
      id,
      role,
      crew_name,
      company_id,
      companies (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .single();

  if (error || !membership) return null;

  const company = (membership as any).companies;

  return {
    username: user.email || user.id,
    companyName: company?.name || '',
    companyId: company?.id || membership.company_id,
    role: membership.role as 'admin' | 'crew',
    crewId: membership.role === 'crew' ? membership.id : undefined,
    crewName: membership.crew_name || undefined,
    token: session?.access_token,
  };
};
