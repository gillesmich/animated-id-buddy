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
    const { image_url, animation_type = 'subtle' } = await req.json();
    console.log(`🎬 Animation request: ${animation_type}`);
    
    const falApiKey = Deno.env.get('FAL_API_KEY');
    
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

    fal.config({ credentials: falApiKey });

    console.log('🖼️ Processing image:', image_url);
    
    // Use stable-video for subtle animations
    const result = await fal.subscribe("fal-ai/fast-svd", {
      input: {
        image_url: image_url,
        motion_bucket_id: 40, // Lower value = more subtle motion
        fps: 8,
        cond_aug: 0.02
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('📊 Animation progress:', update.status);
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    console.log('✅ Animation result:', JSON.stringify(result.data, null, 2));
    
    const videoUrl = result.data?.video?.url;
    
    if (!videoUrl) {
      throw new Error('No video URL in result');
    }

    // Return both video and GIF URLs (some models output both)
    const gifUrl = result.data?.gif?.url || videoUrl;
    
    return new Response(
      JSON.stringify({ 
        videoUrl,
        gifUrl,
        success: true 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

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
