import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * This route handles the OAuth callback from Supabase.
 * Supabase automatically handles the OAuth flow with Google,
 * and redirects here with a code. We exchange it for a session
 * and redirect to the dashboard.
 * 
 * Note: Supabase handles all the OAuth complexity - we just need
 * to exchange the code for a session token.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    // Create a Supabase client to exchange the code for a session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Supabase handles the OAuth - we just exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  }

  // Redirect to dashboard after Supabase has handled the OAuth
  return NextResponse.redirect(new URL(next, request.url));
}

