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
    console.log(`MuseTalk FAL AI call: ${action}`);
    
    const falApiKey = Deno.env.get('FAL_API_KEY');
    console.log('FAL_API_KEY present:', !!falApiKey, 'Length:', falApiKey?.length);
    
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

    switch (action) {
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
        
        // 2. Submit request to FAL AI Queue
        console.log('🎬 Submitting to FAL AI queue...');
        
        const submitResponse = await fetch('https://queue.fal.run/fal-ai/musetalk', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: data.source_url,
            audio_url: audioData,
            bbox_shift: data.config?.bbox_shift || 0
          }),
        });

        if (!submitResponse.ok) {
          const errorText = await submitResponse.text();
          console.error('FAL API error:', errorText);
          
          if (submitResponse.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          } else if (submitResponse.status === 402) {
            throw new Error('Insufficient FAL AI credits. Please top up your account.');
          }
          
          throw new Error(`FAL API error: ${submitResponse.status} - ${errorText}`);
        }

        const submitData = await submitResponse.json();
        const requestId = submitData.request_id;
        console.log('✅ Request submitted:', requestId);

        // 3. Poll for result
        console.log('📊 Polling for result...');
        let videoUrl = null;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (attempts < maxAttempts && !videoUrl) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          
          const statusResponse = await fetch(`https://queue.fal.run/fal-ai/musetalk/requests/${requestId}/status`, {
            headers: {
              'Authorization': `Key ${falApiKey}`,
            },
          });
          
          if (!statusResponse.ok) {
            throw new Error(`Failed to check status: ${statusResponse.status}`);
          }
          
          const statusData = await statusResponse.json();
          console.log(`Status (${attempts}/${maxAttempts}):`, statusData.status);
          
          if (statusData.status === 'COMPLETED') {
            // FAL AI queue API includes result data directly in status when completed
            console.log('✅ Request completed');
            console.log('📦 Full status data:', JSON.stringify(statusData, null, 2));
            
            // Check if result is embedded in the status response
            videoUrl = statusData.data?.video?.url || 
                      statusData.output?.video?.url ||
                      statusData.video?.url;
            
            if (!videoUrl) {
              console.error('❌ No video URL found');
              console.error('Status data keys:', Object.keys(statusData));
              console.error('Trying alternative: checking if data is elsewhere...');
              
              // Sometimes the result might be in a different structure
              // Let's log everything to debug
              for (const [key, value] of Object.entries(statusData)) {
                console.log(`  ${key}:`, typeof value === 'object' ? JSON.stringify(value) : value);
              }
              
              throw new Error('Video URL not found in status response');
            }
            
            console.log('✅ Video URL:', videoUrl);
          } else if (statusData.status === 'FAILED') {
            throw new Error(`FAL AI generation failed: ${statusData.error || 'Unknown error'}`);
          }
        }
        
        if (!videoUrl) {
          throw new Error('Timeout waiting for FAL AI video generation');
        }

        console.log('✅ Video generated:', videoUrl);

        return new Response(JSON.stringify({ 
          id: requestId,
          result_url: videoUrl,  // Return the actual video URL, not the request endpoint
          status: 'completed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in musetalk-avatar function:', error);
    
    let userFriendlyMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: userFriendlyMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
