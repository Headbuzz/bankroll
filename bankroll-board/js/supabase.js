/**
 * BANKROLL — Supabase Client (HTML Game Board)
 * ─────────────────────────────────────────────
 * The anon key is SAFE to expose in client-side code.
 * Security comes from Row-Level Security (RLS) policies on the DB.
 * 
 * When Expo app is built, it reads from EXPO_PUBLIC_SUPABASE_URL
 * and EXPO_PUBLIC_SUPABASE_ANON_KEY in the .env file instead.
 * ─────────────────────────────────────────────
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://kwcaksexrlgmuxredbcc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Y2Frc2V4cmxnbXV4cmVkYmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NjA4MzgsImV4cCI6MjA5MjEzNjgzOH0.vsExdNZrc-R0eEINJQRvV5JG0I9BGRLqa51SEF-aELg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Get the currently authenticated user.
 * Returns null if not logged in.
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Sign in with Google OAuth.
 * Redirects back to the game lobby after login.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/bankroll-board/lobby.html',
    }
  });
  if (error) console.error('Auth error:', error.message);
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/bankroll-board/login.html';
}
