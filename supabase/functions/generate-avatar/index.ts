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
    const { prompt, type = 'image' } = await req.json();
    console.log(`🎨 Generating ${type} for prompt:`, prompt);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'LOVABLE_API_KEY not configured',
          code: 'NOT_CONFIGURED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (type === 'image') {
      // Generate image using Lovable AI
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: `Generate a high-quality avatar image: ${prompt}. The image should be suitable for use as a profile picture or avatar, with clear facial features and good lighting.`
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageUrl) {
        throw new Error('No image generated');
      }

      console.log('✅ Image generated successfully');
      
      return new Response(
        JSON.stringify({ 
          imageUrl,
          success: true 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } else if (type === 'video') {
      // First generate an image, then animate it
      console.log('📹 Generating video: Step 1 - Creating base image');
      
      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: `Generate a high-quality avatar image: ${prompt}. The image should be expressive and suitable for animation, with clear facial features.`
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to generate base image: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      const baseImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!baseImageUrl) {
        throw new Error('No base image generated for video');
      }

      console.log('✅ Base image created, now animating...');

      // Import FAL AI client
      const { fal } = await import("npm:@fal-ai/client@1.7.2");
      const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
      
      if (!FAL_API_KEY) {
        // Return just the image if FAL is not configured
        console.log('⚠️ FAL_API_KEY not configured, returning static image');
        return new Response(
          JSON.stringify({ 
            imageUrl: baseImageUrl,
            videoUrl: null,
            success: true,
            warning: 'Video animation not available - FAL_API_KEY not configured'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      fal.config({ credentials: FAL_API_KEY });

      // Animate the image
      const result = await fal.subscribe("fal-ai/fast-svd", {
        input: {
          image_url: baseImageUrl,
          motion_bucket_id: 60,
          fps: 12,
          cond_aug: 0.02
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log('📊 Animation progress:', update.status);
          }
        },
      });

      const videoUrl = result.data?.video?.url;
      
      if (!videoUrl) {
        throw new Error('No video URL in result');
      }

      console.log('✅ Video generated successfully');
      
      return new Response(
        JSON.stringify({ 
          imageUrl: baseImageUrl,
          videoUrl,
          success: true 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Use "image" or "video"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
