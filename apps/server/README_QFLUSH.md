# QFlush/A11-Supervisor Integration

## 🎯 Qu'est-ce que c'est ?

Un système de supervision de processus intégré dans A11 qui gère automatiquement **tous les services A11**:
- **Cerbère** (LLM Router) sur port 4545
- **LLaMA Server** sur port 8000
- **TTS Service** (Piper) sur port 5002
- **Frontend** (Vite) sur port 5173 (dev uniquement)
- **Backend** (server.cjs) sur port 3000

Avec auto-restart, logging détaillé, et monitoring en temps réel.

## ⚡ Quick Start

### Installation (déjà fait)
```bash
npm install @funeste38/qflush
```

### Lancer tous les services avec supervision
```bash
# Démarre le backend qui lance automatiquement les autres services
cd D:\A11\apps\server
node server.cjs
```

### Vérifier le status de tous les services
```bash
curl http://127.0.0.1:3000/api/qflush/status
```

Exemple de réponse:
```json
{
  "available": true,
  "initialized": true,
  "supervisor": {
    "config": {
      "maxRestarts": 3,
      "restartDelay": 3000
    }
  },
  "processes": {
    "cerbere": {
      "status": "running",
      "pid": 12345,
      "restarts": 0,
      "uptime": "45.23",
      "autoRestart": true
    },
    "llama-server": {
      "status": "running",
      "pid": 12346,
      "restarts": 0,
      "uptime": "44.12",
      "autoRestart": true
    },
    "tts-service": {
      "status": "running",
      "pid": 12347,
      "restarts": 0,
      "uptime": "43.56",
      "autoRestart": true
    }
  }
}
```

## 📊 Status actuel

✅ **Module installé**: `@funeste38/qflush`  
✅ **Superviseur créé**: `apps/server/src/a11-supervisor.cjs`  
✅ **Intégration active**: Le serveur affiche `[QFLUSH] @funeste38/qflush module loaded successfully`  
✅ **Endpoint disponible**: `/api/qflush/status`  
✅ **Services gérés**: Cerbère, LLaMA, TTS, Frontend (dev)

## 🔧 Configuration

### Variables d'environnement pour activer/désactiver les services

```bash
# .env ou .env.local

# Gestion de Cerbère (LLM Router)
MANAGE_CERBERE=true              # Gérer Cerbère automatiquement
LLM_ROUTER_URL=http://127.0.0.1:4545  # URL de Cerbère

# Gestion de LLaMA Server
MANAGE_LLAMA_SERVER=true         # Gérer llama-server automatiquement
LLAMA_BASE=                      # Laisser vide pour gestion auto

# Gestion du service TTS
MANAGE_TTS=true                  # Gérer le service TTS automatiquement

# Gestion du Frontend (développement uniquement)
MANAGE_FRONTEND=true             # Gérer Vite dev server
NODE_ENV=development             # Requis pour frontend supervision

# Configuration du superviseur
MAX_RESTARTS=3                   # Nombre max de redémarrages auto
RESTART_DELAY=3000               # Délai entre redémarrages (ms)
```

### Désactiver la supervision complète

Si vous voulez gérer les services manuellement (avec `start_cerbere.ps1` par exemple):

```bash
# .env
MANAGE_CERBERE=false
MANAGE_LLAMA_SERVER=false
MANAGE_TTS=false
MANAGE_FRONTEND=false
```

### Mode hybride: supervision partielle

```bash
# Ne gérer que Cerbère et LLaMA, pas TTS ni Frontend
MANAGE_CERBERE=true
MANAGE_LLAMA_SERVER=true
MANAGE_TTS=false
MANAGE_FRONTEND=false
```

## 🎮 Contrôle des services via API

### Endpoint de status
```bash
GET /api/qflush/status
```

Retourne l'état de tous les services supervisés.

### Redémarrer un service (TODO)
```bash
POST /api/qflush/restart
Content-Type: application/json

{
  "service": "cerbere"
}
```

### Arrêter un service (TODO)
```bash
POST /api/qflush/stop
Content-Type: application/json

{
  "service": "tts-service"
}
```

## 📖 Architecture

