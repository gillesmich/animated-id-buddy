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
      return new Response(
        JSON.stringify({ 
          error: 'MuseTalk server not configured',
          code: 'NOT_CONFIGURED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Add https:// if no protocol specified
    if (!musetalkUrl.startsWith('http://') && !musetalkUrl.startsWith('https://')) {
      musetalkUrl = `https://${musetalkUrl}`;
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
        
        // 2. Try multiple possible endpoints
        const possibleEndpoints = [
          '/api/generate',    // Most common with nginx
          '/generate',        // Direct Flask route
          '/api/generate-video',
          ':5000/generate',   // Direct port access
        ];
        
        const requestBody = JSON.stringify({
          image_url: data.source_url,
          audio_url: audioData,
          bbox_shift: data.config?.bbox_shift || 0
        });

        let generateResponse = null;
        let successfulEndpoint = null;

        // Try each endpoint until one works
        for (const testEndpoint of possibleEndpoints) {
          const testUrl = testEndpoint.startsWith(':') 
            ? `${musetalkUrl.replace(/:\d+$/, '')}${testEndpoint}`
            : `${musetalkUrl}${testEndpoint}`;
          
          console.log(`🔍 Testing endpoint: ${testUrl}`);
          
          try {
            const response = await fetch(testUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
            });

            if (response.ok || response.status === 202) {
              generateResponse = response;
              successfulEndpoint = testUrl;
              console.log(`✅ Endpoint works: ${testUrl}`);
              break;
            } else {
              console.log(`❌ ${testUrl} returned ${response.status}`);
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.log(`❌ ${testUrl} failed: ${errorMsg}`);
          }
        }

        if (!generateResponse) {
          throw new Error(
            `All endpoints failed. Tried: ${possibleEndpoints.join(', ')}. ` +
            `Please verify your MuseTalk server is running and nginx is configured correctly. ` +
            `Common fix: Add 'proxy_pass http://127.0.0.1:5000;' to nginx config for location /api/`
          );
        }

        const generateResult = await generateResponse.json();
        const taskId = generateResult.task_id;
        console.log(`✅ Task created: ${taskId} via ${successfulEndpoint}`);

        // 3. Poll status until completed (max 2 minutes)
        const baseUrl = successfulEndpoint!.replace(/\/[^\/]+$/, ''); // Remove endpoint from URL
        const maxAttempts = 60;
        let attempts = 0;
        let videoUrl = null;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(`${baseUrl}/status/${taskId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log(`Status ${attempts + 1}: ${status.status}`);

            if (status.status === 'completed') {
              videoUrl = `${baseUrl}/download/${taskId}`;
              break;
            } else if (status.status === 'failed') {
              throw new Error(`Task failed: ${status.error || 'Unknown error'}`);
            }
          }

          attempts++;
        }

        if (!videoUrl) {
          throw new Error('Video generation timeout after 2 minutes');
        }

        return new Response(JSON.stringify({ 
          id: taskId,
          result_url: videoUrl,
          status: 'completed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

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

    // For download action, return the video blob directly
    if (action === 'download') {
      const videoBlob = await response.blob();
      return new Response(videoBlob, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${data.taskId}.mp4"`
        },
      });
    }

    // For other actions, return JSON
    const result = await response.json();
    console.log('MuseTalk API success');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in musetalk-avatar function:', error);
    
    let userFriendlyMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide clearer error messages for connection issues
    if (error instanceof Error && error.message.includes('Connection refused')) {
      userFriendlyMessage = 'Cannot connect to MuseTalk server. Please ensure your MuseTalk server is running and accessible at the configured URL. Check that the MUSETALK_API_URL environment variable is correct and that the server is not blocked by a firewall.';
    } else if (error instanceof Error && error.message.includes('MUSETALK_API_URL not configured')) {
      userFriendlyMessage = 'MuseTalk server URL is not configured. Please set the MUSETALK_API_URL environment variable in your backend settings.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userFriendlyMessage,
        details: error instanceof Error ? error.stack : undefined,
        troubleshooting: 'Verify that: 1) MuseTalk server is running, 2) Server URL is correct in backend settings, 3) Server is accessible from the internet, 4) No firewall is blocking the connection'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
