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
    console.log(`MuseTalk API call: ${action}`);
    
    const musetalkUrl = Deno.env.get('MUSETALK_API_URL');
    if (!musetalkUrl) {
      throw new Error('MUSETALK_API_URL not configured');
    }

    let endpoint = '';
    let method = 'POST';
    let body = null;

    switch (action) {
      case 'health':
        endpoint = '/health';
        method = 'GET';
        break;
      
      case 'initialize':
        endpoint = '/initialize';
        method = 'POST';
        break;

      case 'create_talk':
        console.log('Request data:', JSON.stringify(data, null, 2));
        endpoint = '/generate';
        body = JSON.stringify({
          image_url: data.source_url,
          audio_url: data.audio_url,
          ...data.config
        });
        break;

      case 'get_talk':
        console.log('Request data:', JSON.stringify(data, null, 2));
        endpoint = `/status/${data.talkId}`;
        method = 'GET';
        break;

      case 'download':
        endpoint = `/download/${data.taskId}`;
        method = 'GET';
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Calling MuseTalk API: ${musetalkUrl}${endpoint}`);
    console.log(`Request body: ${body || 'none'}`);

    const response = await fetch(`${musetalkUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    console.log(`MuseTalk Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MuseTalk API error:', errorText);
      throw new Error(`MuseTalk API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('MuseTalk API success');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in musetalk-avatar function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
