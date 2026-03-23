# QFlush Integration dans A11

## ✅ Ce qui a été fait

### 1. Installation du package
```bash
npm install @funeste38/qflush --save
```
Package installé avec succès dans `apps/server/node_modules/@funeste38/qflush`

### 2. Création du module d'intégration
Fichier créé: `apps/server/src/qflush-integration.cjs`

Ce module fournit:
- `initQFlush(options)` - Initialise un superviseur QFlush
- `registerProcess(supervisor, config)` - Enregistre un processus
- `startProcess(supervisor, name)` - Démarre un processus
- `stopProcess(supervisor, name)` - Arrête un processus
- `getStatus(supervisor)` - Récupère le statut
- `setupA11Supervisor()` - Configure automatiquement les services A11

### 3. Intégration dans server.cjs
- Import du module qflush-integration
- Mise à jour de la détection QFLUSH
- Initialisation du superviseur dans `start()`
- Ajout de l'endpoint `/api/qflush/status`

## ⚠️ Problème découvert

Le package `@funeste38/qflush` semble être un module ES (ESM) qui a des problèmes d'interopérabilité avec CommonJS.

Erreurs rencontrées:
```
ReferenceError: __dirname is not defined
ReferenceError: require is not defined
```

## 🔧 Solutions possibles

### Option 1: Utiliser un wrapper ESM
Créer un wrapper ESM qui charge qflush et expose une API compatible CommonJS.

### Option 2: Créer notre propre superviseur
Implémenter un superviseur simple basé sur `child_process` pour les besoins d'A11.

### Option 3: Migrer vers ES Modules
Convertir server.cjs en ESM (server.mjs) pour compatibilité native.

### Option 4: Utiliser PM2 ou Forever
Utiliser un superviseur de processus standard Node.js au lieu de qflush.

## 📝 Recommandation

**Option 2 (Court terme)**: Créer un superviseur simple A11-spécifique
- Plus de contrôle
- Pas de dépendances externes problématiques
- Facile à déboguer

**Option 4 (Long terme)**: Utiliser PM2
- Mature et bien maintenu
- Documentation complète
- Large adoption dans l'écosystème Node.js

## 🚀 Implémentation du superviseur A11

Créer `apps/server/src/a11-supervisor.cjs`:

```javascript
const { spawn } = require('child_process');
const EventEmitter = require('events');

class A11Supervisor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.processes = new Map();
    this.config = {
      maxRestarts: options.maxRestarts || 3,
      restartDelay: options.restartDelay || 2000,
      ...options
    };
  }

  register(processConfig) {
    const { name, command, args = [], cwd, env } = processConfig;
    this.processes.set(name, {
      config: processConfig,
      process: null,
      restarts: 0,
      status: 'registered'
    });
  }

  start(name) {
    const entry = this.processes.get(name);
    if (!entry) throw new Error(`Process ${name} not registered`);
    
    const { command, args, cwd, env } = entry.config;
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });
    
    entry.process = proc;
    entry.status = 'running';
    entry.pid = proc.pid;
    
    proc.on('exit', (code) => {
      this.handleExit(name, code);
    });
    
    this.emit('start', { name, pid: proc.pid });
  }

  handleExit(name, code) {
    const entry = this.processes.get(name);
    if (!entry) return;
    
    entry.status = 'stopped';
    entry.restarts++;
    
    if (entry.restarts < this.config.maxRestarts) {
      setTimeout(() => {
        console.log(`[Supervisor] Restarting ${name}...`);
        this.start(name);
      }, this.config.restartDelay);
    } else {
      console.error(`[Supervisor] ${name} reached max restarts`);
      this.emit('max-restarts', { name });
    }
  }

  stop(name) {
    const entry = this.processes.get(name);
    if (!entry || !entry.process) return;
    
    entry.process.kill();
    entry.status = 'stopped';
    this.emit('stop', { name });
  }

  getStatus() {
    const status = {};
    for (const [name, entry] of this.processes) {
      status[name] = {
        status: entry.status,
        pid: entry.pid,
        restarts: entry.restarts
      };
    }
    return status;
  }
}

module.exports = { A11Supervisor };
```

## 📋 Fichiers créés

1. `apps/server/src/qflush-integration.cjs` - Module d'intégration QFlush
2. `apps/server/integrate-qflush.ps1` - Script d'intégration automatique
3. `apps/server/test-qflush.cjs` - Script de test
4. `QFLUSH_INTEGRATION.md` - Ce fichier de documentation

## 🎯 Prochaines étapes

1. Décider quelle approche de supervision utiliser
2. Implémenter le superviseur choisi
3. Tester avec llama-server
4. Ajouter des endpoints de monitoring
5. Documenter l'utilisation

## 📞 Support

Pour des questions sur l'intégration, consulter:
- Documentation QFlush: https://www.npmjs.com/package/@funeste38/qflush
- Issues A11: https://github.com/jEFFLEZ/a11/issues
