// supabase/functions/delete-user-account/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('Delete User Account function initializing');

serve(async (req) => {
  // 1. Check for valid Authorization header (user's JWT)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid authorization token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userJwt = authHeader.split(' ')[1];

  // 2. Create a Supabase client WITH THE USER'S JWT to verify who they are
  const supabaseClientForUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
  );

  const { data: { user: requestingUser }, error: userError } = await supabaseClientForUser.auth.getUser();

  if (userError || !requestingUser) {
    console.error('Error getting user from JWT:', userError);
    return new Response(JSON.stringify({ error: 'Invalid user token or user not found.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userIdToDelete = requestingUser.id;
  console.log(`Function invoked to delete user: ${userIdToDelete}`);

  // 3. Create a Supabase ADMIN client using the Service Role Key to perform deletions
  // Ensure SUPABASE_SERVICE_ROLE_KEY is set in Edge Function secrets
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
      console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY not set in Edge Function environment.");
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
      });
  }

  const supabaseAdminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  );

  try {
    // A. Delete user-specific data from your custom tables (profiles, chat_messages, conversations, etc.)
    console.log(`Deleting data for user ${userIdToDelete} from custom tables...`);

    // Example: Delete from profiles (CASCADE should handle related data if FKs are set up with ON DELETE CASCADE)
    const { error: profileDeleteError } = await supabaseAdminClient
      .from('profiles')
      .delete()
      .eq('id', userIdToDelete); // 'id' in profiles is FK to auth.users.id
    if (profileDeleteError) throw new Error(`Failed to delete profile: ${profileDeleteError.message}`);
    console.log(`Profile for ${userIdToDelete} deleted.`);

    // Example: Delete from chat_messages
    const { error: chatMessagesDeleteError } = await supabaseAdminClient
      .from('chat_messages')
      .delete()
      .eq('user_id', userIdToDelete);
    if (chatMessagesDeleteError) throw new Error(`Failed to delete chat messages: ${chatMessagesDeleteError.message}`);
    console.log(`Chat messages for ${userIdToDelete} deleted.`);

    // Example: Delete from conversations
    const { error: conversationsDeleteError } = await supabaseAdminClient
      .from('conversations')
      .delete()
      .eq('user_id', userIdToDelete);
    if (conversationsDeleteError) throw new Error(`Failed to delete conversations: ${conversationsDeleteError.message}`);
    console.log(`Conversations for ${userIdToDelete} deleted.`);

    // Add deletions for any other tables that store user_id specific data.

    // B. Delete files from Storage (avatars, homework-images)
    // This requires listing files in user's folder and then removing them.
    const avatarBucket = 'avatars';
    const { data: avatarFiles, error: listAvatarsError } = await supabaseAdminClient.storage
        .from(avatarBucket)
        .list(userIdToDelete); // List files in user's folder e.g., "user_id/"
    if (listAvatarsError) console.error(`Error listing avatars for user ${userIdToDelete}: ${listAvatarsError.message}`);
    if (avatarFiles && avatarFiles.length > 0) {
        const filesToRemove = avatarFiles.map(f => `${userIdToDelete}/${f.name}`);
        const { error: removeAvatarsError } = await supabaseAdminClient.storage.from(avatarBucket).remove(filesToRemove);
        if (removeAvatarsError) console.error(`Error removing avatars for user ${userIdToDelete}: ${removeAvatarsError.message}`);
        else console.log(`Avatars for ${userIdToDelete} removed from storage.`);
    }

    // C. Finally, delete the user from auth.users using the admin client
    console.log(`Attempting to delete user ${userIdToDelete} from auth.users...`);
    const { error: authUserDeleteError } = await supabaseAdminClient.auth.admin.deleteUser(userIdToDelete);

    if (authUserDeleteError) {
      console.error(`Failed to delete user ${userIdToDelete} from auth.users:`, authUserDeleteError);
      throw new Error(`Failed to delete user from authentication system: ${authUserDeleteError.message}`);
    }

    console.log(`User ${userIdToDelete} and all associated data successfully deleted.`);
    return new Response(JSON.stringify({ success: true, message: 'Account and all data successfully deleted.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`Error during account deletion process for user ${userIdToDelete}:`, error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'An internal error occurred during account deletion.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
