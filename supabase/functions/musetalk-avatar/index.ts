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

          // Convert audio to base64 using binary string approach
          const audioBuffer = await ttsResponse.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);
          
          // Build binary string character by character for safety
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          
          const base64Audio = btoa(binary);
          audioData = `data:audio/mpeg;base64,${base64Audio}`;
          console.log('✅ Audio generated');
        }
        
        
        // 2. Validate that source is a video (MuseTalk only accepts videos)
        const sourceUrl = data.source_url;
        
        if (sourceUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
          return new Response(
            JSON.stringify({ 
              error: 'MuseTalk nécessite une VIDEO, pas une image',
              code: 'INVALID_SOURCE_TYPE',
              message: 'Veuillez uploader une courte vidéo (MP4, WebM, MOV) de votre avatar au lieu d\'une image. La vidéo peut faire seulement quelques secondes - elle sera utilisée comme base pour l\'animation.'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // 3. Submit job to FAL AI asynchronously (non-blocking)
        console.log('🎬 Submitting async job to FAL AI MuseTalk...');
        console.log('📋 Source URL:', sourceUrl);
        console.log('📋 Audio URL length:', audioData?.substring(0, 100));
        
        const { request_id } = await fal.queue.submit("fal-ai/musetalk", {
          input: {
            source_video_url: sourceUrl,
            audio_url: audioData
          }
        }) as any;

        console.log('✅ Job submitted with request_id:', request_id);

        return new Response(
          JSON.stringify({ request_id }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      case 'check_status':
        const { request_id: checkId } = data;
        console.log('🔍 Checking status for request_id:', checkId);
        
        const status = await fal.queue.status("fal-ai/musetalk", {
          requestId: checkId,
          logs: true
        }) as any;

        console.log('📊 Status:', status.status);
        
        if (status.status === 'COMPLETED') {
          const result = await fal.queue.result("fal-ai/musetalk", {
            requestId: checkId
          }) as any;
          
          console.log('✅ Result received:', JSON.stringify(result, null, 2));
          
          const videoUrl = result.data?.video?.url;
          
          if (!videoUrl) {
            throw new Error('No video URL in result');
          }

          return new Response(
            JSON.stringify({ 
              status: 'COMPLETED',
              videoUrl 
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ 
            status: status.status,
            logs: status.logs
          }),
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
