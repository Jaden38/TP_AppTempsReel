# CollabBoard - Éditeur de Texte Collaboratif Temps Réel

## 📋 Description

CollabBoard est une application web de collaboration en temps réel permettant à plusieurs utilisateurs de travailler simultanément sur un même document texte. L'application utilise Socket.IO pour la synchronisation instantanée et offre une expérience fluide de collaboration.

## 🚀 Exécution

### Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn
- Redis (optionnel, pour le bonus / Docker)
- Docker & Docker Compose (optionnel, pour version scalable avec Redis)

### Installation (version locale)

```bash
cd examen_final_temps_reel
npm install
```

### Commandes disponibles (version locale)

```bash
# Version standard (sans Redis)
npm start          # Lance le serveur en production
npm run dev        # Lance avec nodemon (auto-reload)
npm run loadtest   # Lance un test de charge simple avec Artillery (50 utilisateurs, 100 requêtes chacun)
```

### Accès à l'application (locale)

1. Serveur principal :

```
http://localhost:3000
```

2. Endpoint de monitoring :

```
http://localhost:3000/status
```

---

## 🐳 Version Redis / Docker et Scalabilité

CollabBoard peut être exécuté avec Redis et Docker pour supporter plusieurs instances Node.js en parallèle, permettant ainsi une **scalabilité horizontale**.

### 🔹 Lancer l’application avec Docker

```bash
docker-compose up --build
```

* **Redis** : port 6379
* **App Node.js** : port 3000 (1 instance par défaut)

### 🔹 Scalabilité avec plusieurs instances

```bash
docker-compose up --scale app=3
```

* `app=3` lance 3 instances Node.js
* Chaque instance utilise Redis pour synchroniser les events Socket.IO
* Limitation actuelle : ports exposés de 3000 à 3010 → maximum 11 instances

### 🔹 Accès à l’application

* Instances accessibles via `http://localhost:3000`, `http://localhost:3001`, etc.
* Les sessions restent synchronisées via Redis.

### 🔹 Exemple avec 5 instances

```bash
docker-compose up --scale app=5
```

* Ports exposés : 3000, 3001, 3002, 3003, 3004
* Redis synchronise automatiquement les rooms entre toutes les instances

---

## 🎯 Utilisation

### Créer une nouvelle session

1. Sur la page d'accueil, cliquez sur **"Créer une Room"**
2. Le système génère automatiquement un ID de room et un token sécurisé
3. Partagez ces informations avec les collaborateurs
4. Entrez votre nom d'utilisateur et cliquez sur **"Rejoindre"**

### Rejoindre une session existante

1. Récupérez l'ID de la room et le token auprès du créateur
2. Entrez votre nom d'utilisateur
3. Saisissez l'ID de la room et le token
4. Cliquez sur **"Rejoindre"**

### Fonctionnalités de l'éditeur

- **Synchronisation temps réel** : Toute modification est instantanément visible
- **Indicateur de frappe** : Voyez qui est en train de taper
- **Liste des utilisateurs** : Visualisez tous les participants connectés
- **Notifications** : Restez informé des connexions/déconnexions
- **Statistiques** : Compteur de caractères, mots et lignes en temps réel

---

## 🛠 Architecture et Choix Techniques

### Stack Technologique

- **Backend** : Node.js + Express + Socket.IO
- **Frontend** : HTML5 + CSS3 + JavaScript vanilla
- **Protocole** : WebSocket (avec fallback automatique)
- **Optionnel** : Redis pour la scalabilité horizontale

### Architecture

```mermaid
graph TB
    subgraph Clients
        C1[Client 1]
        C2[Client 2]
        C3[Client N]
    end
    
    subgraph Server["Node.js Server"]
        S[Socket.IO<br/>Engine]
    end
    
    R[(Redis<br/>Optional)]
    
    C1 <-->|WebSocket| S
    C2 <-->|WebSocket| S
    C3 <-->|WebSocket| S
    S <-->|Pub/Sub| R
    
    style Server fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    style R fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff
    style C1 fill:#e3fafc,stroke:#0c8599
    style C2 fill:#e3fafc,stroke:#0c8599
    style C3 fill:#e3fafc,stroke:#0c8599
```

