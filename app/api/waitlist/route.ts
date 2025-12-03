import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isValidEmail, sanitizeEmail, checkRateLimit } from '@/lib/utils/validation';

export const runtime = 'nodejs';

/**
 * POST /api/waitlist
 * Handles waitlist email submissions with validation, rate limiting, and security
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    // Rate limiting: 5 requests per minute per IP
    if (!checkRateLimit(ip, 5, 60000)) {
      return NextResponse.json(
        { error: 'Chill out! You can only request 5 times per minute.' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { email } = body;

    // Validate email presence
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Sanitize and validate email format
    const sanitizedEmail = sanitizeEmail(email);
    
    if (!isValidEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: 'Yo, that email is not valid. Please try again.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingEmail, error: checkError } = await supabaseAdmin
      .from('waitlist')
      .select('id')
      .eq('email', sanitizedEmail)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected for new emails
      console.error('We can\'t find that email in the database. Please try again.', checkError);
      return NextResponse.json(
        { error: 'We can\'t find that email in the database. Please try again.' },
        { status: 500 }
      );
    }

    if (existingEmail) {
      // Email already exists, return success to prevent email enumeration
      return NextResponse.json(
        { 
          message: 'You are already in the waitlist. XD. Don\'t worry, we will notify you when it launches.',
          success: true 
        },
        { status: 200 }
      );
    }

    // Insert new email into waitlist
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert([
        {
          email: sanitizedEmail,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting email:', error);
      return NextResponse.json(
        { error: 'Failed to insert email into the database.DK what went wrong. But we will fix it.' },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      { 
        message: 'You are in the Early Access List! Brace yourself for the launch of VeritasCV.',
        success: true 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in waitlist API:', error);
    return NextResponse.json(
      { error: 'Wow! The code broke! What a disaster!' },
      { status: 500 }
    );
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

