import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, Workflow } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface N8nWorkflowGeneratorProps {
  config: {
    selectedWorkflow: string;
    workflows: Array<{ id: string; name: string; webhookUrl: string }>;
  };
}

const N8nWorkflowGenerator = ({ config }: N8nWorkflowGeneratorProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateWorkflowJSON = () => {
    const selectedWorkflowData = config.workflows.find(
      (w) => w.id === config.selectedWorkflow
    );

    return {
      name: selectedWorkflowData?.name || "Avatar AI Workflow",
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: "avatar-webhook",
            responseMode: "responseNode",
            options: {}
          },
          id: "webhook-node",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [250, 300],
          webhookId: crypto.randomUUID()
        },
        {
          parameters: {
            assignments: {
              assignments: [
                {
                  id: crypto.randomUUID(),
                  name: "userMessage",
                  value: "={{ $json.message }}",
                  type: "string"
                },
                {
                  id: crypto.randomUUID(),
                  name: "avatarId",
                  value: "={{ $json.avatarId }}",
                  type: "string"
                },
                {
                  id: crypto.randomUUID(),
                  name: "voiceId",
                  value: "={{ $json.voiceId }}",
                  type: "string"
                }
              ]
            },
            options: {}
          },
          id: "extract-data",
          name: "Extract Input Data",
          type: "n8n-nodes-base.set",
          typeVersion: 3,
          position: [470, 300]
        },
        {
          parameters: {
            authentication: "headerAuth",
            requestMethod: "POST",
            url: "https://api.openai.com/v1/chat/completions",
            sendBody: true,
            specifyBody: "json",
            jsonBody: `={
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI avatar assistant. Keep responses concise and natural for voice interaction."
    },
    {
      "role": "user",
      "content": "{{ $json.userMessage }}"
    }
  ],
  "max_tokens": 150,
  "temperature": 0.7
}`,
            options: {}
          },
          id: "openai-request",
          name: "OpenAI Request",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [690, 300],
          credentials: {
            httpHeaderAuth: {
              id: "openai-header-auth",
              name: "OpenAI Header Auth"
            }
          }
        },
        {
          parameters: {
            jsCode: `const response = $input.item.json;
const aiMessage = response.choices[0].message.content;

return {
  json: {
    text: aiMessage,
    avatarId: $('Extract Input Data').item.json.avatarId,
    voiceId: $('Extract Input Data').item.json.voiceId,
    timestamp: new Date().toISOString()
  }
};`
          },
          id: "process-response",
          name: "Process AI Response",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [910, 300]
        },
        {
          parameters: {
            authentication: "headerAuth",
            requestMethod: "POST",
            url: "https://api.elevenlabs.io/v1/text-to-speech/{{ $json.voiceId }}",
            sendBody: true,
            specifyBody: "json",
            jsonBody: `={
  "text": "{{ $json.text }}",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}`,
            options: {
              response: {
                response: {
                  responseFormat: "file"
                }
              }
            }
          },
          id: "elevenlabs-tts",
          name: "ElevenLabs TTS",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [1130, 300],
          credentials: {
            httpHeaderAuth: {
              id: "elevenlabs-header-auth",
              name: "ElevenLabs Header Auth"
            }
          }
        },
        {
          parameters: {
            authentication: "headerAuth",
            requestMethod: "POST",
            url: "https://api.d-id.com/talks",
            sendBody: true,
            specifyBody: "json",
            jsonBody: `={
  "source_url": "{{ $('Extract Input Data').item.json.avatarId }}",
  "script": {
    "type": "audio",
    "audio_url": "data:audio/mpeg;base64,{{ $binary.data.data }}"
  },
  "config": {
    "fluent": true,
    "pad_audio": 0
  }
}`,
            options: {}
          },
          id: "did-create-talk",
          name: "D-ID Create Talk",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [1350, 300],
          credentials: {
            httpHeaderAuth: {
              id: "did-header-auth",
              name: "D-ID Header Auth"
            }
          }
        },
        {
          parameters: {
            respondWith: "json",
            responseBody: `={
  "success": true,
  "talkId": "{{ $json.id }}",
  "status": "{{ $json.status }}",
  "resultUrl": "{{ $json.result_url }}",
  "message": "Avatar video generation initiated"
}`
          },
          id: "webhook-response",
          name: "Respond to Webhook",
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1,
          position: [1570, 300]
        }
      ],
      connections: {
        "Webhook": {
          main: [[{ node: "Extract Input Data", type: "main", index: 0 }]]
        },
        "Extract Input Data": {
          main: [[{ node: "OpenAI Request", type: "main", index: 0 }]]
        },
        "OpenAI Request": {
          main: [[{ node: "Process AI Response", type: "main", index: 0 }]]
        },
        "Process AI Response": {
          main: [[{ node: "ElevenLabs TTS", type: "main", index: 0 }]]
        },
        "ElevenLabs TTS": {
          main: [[{ node: "D-ID Create Talk", type: "main", index: 0 }]]
        },
        "D-ID Create Talk": {
          main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]]
        }
      },
      settings: {
        executionOrder: "v1"
      },
      staticData: null,
      tags: [],
      triggerCount: 0,
      updatedAt: new Date().toISOString(),
      versionId: crypto.randomUUID()
    };
  };

  const handleCopy = () => {
    const json = JSON.stringify(generateWorkflowJSON(), null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    toast({
      title: "Copié!",
      description: "Workflow JSON copié dans le presse-papier",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const json = JSON.stringify(generateWorkflowJSON(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "avatar-ai-workflow.json";
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Téléchargé!",
      description: "Workflow JSON téléchargé avec succès",
    });
  };

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Workflow className="w-5 h-5 text-primary" />
          Générateur de Workflow n8n
        </h3>
        <p className="text-sm text-muted-foreground">
          Exportez la configuration workflow pour l'importer dans n8n
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 max-h-96 overflow-auto">
          <pre className="text-xs">
            <code className="text-accent">
              {JSON.stringify(generateWorkflowJSON(), null, 2)}
            </code>
          </pre>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCopy} className="flex-1" variant="outline">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copié
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copier JSON
              </>
            )}
          </Button>
          <Button onClick={handleDownload} className="flex-1 gradient-primary">
            <Download className="w-4 h-4 mr-2" />
            Télécharger
          </Button>
        </div>

        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-accent">Instructions d'import:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Ouvrez votre instance n8n</li>
            <li>Cliquez sur "Import from File" ou "Import from Clipboard"</li>
            <li>Collez ou sélectionnez le JSON généré</li>
            <li>Configurez vos credentials (OpenAI, ElevenLabs, D-ID)</li>
            <li>Activez le workflow et testez-le</li>
          </ol>
        </div>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold">Fonctionnalités du workflow:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Réception de messages via webhook</li>
            <li>Traitement par OpenAI (GPT-4o-mini)</li>
            <li>Génération vocale via ElevenLabs</li>
            <li>Création vidéo d'avatar via D-ID</li>
            <li>Réponse automatique avec URL de la vidéo</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default N8nWorkflowGenerator;