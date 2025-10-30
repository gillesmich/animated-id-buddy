import { supabase } from "@/integrations/supabase/client";

/**
 * Makes an authenticated fetch request to a Supabase edge function
 * Automatically includes the user's JWT token in the Authorization header
 */
export async function authenticatedFetch(
  functionName: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('User not authenticated');
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
