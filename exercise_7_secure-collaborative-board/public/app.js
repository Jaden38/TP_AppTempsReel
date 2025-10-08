// Configuration
const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let socket = io();

// Éléments DOM
const authSection = document.getElementById('auth-section');
const boardSection = document.getElementById('board-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const noteForm = document.getElementById('note-form');
const notesContainer = document.getElementById('notes-container');
const authError = document.getElementById('auth-error');
const currentUserSpan = document.getElementById('current-user');

// ========== INITIALISATION ==========

if (token && currentUser) {
    showBoard();
    loadNotes();
} else {
    showAuth();
}

// ========== GESTION DE L'AUTHENTIFICATION ==========

function showLoginForm() {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.querySelectorAll('.tab')[1].classList.remove('active');
    hideError();
}

function showRegisterForm() {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    document.querySelectorAll('.tab')[0].classList.remove('active');
    document.querySelectorAll('.tab')[1].classList.add('active');
    hideError();
}

function showError(message) {
    authError.textContent = message;
    authError.classList.add('show');
}

function hideError() {
    authError.classList.remove('show');
}

function showAuth() {
    authSection.classList.remove('hidden');
    boardSection.classList.add('hidden');
}

function showBoard() {
    authSection.classList.add('hidden');
    boardSection.classList.remove('hidden');
    if (currentUser) {
        currentUserSpan.textContent = currentUser.username;
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            token = data.token;
            currentUser = { username: data.username, userId: data.userId };
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            showBoard();
            loadNotes();
            loginForm.reset();
        } else {
            showError(data.error || 'Erreur de connexion');
        }
    } catch (error) {
        showError('Erreur de connexion au serveur');
        console.error('Erreur:', error);
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Inscription réussie, basculer vers le formulaire de connexion
            showLoginForm();
            registerForm.reset();
            alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
        } else {
            showError(data.error || 'Erreur d\'inscription');
        }
    } catch (error) {
        showError('Erreur de connexion au serveur');
        console.error('Erreur:', error);
    }
});

// Logout
function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showAuth();
    notesContainer.innerHTML = '';
}

// ========== GESTION DES NOTES ==========

// Charger toutes les notes
async function loadNotes() {
    try {
        const response = await fetch(`${API_URL}/notes`);
        const notes = await response.json();
        displayNotes(notes);
    } catch (error) {
        console.error('Erreur lors du chargement des notes:', error);
    }
}

// Afficher les notes
function displayNotes(notes) {
    if (notes.length === 0) {
        notesContainer.innerHTML = `
            <div class="empty-state">
                <h2>Aucune note pour le moment</h2>
                <p>Créez la première note ci-dessus !</p>
            </div>
        `;
        return;
    }

    notesContainer.innerHTML = `<div class="notes-grid">${
        notes.map(note => createNoteCard(note)).join('')
    }</div>`;
}

// Créer une carte de note
function createNoteCard(note) {
    const isAuthor = currentUser && note.authorId === currentUser.userId;
    const date = new Date(note.createdAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="note-card">
            <div class="note-header">
                <span class="note-author">👤 ${note.authorName}</span>
                <span class="note-date">${date}</span>
            </div>
            <div class="note-content">${escapeHtml(note.content)}</div>
            ${isAuthor ? `
                <div class="note-actions">
                    <button class="btn btn-primary" onclick="editNote(${note.id}, '${escapeHtml(note.content).replace(/'/g, "\\'")}')">
                        ✏️ Modifier
                    </button>
                    <button class="btn btn-danger" onclick="deleteNote(${note.id})">
                        🗑️ Supprimer
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Ajouter une note
noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = document.getElementById('note-content').value;

    try {
        const response = await fetch(`${API_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            noteForm.reset();
            // Les notes seront mises à jour via Socket.IO
        } else {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la création de la note');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur de connexion au serveur');
    }
});

// Modifier une note
async function editNote(noteId, currentContent) {
    const newContent = prompt('Modifier la note:', currentContent);
    
    if (newContent === null || newContent.trim() === '') {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: newContent })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la modification');
        }
        // Les notes seront mises à jour via Socket.IO
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur de connexion au serveur');
    }
}

// Supprimer une note
async function deleteNote(noteId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la suppression');
        }
        // Les notes seront mises à jour via Socket.IO
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur de connexion au serveur');
    }
}

// ========== SOCKET.IO - TEMPS RÉEL ==========

socket.on('connect', () => {
    console.log('✓ Connecté au serveur Socket.IO');
});

socket.on('notes_updated', (notes) => {
    console.log('✓ Notes mises à jour en temps réel');
    displayNotes(notes);
});

socket.on('disconnect', () => {
    console.log('✗ Déconnecté du serveur Socket.IO');
});

// ========== UTILITAIRES ==========

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}