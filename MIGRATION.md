# Migration Guide: Supabase Rubric Storage

This guide explains how to set up and deploy the Supabase-based rubric storage system.

## Overview

This implementation migrates rubric storage from DuckDB to Supabase PostgreSQL with the following features:

- **User Authentication**: Supabase Auth (email/password)
- **Secure Storage**: User-specific rubrics with Row Level Security (RLS)
- **CRUD Operations**: Create, Read, Update, Delete rubrics
- **Session Management**: Client-side session persistence

## Prerequisites

1. **Supabase Project**: Create a project at [https://app.supabase.com](https://app.supabase.com)
2. **Vercel Account**: Your project is already configured with Vercel
3. **Environment Variables**: Already configured in your Vercel project

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_create_rubrics_tables.sql`
5. Paste into the SQL editor
6. Click **Run** to execute the migration

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

### Verify Migration

After running the migration, verify in Supabase Dashboard:

1. Navigate to **Table Editor**
2. Confirm these tables exist:
   - `rubrics`
   - `rubric_criteria`
3. Navigate to **Authentication** > **Policies**
4. Verify RLS policies are enabled for both tables

## Step 2: Configure Environment Variables

Your Vercel project already has these configured, but verify they exist:

```bash
# Check environment variables
vercel env ls
```

Required variables:
- `PROPOSAL_SUPABASE_URL`
- `PROPOSAL_SUPABASE_ANON_KEY`
- `PROPOSAL_SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_PROPOSAL_SUPABASE_URL`
- `NEXT_PUBLIC_PROPOSAL_SUPABASE_ANON_KEY`

### Local Development Setup

For local development, create `.env.local`:

```bash
# Copy from .env.example
cp .env.example .env.local

# Add your Supabase credentials from https://app.supabase.com/project/_/settings/api
```

## Step 3: Configure Authentication Redirect URLs

**IMPORTANT**: Configure your redirect URLs in Supabase to match your deployment:

1. Navigate to **Authentication** > **URL Configuration**
2. Set **Site URL** to your production URL:
   - Production: `https://your-app.vercel.app`
   - Development: `http://localhost:3000`
3. Add **Redirect URLs**:
   - `https://your-app.vercel.app/**` (production)
   - `http://localhost:3000/**` (development)

This ensures email confirmation links redirect to the correct domain.

## Step 4: Enable Email Authentication

In your Supabase dashboard:

1. Navigate to **Authentication** > **Providers**
2. Ensure **Email** is enabled
3. Configure email templates (optional):
   - Go to **Authentication** > **Email Templates**
   - Customize confirmation and password reset emails

### Email Confirmation Settings

By default, Supabase requires email confirmation. For development:

1. Go to **Authentication** > **Settings**
2. Under **Email Auth**, you can disable "Confirm email" for easier testing
3. **Important**: Re-enable for production!

## Step 5: Deploy to Vercel

```bash
# Deploy from this branch
git add .
git commit -m "feat: migrate rubric storage to Supabase with authentication"
git push origin supabase-rubric-storage

# Deploy via Vercel
vercel --prod
```

Or use Vercel's GitHub integration for automatic deployments.

## Step 6: Test the Implementation

### Create a Test User

1. Visit your deployed app (or `http://localhost:3000` for local)
2. Click **Sign In**
3. Create a new account with email/password
4. Check your email for confirmation link (if enabled)
5. Sign in to your account

### Test Rubric Management

1. Navigate to `/rubrics` or click "Rubric workspace"
2. Create a new rubric with criteria
3. Verify it appears in your saved rubrics list
4. Test that rubrics persist across sessions
5. Verify other users can't see your rubrics (create second account to test)

### Verify API Endpoints

Test the API routes:

```bash
# Get access token from browser dev tools:
# Application > Local Storage > supabase.auth.token

# List rubrics
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-app.vercel.app/api/rubrics

# Create rubric
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test rubric","criteria":[{"label":"Quality","weight":100}]}' \
  https://your-app.vercel.app/api/rubrics

# Get specific rubric
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-app.vercel.app/api/rubrics/RUBRIC_ID

# Update rubric
curl -X PUT \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated","description":"Updated rubric","criteria":[{"label":"Quality","weight":100}]}' \
  https://your-app.vercel.app/api/rubrics/RUBRIC_ID

# Delete rubric
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-app.vercel.app/api/rubrics/RUBRIC_ID
```

## Architecture Overview

### Database Schema

```sql
rubrics
├── id (uuid, primary key)
├── user_id (uuid, references auth.users)
├── name (text)
├── description (text)
├── created_at (timestamp)
└── updated_at (timestamp)

rubric_criteria
├── id (uuid, primary key)
├── rubric_id (uuid, references rubrics)
├── label (text)
├── weight (integer, 0-100)
└── position (integer)
```

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only SELECT their own rubrics
- Users can only INSERT rubrics with their own user_id
- Users can only UPDATE their own rubrics
- Users can only DELETE their own rubrics

### Authentication Flow

1. User signs up/signs in via `/auth/sign-in`
2. Supabase creates session with access token
3. Access token stored in browser (httpOnly cookie + localStorage)
4. Frontend sends token in `Authorization: Bearer` header
5. API routes validate token and execute queries with RLS

### Client Architecture

```
├── src/lib/supabase/
│   ├── client.ts          # Client-side Supabase client
│   └── server.ts          # Server-side Supabase clients
├── src/contexts/
│   └── auth-context.tsx   # React context for auth state
├── src/components/
│   ├── auth-header.tsx    # Header with sign in/out
│   └── rubric-manager.tsx # Rubric CRUD interface
└── src/app/
    ├── auth/
    │   ├── sign-in/page.tsx    # Sign in page
    │   └── callback/route.ts   # Auth callback handler
    └── api/rubrics/
        ├── route.ts            # List & Create rubrics
        └── [id]/route.ts       # Get, Update, Delete rubric
```

## Troubleshooting

### "Authentication required" errors

- Ensure user is signed in
- Check that access token is being sent in headers
- Verify Supabase environment variables are correct

### RLS policy errors

- Confirm migration ran successfully
- Check that RLS is enabled: `ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY`
- Verify policies exist in Supabase dashboard

### Email confirmation not working

- Check Supabase email settings
- For development, consider disabling email confirmation
- Check spam folder for confirmation emails

### Users can see each other's rubrics

- RLS policies may not be applied correctly
- Re-run the migration
- Verify `user_id` column matches `auth.uid()` in policies

## Migration from DuckDB (If Applicable)

If you have existing data in DuckDB:

1. Export rubrics from DuckDB using the old API
2. For each rubric, POST to new API with user authentication
3. Update localStorage keys to use new rubric IDs

Script example:

```javascript
// Run in browser console while signed in
async function migrateRubrics(oldRubrics) {
  const session = JSON.parse(localStorage.getItem('sb-...'));
  const token = session.access_token;

  for (const rubric of oldRubrics) {
    await fetch('/api/rubrics', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rubric)
    });
  }
}
```

## Security Considerations

1. **Service Role Key**: Never expose `PROPOSAL_SUPABASE_SERVICE_ROLE_KEY` to the client
2. **RLS Policies**: Always verify RLS is enabled and policies are correct
3. **Email Confirmation**: Enable for production to prevent spam accounts
4. **Password Requirements**: Configure in Supabase Auth settings
5. **Rate Limiting**: Consider adding rate limiting to API routes

## Next Steps

1. ✅ Run database migration
2. ✅ Test authentication flow
3. ✅ Verify rubric CRUD operations
4. ✅ Test RLS policies with multiple users
5. 🔄 Configure email templates
6. 🔄 Set up monitoring and error tracking
7. 🔄 Add rate limiting (if needed)

## Support

For issues:
- Check Supabase logs: Dashboard > Logs
- Review Vercel function logs
- Verify environment variables are set correctly