```
A11 Backend (server.cjs)
    │
    ├─> A11-Supervisor
    │       │
    │       ├─> Cerbère (port 4545)
    │       │   └─> LLM Router: OpenAI, Anthropic, local models
    │       │
    │       ├─> LLaMA Server (port 8000)
    │       │   └─> Local LLM inference
    │       │
    │       ├─> TTS Service (port 5002)
    │       │   └─> Piper text-to-speech
    │       │
    │       └─> Frontend Vite (port 5173) [dev only]
    │           └─> React + TypeScript UI
    │
    └─> Express API (port 3000)
        ├─> /api/qflush/status
        ├─> /v1/chat/completions
        ├─> /api/tts/speak
        └─> ... autres endpoints
```

## 📁 Logs

Les logs de chaque service sont dans:
```
D:\A11\apps\logs\supervisor\
├── cerbere.log
├── llama-server.log
├── tts-service.log
└── frontend-vite.log
```

### Voir les logs en temps réel
```powershell
# Cerbère
Get-Content D:\A11\apps\logs\supervisor\cerbere.log -Wait

# LLaMA
Get-Content D:\A11\apps\logs\supervisor\llama-server.log -Wait

# TTS
Get-Content D:\A11\apps\logs\supervisor\tts-service.log -Wait
```

## 🎯 Cas d'usage

### 1. Développement complet avec auto-restart
```bash
# Tous les services gérés automatiquement
node server.cjs
```

Si Cerbère crash → redémarre automatiquement (max 3 fois)  
Si LLaMA crash → redémarre automatiquement  
Si TTS crash → redémarre automatiquement

### 2. Production avec services externes
```bash
# .env
MANAGE_CERBERE=false
MANAGE_LLAMA_SERVER=false
MANAGE_TTS=false

# Lance juste le backend
node server.cjs
```

### 3. Utiliser start_cerbere.ps1 (ancien mode)
```bash
# .env
MANAGE_CERBERE=false
MANAGE_LLAMA_SERVER=false
MANAGE_TTS=false
MANAGE_FRONTEND=false

# Lance les services manuellement
.\start_cerbere.ps1
```

## 🐛 Dépannage

### Le superviseur ne lance aucun service

Vérifiez dans les logs:
```
[Supervisor] Using LLM Router - not managing llama-server
[Supervisor] Cerbère management disabled (MANAGE_CERBERE=false)
```

**Solution**: Activez la gestion dans `.env`:
```bash
MANAGE_CERBERE=true
MANAGE_LLAMA_SERVER=true
MANAGE_TTS=true
```

### Cerbère ne démarre pas

Vérifiez que le fichier existe:
```bash
Test-Path D:\A11\apps\server\llm-router.mjs
```

### TTS ne démarre pas

Vérifiez que Python et le script existent:
```bash
Test-Path D:\A11\tts\serve.py
python --version
```

### Conflit de ports

Si un service est déjà en cours:
```bash
# Trouver le processus sur le port 4545
netstat -ano | findstr :4545

# Tuer le processus (remplacer PID)
Stop-Process -Id <PID> -Force
```

## 📚 Documentation complémentaire

- **Guide complet**: [`QFLUSH_SUCCESS.md`](./QFLUSH_SUCCESS.md)
- **Documentation technique**: [`QFLUSH_INTEGRATION.md`](./QFLUSH_INTEGRATION.md)
- **Code du superviseur**: [`src/a11-supervisor.cjs`](./src/a11-supervisor.cjs)
- **Module d'intégration**: [`src/qflush-integration.cjs`](./src/qflush-integration.cjs)

## 🎉 Résultat

Le message suivant dans les logs confirme que l'intégration fonctionne:

```
[QFLUSH] @funeste38/qflush module loaded successfully
[Supervisor] Registering Cerbère (LLM Router) for supervision
[Supervisor] Registering llama-server for supervision
[Supervisor] Registering TTS service for supervision
```

**QFlush gère maintenant tous vos services A11 ! 🚀**

---

## 🔗 Liens utiles

- **Start all services manually**: `start_cerbere.ps1`
- **Cerbère (LLM Router)**: http://127.0.0.1:4545
- **Backend A11**: http://127.0.0.1:3000
- **Frontend**: http://127.0.0.1:5173
- **LLaMA Server**: http://127.0.0.1:8000
- **TTS Service**: http://127.0.0.1:5002
