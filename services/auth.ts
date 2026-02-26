import { supabase } from './supabase';
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

// ─── Crew Login (company username + PIN → lookup company_members) ─
export const crewLogin = async (
  companyIdentifier: string,
  pin: string
): Promise<AuthResult> => {
  // Look up the company by name (case-insensitive)
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', companyIdentifier)
    .single();

  if (companyErr || !company) {
    return { session: null, error: 'Company not found. Check the Company ID.' };
  }

  // Find crew member with matching PIN in that company
  const { data: member, error: memberErr } = await supabase
    .from('company_members')
    .select('id, crew_name, role, user_id')
    .eq('company_id', company.id)
    .eq('crew_pin', pin)
    .eq('role', 'crew')
    .eq('status', 'Active')
    .single();

  if (memberErr || !member) {
    return { session: null, error: 'Invalid PIN. Contact your administrator.' };
  }

  // Sign in as the crew auth user (or use a shared crew account approach)
  // For now, we generate a session for the crew user_id if they have an auth account
  // If your crew members share an auth account, adjust this logic accordingly
  const crewSession: UserSession = {
    username: company.name,
    companyName: company.name,
    companyId: company.id,
    role: 'crew',
    crewId: member.id,
    crewName: member.crew_name || 'Crew',
  };

  return { session: crewSession, error: null };
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
