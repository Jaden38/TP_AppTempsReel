# Tableau de Bord Collaboratif Sécurisé

Application de notes collaboratives en temps réel avec authentification JWT et gestion des autorisations.

## 🎯 Objectif

Démontrer l'implémentation de règles de sécurité dans une application temps réel :
- **Authentification** avec JWT (JSON Web Tokens)
- **Autorisation** basée sur la propriété des données
- **Communication temps réel** sécurisée avec Socket.IO

## 🔐 Règles de Sécurité Implémentées

### 1. Accès en écriture restreint
- ✅ Seuls les utilisateurs **authentifiés** peuvent créer des notes
- ✅ Les utilisateurs **non authentifiés** peuvent uniquement consulter les notes
- ✅ Modification/suppression nécessitent une authentification

### 2. Propriété des données
- ✅ Un utilisateur ne peut **modifier** que ses propres notes
- ✅ Un utilisateur ne peut **supprimer** que ses propres notes
- ✅ Les boutons de modification/suppression ne s'affichent que pour l'auteur

### 3. Sécurité des mots de passe
- ✅ Hachage avec **bcrypt** (SALT_ROUNDS = 10)
- ✅ Jamais stockés en clair
- ✅ Validation côté serveur

### 4. Tokens JWT
- ✅ Expiration : 24 heures
- ✅ Contient : `userId` et `username`
- ✅ Vérifié sur chaque requête sensible

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│  (HTML/JS)      │
│  - Formulaires  │
│  - Socket.IO    │
└────────┬────────┘
         │ HTTP + WebSocket
         │ JWT Bearer Token
┌────────▼────────┐
│   Backend       │
│  (Express.js)   │
│  - API REST     │
│  - Socket.IO    │
│  - JWT Auth     │
└─────────────────┘
         │
    ┌────▼────┐
    │ Mémoire │
    │ - Users │
    │ - Notes │
    └─────────┘
```

## 🚀 Installation et Lancement

### 1. Installer les dépendances
```bash
npm install
```

### 2. Lancer le serveur
```bash
npm start
```

### 3. Ouvrir l'application
```
http://localhost:3000
```

## 🧪 Scénarios de Test

### Test 1 : Inscription et Connexion
1. Ouvrir l'application
2. Cliquer sur "Inscription"
3. Créer un compte : `alice` / `password123`
4. Se connecter avec ces identifiants
5. ✅ Vérifier que le tableau s'affiche avec le nom d'utilisateur

### Test 2 : Créer une Note (Authentifié)
1. Se connecter en tant que `alice`
2. Créer une note : "Ma première note"
3. ✅ La note apparaît avec l'auteur "alice"
4. ✅ Les boutons "Modifier" et "Supprimer" sont visibles

### Test 3 : Modifier sa Propre Note
1. Connecté en tant que `alice`
2. Cliquer sur "Modifier" sur une note de `alice`
3. Modifier le contenu
4. ✅ La note est mise à jour
5. ✅ Tous les clients voient la modification en temps réel

### Test 4 : Tenter de Modifier la Note d'un Autre (Autorisation)
1. Ouvrir un **2ème navigateur** (ou onglet privé)
2. S'inscrire et se connecter en tant que `bob`
3. ✅ `bob` voit les notes de `alice` mais **sans** boutons Modifier/Supprimer
4. Tenter une requête directe avec curl :
   ```bash
   curl -X PUT http://localhost:3000/api/notes/1 \
     -H "Authorization: Bearer <token_de_bob>" \
     -H "Content-Type: application/json" \
     -d '{"content": "Tentative de hack"}'
   ```
5. ✅ Serveur renvoie **403 Forbidden**

### Test 5 : Accès Non Authentifié (Lecture Seule)
1. Se déconnecter
2. ✅ Les notes restent visibles
3. Tenter de créer une note sans token :
   ```bash
   curl -X POST http://localhost:3000/api/notes \
     -H "Content-Type: application/json" \
     -d '{"content": "Test sans auth"}'
   ```
4. ✅ Serveur renvoie **401 Unauthorized**

### Test 6 : Temps Réel Multi-Utilisateurs
1. Ouvrir 3 onglets avec 3 utilisateurs différents
2. Créer/modifier/supprimer des notes depuis chaque onglet
3. ✅ Toutes les modifications apparaissent **instantanément** dans tous les onglets

## 📊 Flux d'Authentification

```
┌─────────┐                  ┌─────────┐
│ Client  │                  │ Serveur │
└────┬────┘                  └────┬────┘
     │                            │
     │  POST /api/register        │
     │  {username, password}      │
     ├───────────────────────────>│
     │                            │ bcrypt.hash(password)
     │                            │ Stockage user
     │  201 Created               │
     │<───────────────────────────┤
     │                            │
     │  POST /api/login           │
     │  {username, password}      │
     ├───────────────────────────>│
     │                            │ Vérif bcrypt.compare()
     │                            │ jwt.sign({id, username})
     │  {token, username, userId} │
     │<───────────────────────────┤
     │                            │
     │ localStorage.setItem()     │
     │                            │
     │  POST /api/notes           │
     │  Authorization: Bearer JWT │
     ├───────────────────────────>│
     │                            │ jwt.verify(token)
     │                            │ req.userId = decoded.id
     │                            │ Création note
     │  201 Created + note        │
     │<───────────────────────────┤
     │                            │
     │                   io.emit('notes_updated')
     │<═══════════════════════════════════════
     │        Tous les clients reçoivent
