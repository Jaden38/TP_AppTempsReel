const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'votre_secret_jwt_super_securise'; // À changer en production !
const SALT_ROUNDS = 10;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stockage en mémoire (remplacer par une vraie DB en production)
let users = [];
let notes = [];
let nextUserId = 1;
let nextNoteId = 1;

// ========== MIDDLEWARE D'AUTHENTIFICATION ==========

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.userId = user.id;
    req.username = user.username;
    next();
  });
}

// ========== ROUTES D'AUTHENTIFICATION ==========

// Inscription
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Nom d\'utilisateur déjà pris' });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Créer l'utilisateur
    const newUser = {
      id: nextUserId++,
      username,
      password: hashedPassword
    };
    users.push(newUser);

    console.log(`✓ Nouvel utilisateur inscrit: ${username}`);
    res.status(201).json({ message: 'Inscription réussie', username });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    // Trouver l'utilisateur
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Générer le JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✓ Connexion réussie: ${username}`);
    res.json({ token, username, userId: user.id });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ========== ROUTES DES NOTES ==========

// Obtenir toutes les notes (accessible à tous)
app.get('/api/notes', (req, res) => {
  res.json(notes);
});

// Créer une note (authentification requise)
app.post('/api/notes', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Le contenu de la note est requis' });
    }

    const newNote = {
      id: nextNoteId++,
      content: content.trim(),
      authorId: req.userId,
      authorName: req.username,
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    console.log(`✓ Note créée par ${req.username}: "${content.substring(0, 30)}..."`);

    // Notifier tous les clients via Socket.IO
    io.emit('notes_updated', notes);

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Erreur lors de la création de la note:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une note (authentification + autorisation requises)
app.put('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Le contenu de la note est requis' });
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    // Vérifier que l'utilisateur est bien l'auteur
    if (note.authorId !== req.userId) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres notes' });
    }

    note.content = content.trim();
    note.updatedAt = new Date().toISOString();

    console.log(`✓ Note ${noteId} modifiée par ${req.username}`);

    // Notifier tous les clients
    io.emit('notes_updated', notes);

    res.json(note);
  } catch (error) {
    console.error('Erreur lors de la modification de la note:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une note (authentification + autorisation requises)
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const noteId = parseInt(req.params.id);

    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    const note = notes[noteIndex];

    // Vérifier que l'utilisateur est bien l'auteur
    if (note.authorId !== req.userId) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres notes' });
    }

    notes.splice(noteIndex, 1);
    console.log(`✓ Note ${noteId} supprimée par ${req.username}`);

    // Notifier tous les clients
    io.emit('notes_updated', notes);

    res.json({ message: 'Note supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la note:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ========== SOCKET.IO ==========

io.on('connection', (socket) => {
  console.log(`✓ Nouvelle connexion Socket.IO: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`✗ Déconnexion Socket.IO: ${socket.id}`);
  });
});

// ========== DÉMARRAGE DU SERVEUR ==========

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
});