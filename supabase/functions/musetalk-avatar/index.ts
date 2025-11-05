import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fal } from "npm:@fal-ai/client@1.7.2";

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
    console.log(`MuseTalk FAL AI call: ${action}`);
    
    const falApiKey = Deno.env.get('FAL_API_KEY');
    console.log('FAL_API_KEY present:', !!falApiKey);
    
    if (!falApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'FAL API key not configured',
          code: 'NOT_CONFIGURED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Configure FAL client
    fal.config({ credentials: falApiKey });

    switch (action) {
      case 'create_talk':
        console.log('📋 Request data:', JSON.stringify(data, null, 2));
        
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

          // Convert audio to base64
          const audioBuffer = await ttsResponse.arrayBuffer();
          const uint8Array = new Uint8Array(audioBuffer);
          
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          
          const base64Audio = btoa(binary);
          audioData = `data:audio/mpeg;base64,${base64Audio}`;
          console.log('✅ Audio generated');
        }
        
        // 2. Use fal.subscribe() for automatic queue handling
        console.log('🎬 Submitting to FAL AI with fal.subscribe()...');
        
        const result = await fal.subscribe("fal-ai/musetalk", {
          input: {
            source_video_url: data.source_url,
            audio_url: audioData
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              console.log('📊 Progress:', update.status);
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });

        console.log('✅ Result received:', JSON.stringify(result.data, null, 2));
        
        const videoUrl = result.data?.video?.url;
        
        if (!videoUrl) {
          throw new Error('No video URL in result');
        }

        return new Response(
          JSON.stringify({ videoUrl }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