```

## 🔑 Choix Techniques de Sécurité

### 1. JWT (JSON Web Tokens)
**Pourquoi ?**
- Stateless : pas besoin de stocker les sessions côté serveur
- Portable : fonctionne entre différents domaines
- Contient les infos utilisateur (évite requêtes DB)

**Comment ?**
```javascript
// Génération
const token = jwt.sign(
  { id: user.id, username: user.username },
  JWT_SECRET,
  { expiresIn: '24h' }
);

// Vérification
jwt.verify(token, JWT_SECRET, (err, decoded) => {
  if (err) return res.status(403);
  req.userId = decoded.id;
});
```

### 2. Bcrypt
**Pourquoi ?**
- Hachage **unidirectionnel** (impossible de retrouver le mot de passe)
- **Salt** automatique (protège contre rainbow tables)
- **Coût adaptatif** (ajustable selon la puissance CPU)

**Comment ?**
```javascript
// Inscription
const hashedPassword = await bcrypt.hash(password, 10);

// Connexion
const isValid = await bcrypt.compare(password, user.password);
```

### 3. Middleware d'Authentification
**Rôle :** Vérifier le token avant chaque action sensible

```javascript
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({...});
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({...});
    req.userId = user.id;
    next();
  });
}

// Utilisation
app.post('/api/notes', authenticateToken, (req, res) => {...});
```

### 4. Autorisation (Ownership)
**Principe :** Vérifier que l'utilisateur est le propriétaire

```javascript
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
  const note = notes.find(n => n.id === noteId);
  
  // Vérification de propriété
  if (note.authorId !== req.userId) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  
  // Suppression autorisée
  notes = notes.filter(n => n.id !== noteId);
});
```

## 📁 Structure du Projet

```
secure-collaborative-board/
├── server.js           # Serveur Express + Socket.IO + API
├── package.json        # Dépendances
├── public/
│   ├── index.html      # Interface utilisateur
│   └── app.js          # Logique frontend + Socket.IO
└── README.md           # Ce fichier
```

## 🔒 Codes de Statut HTTP

| Code | Signification | Quand ? |
|------|---------------|---------|
| 200 | OK | Requête réussie |
| 201 | Created | Ressource créée (note, user) |
| 400 | Bad Request | Données invalides |
| 401 | Unauthorized | Token manquant/invalide |
| 403 | Forbidden | Token valide mais action non autorisée |
| 404 | Not Found | Ressource introuvable |
| 500 | Server Error | Erreur serveur |

## 🚨 Limitations (Pour Production)

⚠️ Cette application est un **prototype pédagogique**. Pour la production :

1. **Base de données** : Utiliser PostgreSQL/MongoDB au lieu de la mémoire
2. **JWT_SECRET** : Variable d'environnement, jamais en dur
3. **HTTPS** : Obligatoire pour sécuriser les tokens
4. **Refresh Tokens** : Pour renouveler sans redemander le mot de passe
5. **Rate Limiting** : Limiter les tentatives de connexion
6. **Validation stricte** : Joi/Yup pour valider les entrées
7. **CORS** : Configuration stricte des origines autorisées
8. **Logs** : Système de logs sécurisé (Winston/Bunyan)

## 📚 Ressources

- [JWT.io](https://jwt.io/) - Débugger et comprendre les JWT
- [bcrypt npm](https://www.npmjs.com/package/bcrypt) - Documentation bcrypt
- [Socket.IO Auth](https://socket.io/docs/v4/middlewares/) - Authentification Socket.IO
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Vulnérabilités web courantes

---

**TP réalisé dans le cadre du cours sur la sécurisation d'applications temps rée