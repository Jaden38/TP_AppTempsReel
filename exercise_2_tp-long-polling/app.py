from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import threading, time, queue
from datetime import datetime

app = Flask(__name__)
CORS(app)

current_task_status = "En attente"
status_version = 0
status_last_updated = datetime.now()
pending_requests = []
status_lock = threading.Lock()

class PendingRequest:
    def __init__(self, response_queue, last_version):
        self.response_queue = response_queue
        self.last_version = last_version
        self.created_at = time.time()

def notify_pending_clients():
    global pending_requests
    with status_lock:
        clients = pending_requests.copy()
        pending_requests.clear()

    data = {
        "status": current_task_status,
        "version": status_version,
        "timestamp": status_last_updated.isoformat()
    }
    for p in clients:
        p.response_queue.put(data)

def cleanup_expired_requests():
    global pending_requests
    now = time.time()
    with status_lock:
        still = []
        for req in pending_requests:
            if now - req.created_at <= 30:
                still.append(req)
            else:
                req.response_queue.put({"timeout": True})
        pending_requests = still

def cleanup_thread():
    while True:
        time.sleep(5)
        cleanup_expired_requests()

threading.Thread(target=cleanup_thread, daemon=True).start()

@app.route("/")
def index():
    return render_template_string(CLIENT_HTML)

@app.route("/api/status")
def get_status():
    with status_lock:
        return jsonify({
            "status": current_task_status,
            "version": status_version,
            "timestamp": status_last_updated.isoformat()
        })

@app.route("/api/poll-status")
def poll_status():
    try:
        last_version = int(request.args.get("last_version", 0))
    except:
        last_version = 0

    with status_lock:
        if last_version < status_version:
            return jsonify({
                "status": current_task_status,
                "version": status_version,
                "timestamp": status_last_updated.isoformat()
            })

    q = queue.Queue()
    pending = PendingRequest(q, last_version)
    with status_lock:
        if last_version < status_version:
            return jsonify({
                "status": current_task_status,
                "version": status_version,
                "timestamp": status_last_updated.isoformat()
            })
        pending_requests.append(pending)

    try:
        data = q.get(timeout=30)
        if data and not data.get("timeout"):
            return jsonify(data)
    except queue.Empty:
        pass

    with status_lock:
        if pending in pending_requests:
            pending_requests.remove(pending)
    return "", 204

@app.route("/api/update-status", methods=["POST"])
def update_status():
    global current_task_status, status_version, status_last_updated
    data = request.get_json()
    if not data or "status" not in data:
        return jsonify({"error": "Statut requis"}), 400

    new_status = data["status"]
    if new_status not in ["En attente", "En cours", "Terminée", "Échec"]:
        return jsonify({"error": "Statut invalide"}), 400

    with status_lock:
        if new_status != current_task_status:
            current_task_status = new_status
            status_version += 1
            status_last_updated = datetime.now()
            threading.Thread(target=notify_pending_clients, daemon=True).start()

    return jsonify({
        "status": current_task_status,
        "version": status_version,
        "timestamp": status_last_updated.isoformat()
    })

CLIENT_HTML = """
<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.tailwindcss.com"></script>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Long Polling Status</title>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center">
  <div class="bg-gray-800 rounded-2xl p-8 shadow-xl w-full max-w-md space-y-6">
    <h1 class="text-2xl font-bold text-center">🔄 Statut de Tâche</h1>

    <div id="statusBox" class="rounded-xl bg-gray-700 p-5 text-center space-y-2">
      <div id="currentStatus" class="text-xl font-semibold">Chargement...</div>
      <div class="text-sm text-gray-400">
        Version <span id="statusVersion">-</span> • Maj: <span id="lastUpdated">-</span>
      </div>
    </div>

    <div class="space-y-2">
      <select id="newStatus" class="w-full p-2 rounded-lg bg-gray-700 border border-gray-600">
        <option value="En attente">🕐 En attente</option>
        <option value="En cours">⚡ En cours</option>
        <option value="Terminée">✅ Terminée</option>
        <option value="Échec">❌ Échec</option>
      </select>
      <button id="updateButton" onclick="updateStatus()" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold">
        Mettre à jour
      </button>
    </div>

    <div id="connectionStatus" class="text-center text-sm text-yellow-400">🔍 Connexion en cours...</div>
  </div>

<script>
let currentVersion = 0, isPolling = false, pollController = null;

const statusEl = document.getElementById('currentStatus');
const versionEl = document.getElementById('statusVersion');
const updatedEl = document.getElementById('lastUpdated');
const connEl = document.getElementById('connectionStatus');
const newStatusEl = document.getElementById('newStatus');

function setConn(state, msg){
  connEl.textContent = msg;
  connEl.className = 'text-center text-sm ' + (state==='error'?'text-red-400':state==='connected'?'text-green-400':'text-yellow-400');
}

function updateUI(d){
  statusEl.textContent = d.status;
  versionEl.textContent = d.version;
  updatedEl.textContent = new Date(d.timestamp).toLocaleTimeString('fr-FR');
  currentVersion = d.version;
  newStatusEl.value = d.status;
}

async function pollLoop(){
  if(isPolling) return;
  isPolling = true;
  while(isPolling){
    try{
      setConn('connecting','⏳ Attente de mise à jour...');
      pollController = new AbortController();
      const t = setTimeout(()=>pollController.abort(),35000);
      const res = await fetch(`/api/poll-status?last_version=${currentVersion}`,{signal:pollController.signal});
      clearTimeout(t);

      if(res.status===204){
        setConn('connected','✅ Connecté - en attente');
        continue;
      }
      if(!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if(!data.timeout){ updateUI(data); setConn('connected','✨ Statut mis à jour'); }
    }catch(e){
      if(e.name==='AbortError') continue;
      console.error(e);
      setConn('error','⚠️ Erreur de connexion');
      await new Promise(r=>setTimeout(r,3000));
    }
  }
}

async function init(){
  try{
    const res = await fetch('/api/status');
    const d = await res.json();
    updateUI(d);
    setConn('connected','✅ Connecté');
    pollLoop();
  }catch(e){
    setConn('error','⚠️ Serveur indisponible');
    setTimeout(init,3000);
  }
}

async function updateStatus(){
  const btn = document.getElementById('updateButton');
  btn.disabled = true; btn.textContent='⏳...';
  try{
    await fetch('/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:newStatusEl.value})});
  }finally{
    btn.disabled = false; btn.textContent='Mettre à jour';
  }
}

document.addEventListener('DOMContentLoaded',init);
</script>
</body>
</html>
"""

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000, threaded=True)
