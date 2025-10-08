# Chat Multi-Salons avec Redis Pub/Sub

Application de chat en temps réel scalable utilisant Redis Pub/Sub pour synchroniser plusieurs instances de serveur.

## 🎯 Pourquoi Redis Pub/Sub ?

**Sans Redis :** Chaque serveur est isolé. Les clients connectés au serveur A ne voient pas les messages des clients du serveur B.

**Avec Redis :** Tous les serveurs communiquent via Redis. Les messages sont synchronisés entre toutes les instances en temps réel.

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Clients["Clients Web"]
        C1["👤 Client 1<br/>(Alice)<br/>localhost:3000"]
        C2["👤 Client 2<br/>(Bob)<br/>localhost:3001"]
        C3["👤 Client 3<br/>(Charlie)<br/>localhost:3002"]
    end
    
    subgraph Serveurs["Instances de Serveur"]
        S1["🖥️ Serveur Instance 1<br/>Port 3000"]
        S2["🖥️ Serveur Instance 2<br/>Port 3001"]
        S3["🖥️ Serveur Instance 3<br/>Port 3002"]
    end
    
    subgraph Redis["Cache & Pub/Sub"]
        R[("🔴 Redis<br/>Port 6379")]
    end
    
    C1 ---|WebSocket| S1
    C2 ---|WebSocket| S2
    C3 ---|WebSocket| S3
    
    S1 <--->|Pub/Sub<br/>chat:messages<br/>chat:room-notifications| R
    S2 <--->|Pub/Sub<br/>chat:messages<br/>chat:room-notifications| R
    S3 <--->|Pub/Sub<br/>chat:messages<br/>chat:room-notifications| R
    
    style C1 fill:#667eea,stroke:#5a67d8,color:#fff
    style C2 fill:#667eea,stroke:#5a67d8,color:#fff
    style C3 fill:#667eea,stroke:#5a67d8,color:#fff
    style S1 fill:#48bb78,stroke:#38a169,color:#fff
    style S2 fill:#48bb78,stroke:#38a169,color:#fff
    style S3 fill:#48bb78,stroke:#38a169,color:#fff
    style R fill:#f56565,stroke:#e53e3e,color:#fff
```

**Comment ça marche :**
1. Alice (port 3000) envoie un message
2. Le Serveur 1 publie le message sur Redis
3. Redis diffuse à TOUS les serveurs (1, 2, 3)
4. Chaque serveur envoie le message à ses clients
5. Alice, Bob et Charlie reçoivent le message !

## 🚀 Installation et Lancement

### 1. Installer les dépendances
```bash
npm install
```

### 2. Démarrer Redis
```bash
docker-compose up -d
```

### 3. Lancer les instances de serveur

**Terminal 1 :**
```bash
npm run start:instance1
```

**Terminal 2 :**
```bash
npm run start:instance2
```

**Terminal 3 :**
```bash
npm run start:instance3
```

## 🧪 Tester l'application

1. **Ouvrez 3 onglets de navigateur :**
   - Onglet 1 : `http://localhost:3000` → Alice / salon "general"
   - Onglet 2 : `http://localhost:3001` → Bob / salon "general"
   - Onglet 3 : `http://localhost:3002` → Charlie / salon "general"

2. **Envoyez des messages :**
   - Tapez un message depuis n'importe quel onglet
   - ✅ **Tous les clients reçoivent le message !**

3. **Testez l'isolation des salons :**
   - Créez un salon "dev" depuis un autre onglet
   - Les messages "general" et "dev" restent séparés

## 🛑 Arrêter l'application

```bash
# Arrêter Redis
docker-compose down

# Dans chaque terminal serveur : Ctrl+C
```

## 📁 Structure du projet

```
├── index.html          # Interface client
├── index-redis.js      # Serveur avec Redis Pub/Sub ✅
├── package.json        # Dépendances
└── docker-compose.yml  # Configuration Redis
```

## 🔧 Commandes utiles

```bash
# Voir les logs Redis
docker logs chat-redis

# Vérifier que Redis fonctionne
docker exec -it chat-redis redis-cli -a your_redis_password ping
# Réponse attendue : PONG
```

---

**TP réalisé dans le cadre du cours sur la scalabilité d'applications temps réel**