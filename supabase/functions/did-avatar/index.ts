import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      action: z.enum(['create_talk', 'get_talk', 'list_voices', 'list_presenters']),
      data: z.any().optional()
    });

    const requestBody = await req.json();
    const validatedData = requestSchema.parse(requestBody);
    const { action, data } = validatedData;
    const DID_API_KEY = Deno.env.get('DID_API_KEY');

    if (!DID_API_KEY) {
      throw new Error('DID_API_KEY not configured');
    }

    console.log('D-ID API call:', action);
    console.log('Request data:', JSON.stringify(data, null, 2));

    // Encode API key properly for Basic auth (format: base64(api_key:))
    const encodedKey = btoa(`${DID_API_KEY}:`);
    console.log('Encoded key format verified');

    let url: string;
    let method = 'POST';
    let body: any;

    switch (action) {
      case 'create_talk':
        url = 'https://api.d-id.com/talks';
        body = data;
        break;
      case 'get_talk':
        url = `https://api.d-id.com/talks/${data.talkId}`;
        method = 'GET';
        break;
      case 'list_voices':
        url = 'https://api.d-id.com/tts/voices';
        method = 'GET';
        break;
      case 'list_presenters':
        url = 'https://api.d-id.com/clips/presenters';
        method = 'GET';
        break;
      default:
        throw new Error('Invalid action');
    }

    console.log('Calling D-ID API:', url);
    console.log('Request body:', body ? JSON.stringify(body, null, 2) : 'none');
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${encodedKey}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    console.log('D-ID Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID API error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Provide helpful error messages based on status code
      let userMessage = 'D-ID API error';
      if (response.status === 401) {
        userMessage = 'Invalid D-ID API key. Please check your API key in settings.';
      } else if (response.status === 402) {
        userMessage = 'D-ID account has insufficient credits. Please add credits to your D-ID account.';
      } else if (response.status === 429) {
        userMessage = 'D-ID rate limit exceeded. Please try again later.';
      } else if (response.status === 500) {
        userMessage = 'D-ID server error. This may indicate: invalid API key, insufficient credits, or temporary server issues. Please check your D-ID account status.';
      }
      
      throw new Error(JSON.stringify({
        status: response.status,
        error: errorData,
        message: userMessage
      }));
    }

    const result = await response.json();
    console.log('D-ID API success');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
