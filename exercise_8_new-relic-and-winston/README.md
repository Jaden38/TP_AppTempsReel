# TP New Relic & Winston - Monitoring d'Application Temps Réel

## 🎯 Objectif

Implémenter un système de monitoring complet avec New Relic (APM) et Winston (logging) dans une application Node.js.

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Créer un compte New Relic gratuit
# https://newrelic.com/signup

# Configurer votre clé de licence
export NEW_RELIC_LICENSE_KEY="votre_clé_ici"
```

## 🚀 Démarrage

### Option 1 : Avec export de variable d'environnement (recommandé)

```bash
# Configurer la clé une fois pour la session
export NEW_RELIC_LICENSE_KEY="votre_clé_ici"

# Puis simplement lancer l'application
node index.js

# Ou en mode développement
npm run dev
```

### Option 2 : Inline (pour un test rapide)

```bash
# Passer la clé directement dans la commande
NEW_RELIC_LICENSE_KEY="votre_clé" node index.js
```

### Option 3 : Fichier .env (pour un usage permanent)

```bash
# Créer un fichier .env
echo 'NEW_RELIC_LICENSE_KEY=votre_clé_ici' > .env

# Puis lancer normalement
node index.js
```

## 🧪 Tests

```bash
# Rendre le script exécutable
chmod +x test.sh

# Lancer les tests
./test.sh

# Ou manuellement
curl http://localhost:3000/ping
curl http://localhost:3000/slow
curl http://localhost:3000/error
```

## 📊 Monitoring

### Winston Logs

- **Console** : Logs colorisés en temps réel
- **logs/app.log** : Tous les logs (rotation automatique à 5MB)
- **logs/error.log** : Erreurs uniquement

### New Relic APM

1. Connectez-vous à votre dashboard New Relic
2. Allez dans APM → Applications
3. Sélectionnez "tp-realtime-demo"
4. Observez :
   - Transactions
   - Erreurs
   - Latence
   - Throughput

## 🔍 Points Clés

### 1. Import New Relic

```javascript
// DOIT être la première ligne !
require('newrelic');
```

### 2. Niveaux de Logs Winston

- **error** : Erreurs critiques
- **warn** : Avertissements
- **info** : Informations générales
- **debug** : Détails de débogage

### 3. Rotation des Logs

- Taille max : 5MB par fichier
- Nombre max de fichiers : 5
- Rotation automatique

## 📝 Endpoints Disponibles

| Route | Méthode | Description |
|-------|---------|-------------|
| `/ping` | GET | Health check simple |
| `/slow` | GET | Simule une latence de 2s |
| `/error` | GET | Génère une erreur intentionnelle |
| `/test-logs` | GET | Teste tous les niveaux de logs |
| `/data` | POST | Traite des données (léger/lourd) |
| `/stats` | GET | Affiche les statistiques de logs |

## 🎓 Questions de Réflexion

1. **Pourquoi importer New Relic en premier ?**
   - Pour instrumenter toutes les dépendances dès leur chargement

2. **Pourquoi utiliser JSON pour les logs ?**
   - Facilite le parsing et l'analyse automatique
   - Structure uniforme pour les outils de monitoring

3. **Quelle limite au monitoring sans logs ?**
   - Manque de contexte sur les erreurs
   - Difficile de tracer le parcours utilisateur

4. **Comment scaler ce système ?**
   - Centraliser les logs (ELK, Datadog)
   - Utiliser des agents New Relic sur chaque instance
   - Implémenter des correlation IDs

## 🚀 Bonus : Socket.IO

Pour ajouter Socket.IO et monitorer les événements temps réel :

```javascript
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  logger.info('Socket.IO connection', { socketId: socket.id });
  
  socket.on('message', (data) => {
    logger.info('Socket message received', { 
      socketId: socket.id,
      data 
    });
  });
  
  socket.on('disconnect', () => {
    logger.info('Socket.IO disconnection', { socketId: socket.id });
  });
});
```

## 📚 Ressources

- [New Relic Docs](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [Winston Docs](https://github.com/winstonjs/winston)
- [Best Practices Logging](https://www.datadoghq.com/blog/node-logging-best-practices/)
