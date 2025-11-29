# 🚀 Optimisations MuseTalk Backend

## Problème actuel
La génération vidéo reste bloquée à 65% pendant ~50 secondes (étape `avatar_generation`).

## ✅ Optimisations à appliquer dans `musetalk_backend_debug-2.py`

### 1. **Réduire le FPS** (ligne 385)
```python
# AVANT
"--fps", "25",

# APRÈS - gain ~30% de vitesse
"--fps", "15",
```

### 2. **Réduire le batch_size** (ligne 386)
```python
# AVANT
"--batch_size", "4",

# APRÈS - gain ~20% de vitesse, moins de VRAM
"--batch_size", "2",
```

### 3. **Optimiser la conversion audio** (lignes 239-244)
```python
# AVANT
subprocess.run(
    ['ffmpeg', '-y', '-i', str(tts_path), '-ar', '16000', str(tts_wav)],
    check=True,
    capture_output=True,
    text=True
)

# APRÈS - conversion plus rapide
subprocess.run(
    ['ffmpeg', '-y', '-i', str(tts_path), 
     '-ar', '16000',
     '-ac', '1',           # mono
     '-acodec', 'pcm_s16le',
     '-threads', '2',       # parallélisation
     str(tts_wav)],
    check=True,
    capture_output=True,
    text=True
)
```

### 4. **Limiter la longueur de réponse GPT** (ligne 223)
```python
# AVANT
max_tokens=150,

# APRÈS - réponses plus courtes = vidéo plus courte
max_tokens=100,
```

### 5. **Ajouter un timeout MuseTalk** (après ligne 392)
```python
completed = subprocess.run(
    cmd,
    capture_output=True,
    text=True,
    cwd=str(MUSETALK_DIR),
    timeout=120  # ⚡️ Timeout de 2 minutes max
)
```

### 6. **Nettoyer les anciens fichiers** (ligne 357)
```python
# Améliorer le nettoyage pour éviter l'accumulation
for old in result_dir.glob("*.mp4"):
    if (datetime.now().timestamp() - old.stat().st_mtime) > 3600:  # 1h
        old.unlink()
```

## 📊 Gains estimés

| Optimisation | Gain temps | Gain VRAM |
|-------------|-----------|----------|
| FPS 25→15 | ~30% | - |
| Batch 4→2 | ~20% | ~40% |
| Audio optimisé | ~5% | - |
| Tokens 150→100 | ~15% | - |
| **TOTAL** | **~50-60%** | **~40%** |

**Temps estimé après optimisation: 20-25 secondes** au lieu de 50 secondes.

## 🎯 Configuration recommandée complète

```python
cmd = [
    "python3",
    "-m", "scripts.inference",
    "--inference_config", str(cfg_path),
    "--result_dir", str(result_dir),
    "--unet_model_path", "models/musetalkV15/unet.pth",
    "--unet_config", "models/musetalkV15/musetalk.json",
    "--version", "v15",
    "--fps", "15",              # ⚡️ Réduit
    "--batch_size", "2",        # ⚡️ Réduit
    "--use_float16",
    "--ffmpeg_path", "/usr/bin/ffmpeg"
]
```

## 🔧 Vérifications Docker

Assurez-vous que le conteneur a:
- **GPU activé** : `docker run --gpus all`
- **Mémoire suffisante** : au moins 4GB RAM
- **CUDA disponible** : vérifier avec `nvidia-smi`

## 📝 Script de test de performance

Ajoutez dans le backend pour mesurer:

```python
import time

# Avant run_musetalk_local
start = time.time()

# ... appel MuseTalk ...

duration = time.time() - start
logger.info(f"⏱️ MuseTalk generation time: {duration:.2f}s")
socketio.emit('performance', {'generation_time': duration}, room=client_id)
```

## 🎬 Optimisations avancées (si besoin)

1. **Précharger le modèle** : charger une fois au démarrage
2. **Cache des avatars** : éviter de retraiter le même avatar
3. **Queue de traitement** : traiter plusieurs requêtes en parallèle
4. **Streaming progressif** : envoyer la vidéo frame par frame

## 🐛 Debug

Activez les logs de timing dans MuseTalk:
```python
logger.setLevel(logging.DEBUG)
```
