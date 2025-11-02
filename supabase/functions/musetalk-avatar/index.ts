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
    
    let musetalkUrl = Deno.env.get('MUSETALK_API_URL');
    if (!musetalkUrl) {
      throw new Error('MUSETALK_API_URL not configured');
    }
    
    // Remove trailing slash to avoid double slashes
    musetalkUrl = musetalkUrl.replace(/\/+$/, '');

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
        
        // 1. Generate audio using ElevenLabs if text is provided
        let audioData = data.audio_url;
        
        if (data.text && data.voice_id) {
          console.log('🎤 Generating audio with ElevenLabs...');
          const elevenlabsKey = Deno.env.get('ELEVENLABS_API_KEY');
          if (!elevenlabsKey) {
            throw new Error('ELEVENLABS_API_KEY not configured');
          }
          
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${data.voice_id}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': elevenlabsKey,
              },
              body: JSON.stringify({
                text: data.text,
                model_id: 'eleven_multilingual_v2',
              }),
            }
          );

          if (!ttsResponse.ok) {
            throw new Error(`ElevenLabs TTS error: ${ttsResponse.status}`);
          }

          // Convert audio to base64 for MuseTalk
          const audioBuffer = await ttsResponse.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          audioData = `data:audio/mpeg;base64,${base64Audio}`;
          console.log('✅ Audio generated');
        }
        
        endpoint = '/generate';
        body = JSON.stringify({
          image_url: data.source_url,
          audio_url: audioData,
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
