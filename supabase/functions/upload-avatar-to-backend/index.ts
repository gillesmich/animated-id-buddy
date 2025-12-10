import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { avatar_url, save_as = 'sample.mp4' } = await req.json();
    
    if (!avatar_url) {
      return new Response(
        JSON.stringify({ error: 'avatar_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MUSETALK_BACKEND = Deno.env.get('MUSETALK_BACKEND') || 'http://51.255.153.127:5000';
    
    console.log(`[UploadAvatar] Downloading from: ${avatar_url}`);
    console.log(`[UploadAvatar] Will save as: ${save_as}`);
    
    // Step 1: Download the video from Supabase Storage
    const downloadResponse = await fetch(avatar_url);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download video: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }
    
    const videoBlob = await downloadResponse.blob();
    console.log(`[UploadAvatar] Downloaded ${videoBlob.size} bytes, type: ${videoBlob.type}`);
    
    if (videoBlob.size === 0) {
      throw new Error('Downloaded video is empty');
    }

    // Step 2: Upload to MuseTalk backend
    const formData = new FormData();
    formData.append('file', videoBlob, save_as);
    formData.append('save_as', save_as);
    
    const uploadUrl = `${MUSETALK_BACKEND}/upload_avatar`;
    console.log(`[UploadAvatar] Uploading to: ${uploadUrl}`);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`[UploadAvatar] Backend error: ${uploadResponse.status}`, errorText);
      throw new Error(`Backend upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const result = await uploadResponse.json();
    console.log(`[UploadAvatar] Success:`, result);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Avatar uploaded as ${save_as}`,
        backend_response: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error(`[UploadAvatar] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to upload avatar', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
