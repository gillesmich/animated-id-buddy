import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const DID_API_KEY = Deno.env.get('DID_API_KEY');

    if (!DID_API_KEY) {
      throw new Error('DID_API_KEY not configured');
    }

    console.log('D-ID API call:', action);

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

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('D-ID API error:', error);
      throw new Error(`D-ID API error: ${response.status}`);
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