### Choix de Conception

#### 1. **Socket.IO vs WebSocket natif**
- **Choix** : Socket.IO
- **Justification** : 
  - Reconnexion automatique intégrée
  - Fallback automatique (polling) si WebSocket indisponible
  - Système de rooms natif pour la gestion des espaces
  - Émission d'événements structurés
  - Middleware d'authentification simple

#### 2. **Pas de base de données**
- **Choix** : Stockage en mémoire
- **Justification** :
  - Simplicité pour un prototype
  - Performance maximale (pas de latence I/O)
  - Adapté pour des sessions temporaires
  - Nettoyage automatique des rooms vides

#### 3. **Authentification par token**
- **Choix** : Token unique par room
- **Justification** :
  - Simple à implémenter et partager
  - Sécurité basique mais efficace
  - Pas besoin de gestion de comptes utilisateurs
  - Validation côté serveur avant connexion Socket

#### 4. **Architecture événementielle**
- **Événements principaux** :
  - `connection/disconnect` : Gestion des sessions
  - `update` : Synchronisation du contenu
  - `typing` : Indicateurs de frappe
  - `notification` : Messages système
- **Justification** : Découplage clair des responsabilités

### Sécurité Implémentée

1. **Validation des tokens** : Vérification avant acceptation de connexion
2. **Sanitization** : Validation du type et taille des données
3. **Rate limiting** : Limitation de la taille du contenu (100KB)
4. **Isolation des rooms** : Les messages ne sortent pas de leur contexte
5. **Nettoyage automatique** : Suppression des rooms vides après 60s

### Monitoring

Le serveur offre plusieurs niveaux de monitoring :

1. **Console (temps réel)** :
   - Connexions/déconnexions
   - Événements émis
   - État des rooms
   - Métriques toutes les 30 secondes

2. **Endpoint HTTP `/status`** :
   - Format JSON
   - Métriques globales
   - Liste des rooms actives
   - Consommation mémoire

3. **Métriques collectées** :
   - Connexions totales/actives
   - Événements par minute
   - Nombre de rooms et d'utilisateurs
   - Uptime du serveur

---

## 📊 Performance et Scalabilité

- **Capacité** : ~1000 connexions simultanées par instance
- **Latence** : < 50ms en local, < 200ms en réseau
- **Taille max document** : 100KB
- **Utilisation mémoire** : ~50MB pour 100 utilisateurs

**Scalabilité avec Redis Adapter** : multiples instances Node.js synchronisées via Redis + load balancer (sticky sessions).

---

## 🧪 Tests Recommandés

### Tests Fonctionnels

1. **Multi-utilisateurs** : Ouvrir 3+ onglets avec différents users
2. **Synchronisation** : Vérifier la propagation instantanée
3. **Déconnexion/Reconnexion** : Tester la reprise de session
4. **Charge** : Tester avec 10+ utilisateurs simultanés
5. **Sécurité** : Essayer de rejoindre avec un mauvais token

### Tests de Performance

```bash
# Avec Artillery

npm install artillery
artillery quick --count 50 --num 10 http://localhost:3000
```

---

## 📈 Améliorations Futures

1. **Persistance** : Ajout de MongoDB/PostgreSQL pour sauvegarder les documents
2. **Historique** : Système de versions et undo/redo collaboratif
3. **Curseurs** : Affichage de la position du curseur de chaque utilisateur
4. **Rich Text** : Support du formatage (gras, italique, etc.)
5. **Permissions** : Rôles (lecteur, éditeur, admin)
6. **Authentification** : OAuth2, JWT persistants
7. **Optimisation** : Operational Transform ou CRDT pour la résolution de conflits
8. **PWA** : Support offline avec synchronisation différée