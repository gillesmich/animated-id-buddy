import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, Code2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface PythonBackendGeneratorProps {
  config: {
    openaiKey: string;
    elevenlabsKey: string;
    didKey: string;
    model: string;
    voiceId: string;
  };
}

const PythonBackendGenerator = ({ config }: PythonBackendGeneratorProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generatePythonCode = () => {
    return `# Avatar AI Backend - Python Flask
# Installation: pip install flask openai elevenlabs requests python-dotenv

from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import requests
import base64
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '${config.openaiKey}')
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY', '${config.elevenlabsKey}')
DID_API_KEY = os.getenv('DID_API_KEY', '${config.didKey}')
MODEL = '${config.model || 'gpt-4o-mini'}'
VOICE_ID = '${config.voiceId || '9BWtsMINqrJLrRacOk9x'}'

openai.api_key = OPENAI_API_KEY

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        avatar_id = data.get('avatarId', '')
        
        # Step 1: Generate AI response with OpenAI
        response = openai.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI avatar assistant. Keep responses concise and natural for voice interaction."
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        ai_text = response.choices[0].message.content
        
        # Step 2: Generate speech with ElevenLabs
        tts_response = requests.post(
            f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}',
            headers={
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'text': ai_text,
                'model_id': 'eleven_multilingual_v2',
                'voice_settings': {
                    'stability': 0.5,
                    'similarity_boost': 0.75
                }
            }
        )
        
        if tts_response.status_code != 200:
            return jsonify({'error': 'ElevenLabs TTS failed'}), 500
            
        audio_data = base64.b64encode(tts_response.content).decode('utf-8')
        
        # Step 3: Create D-ID avatar video
        did_response = requests.post(
            'https://api.d-id.com/talks',
            headers={
                'Authorization': f'Basic {DID_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'source_url': avatar_id,
                'script': {
                    'type': 'audio',
                    'audio_url': f'data:audio/mpeg;base64,{audio_data}'
                },
                'config': {
                    'fluent': True,
                    'pad_audio': 0
                }
            }
        )
        
        if did_response.status_code != 201:
            return jsonify({'error': 'D-ID video creation failed'}), 500
            
        did_data = did_response.json()
        
        return jsonify({
            'success': True,
            'text': ai_text,
            'talkId': did_data.get('id'),
            'status': did_data.get('status'),
            'resultUrl': did_data.get('result_url')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<talk_id>', methods=['GET'])
def check_status(talk_id):
    """Check D-ID video generation status"""
    try:
        response = requests.get(
            f'https://api.d-id.com/talks/{talk_id}',
            headers={
                'Authorization': f'Basic {DID_API_KEY}'
            }
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Status check failed'}), 500
            
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'version': '1.0.0'})

if __name__ == '__main__':
    # Pour production, utilisez gunicorn:
    # gunicorn -w 4 -b 0.0.0.0:8000 app:app
    app.run(host='0.0.0.0', port=8000, debug=False)
`;
  };

  const generateRequirements = () => {
    return `# requirements.txt
flask==3.0.0
flask-cors==4.0.0
openai==1.12.0
elevenlabs==0.2.27
requests==2.31.0
python-dotenv==1.0.0
gunicorn==21.2.0
`;
  };

  const generateEnvTemplate = () => {
    return `# .env
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
DID_API_KEY=your_did_key_here
`;
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Copié!",
      description: "Code copié dans le presse-papier",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = () => {
    // Download app.py
    const appBlob = new Blob([generatePythonCode()], { type: "text/plain" });
    const appUrl = URL.createObjectURL(appBlob);
    const appLink = document.createElement("a");
    appLink.href = appUrl;
    appLink.download = "app.py";
    appLink.click();
    URL.revokeObjectURL(appUrl);

    // Download requirements.txt
    setTimeout(() => {
      const reqBlob = new Blob([generateRequirements()], { type: "text/plain" });
      const reqUrl = URL.createObjectURL(reqBlob);
      const reqLink = document.createElement("a");
      reqLink.href = reqUrl;
      reqLink.download = "requirements.txt";
      reqLink.click();
      URL.revokeObjectURL(reqUrl);
    }, 100);

    // Download .env template
    setTimeout(() => {
      const envBlob = new Blob([generateEnvTemplate()], { type: "text/plain" });
      const envUrl = URL.createObjectURL(envBlob);
      const envLink = document.createElement("a");
      envLink.href = envUrl;
      envLink.download = ".env.example";
      envLink.click();
      URL.revokeObjectURL(envUrl);
    }, 200);

    toast({
      title: "Téléchargement!",
      description: "Fichiers Python backend téléchargés",
    });
  };

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" />
          Backend Python (Alternative à n8n)
        </h3>
        <p className="text-sm text-muted-foreground">
          Code Python Flask pour gérer l'avatar sans n8n
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 max-h-96 overflow-auto">
          <pre className="text-xs">
            <code className="text-accent">
              {generatePythonCode()}
            </code>
          </pre>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handleCopy(generatePythonCode())}
            className="flex-1"
            variant="outline"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copié
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copier Code
              </>
            )}
          </Button>
          <Button onClick={handleDownloadAll} className="flex-1 gradient-primary">
            <Download className="w-4 h-4 mr-2" />
            Télécharger Tout
          </Button>
        </div>

        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-accent">Instructions d'installation:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Installez Python 3.9+ sur votre serveur</li>
            <li>Téléchargez les fichiers (app.py, requirements.txt, .env)</li>
            <li>Exécutez: <code className="bg-secondary/50 px-2 py-1 rounded">pip install -r requirements.txt</code></li>
            <li>Configurez vos clés API dans le fichier .env</li>
            <li>Lancez: <code className="bg-secondary/50 px-2 py-1 rounded">python app.py</code></li>
            <li>Pour production: <code className="bg-secondary/50 px-2 py-1 rounded">gunicorn -w 4 -b 0.0.0.0:8000 app:app</code></li>
          </ol>
        </div>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold">Endpoints disponibles:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><code className="text-primary">POST /api/chat</code> - Traiter un message</li>
            <li><code className="text-primary">GET /api/status/:id</code> - Vérifier statut vidéo</li>
            <li><code className="text-primary">GET /health</code> - Health check</li>
          </ul>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">⚠️ Déploiement recommandé:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Utilisez un service comme Railway, Render, ou AWS</li>
            <li>Configurez HTTPS pour sécuriser les clés API</li>
            <li>Ajoutez un rate limiting pour éviter les abus</li>
            <li>Surveillez les logs et les erreurs</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default PythonBackendGenerator;
