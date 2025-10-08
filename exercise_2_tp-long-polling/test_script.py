#!/usr/bin/env python3
"""
Script de test pour le système Long Polling
Simule plusieurs clients et teste les différents scénarios
"""

import requests
import threading
import time
import json
from datetime import datetime
import random

SERVER_URL = "http://localhost:5000"
STATUSES = ["En attente", "En cours", "Terminée", "Échec"]

class LongPollingClient:
    """Simule un client Long Polling"""
    
    def __init__(self, client_id):
        self.client_id = client_id
        self.current_version = 0
        self.is_running = True
        self.updates_received = 0
        self.poll_count = 0
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] Client {self.client_id}: {message}")
    
    def poll_status(self):
        """Effectue le Long Polling"""
        self.log("🚀 Démarrage du Long Polling")
        
        while self.is_running:
            try:
                self.poll_count += 1
                self.log(f"📡 Poll #{self.poll_count} (version: {self.current_version})")
                
                response = requests.get(
                    f"{SERVER_URL}/api/poll-status",
                    params={"last_version": self.current_version},
                    timeout=35  # Légèrement plus que le timeout serveur
                )
                
                if response.status_code == 204:
                    self.log("⏰ Timeout serveur - pas de changement")
                    continue
                    
                if response.status_code == 200:
                    data = response.json()
                    
                    if "timeout" in data:
                        self.log("⏰ Timeout explicite")
                        continue
                    
                    self.current_version = data["version"]
                    self.updates_received += 1
                    self.log(f"✨ Nouveau statut: {data['status']} (v{data['version']})")
                else:
                    self.log(f"❌ Erreur HTTP: {response.status_code}")
                    time.sleep(2)
                    
            except requests.exceptions.Timeout:
                self.log("⏰ Timeout de requête")
            except requests.exceptions.RequestException as e:
                self.log(f"❌ Erreur réseau: {e}")
                time.sleep(5)
            except Exception as e:
                self.log(f"💥 Erreur inattendue: {e}")
                time.sleep(5)
    
    def start(self):
        """Démarre le client en arrière-plan"""
        thread = threading.Thread(target=self.poll_status, daemon=True)
        thread.start()
        return thread
    
    def stop(self):
        """Arrête le client"""
        self.is_running = False
        self.log(f"🛑 Arrêt (Polls: {self.poll_count}, Updates: {self.updates_received})")

def get_current_status():
    """Récupère le statut actuel"""
    try:
        response = requests.get(f"{SERVER_URL}/api/status", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data["status"], data["version"]
    except Exception as e:
        print(f"❌ Erreur lors de la récupération du statut: {e}")
    return None, None

def update_status(new_status):
    """Met à jour le statut"""
    try:
        response = requests.post(
            f"{SERVER_URL}/api/update-status",
            json={"status": new_status},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Statut mis à jour: {data['status']} (v{data['version']})")
            return True
        else:
            print(f"❌ Erreur de mise à jour: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur lors de la mise à jour: {e}")
        return False

def test_basic_functionality():
    """Test de fonctionnalité de base"""
    print("\n" + "="*50)
    print("🧪 TEST 1: Fonctionnalité de base")
    print("="*50)
    
    # Vérifier que le serveur répond
    status, version = get_current_status()
    if status is None:
        print("❌ Le serveur ne répond pas. Assurez-vous qu'il est démarré.")
        return False
    
    print(f"📊 Statut initial: {status} (v{version})")
    
    # Tester la mise à jour
    new_status = random.choice([s for s in STATUSES if s != status])
    print(f"🔄 Test de mise à jour vers: {new_status}")
    
    if update_status(new_status):
        time.sleep(1)
        current_status, current_version = get_current_status()
        if current_status == new_status and current_version > version:
            print("✅ Mise à jour réussie")
            return True
        else:
            print("❌ La mise à jour n'a pas été prise en compte")
            return False
    else:
        print("❌ Échec de mise à jour")
        return False

def test_multiple_clients():
    """Test avec plusieurs clients"""
    print("\n" + "="*50)
    print("🧪 TEST 2: Clients multiples")
    print("="*50)
    
    num_clients = 5
    clients = []
    
    # Créer et démarrer les clients
    print(f"🚀 Démarrage de {num_clients} clients...")
    for i in range(num_clients):
        client = LongPollingClient(i + 1)
        thread = client.start()
        clients.append((client, thread))
        time.sleep(0.5)  # Échelonner les démarrages
    
    print("⏳ Attente de la stabilisation des connexions...")
    time.sleep(3)
    
    # Effectuer plusieurs changements de statut
    print("🔄 Test de synchronisation avec changements de statut...")
    for i in range(3):
        new_status = random.choice(STATUSES)
        print(f"\n📤 Changement #{i+1}: {new_status}")
        update_status(new_status)
        time.sleep(2)  # Laisser le temps aux clients de recevoir
    
    # Arrêter les clients
    print("\n🛑 Arrêt des clients...")
    for client, thread in clients:
        client.stop()
    
    # Attendre un peu pour les logs finaux
    time.sleep(1)
    
    # Statistiques
    print("\n📊 Statistiques des clients:")
    for client, _ in clients:
        print(f"  Client {client.client_id}: {client.poll_count} polls, {client.updates_received} updates")
    
    return True

def test_stress():
    """Test de stress avec changements rapides"""
    print("\n" + "="*50)
    print("🧪 TEST 3: Test de stress")
    print("="*50)
    
    # Démarrer quelques clients
    clients = []
    for i in range(3):
        client = LongPollingClient(f"STRESS-{i+1}")
        thread = client.start()
        clients.append((client, thread))
    
    print("⏳ Stabilisation...")
    time.sleep(2)
    
    # Changements rapides de statut
    print("🚀 Changements rapides de statut...")
    for i in range(10):
        status = random.choice(STATUSES)
        print(f"📤 Changement rapide #{i+1}: {status}")
        update_status(status)
        time.sleep(0.5)  # Changements toutes les 500ms
    
    print("⏳ Attente de stabilisation finale...")
    time.sleep(3)
    
    # Arrêter les clients
    for client, thread in clients:
        client.stop()
    
    time.sleep(1)
    
    # Vérifier que tous les clients ont reçu les mises à jour
    print("📊 Résultats du test de stress:")
    for client, _ in clients:
        efficiency = (client.updates_received / 10) * 100 if client.updates_received > 0 else 0
        print(f"  {client.client_id}: {client.updates_received}/10 updates ({efficiency:.1f}%)")
    
    return True

def test_timeout_behavior():
    """Test du comportement des timeouts"""
    print("\n" + "="*50)
    print("🧪 TEST 4: Comportement des timeouts")
    print("="*50)
    
    client = LongPollingClient("TIMEOUT-TEST")
    thread = client.start()
    
    print("⏳ Test sans changement de statut (timeout attendu)...")
    time.sleep(35)  # Attendre plus que le timeout serveur
    
    print("🔄 Changement après timeout...")
    update_status(random.choice(STATUSES))
    time.sleep(2)
    
    client.stop()
    time.sleep(1)
    
    print(f"📊 Résultat: {client.poll_count} polls, {client.updates_received} updates")
    
    return True

def main():
    """Fonction principale des tests"""
    print("🧪 TESTS DU SYSTÈME LONG POLLING")
    print("="*50)
    print("⚠️  Assurez-vous que le serveur Flask est démarré sur localhost:5000")
    print()
    
    # Vérifier la disponibilité du serveur
    try:
        response = requests.get(f"{SERVER_URL}/api/status", timeout=5)
        if response.status_code != 200:
            print("❌ Le serveur ne répond pas correctement")
            return
    except Exception as e:
        print(f"❌ Impossible de joindre le serveur: {e}")
        print("💡 Lancez d'abord: python app.py")
        return
    
    print("✅ Serveur accessible")
    
    # Exécuter les tests
    tests = [
        ("Fonctionnalité de base", test_basic_functionality),
        ("Clients multiples", test_multiple_clients),
        ("Test de stress", test_stress),
        ("Comportement des timeouts", test_timeout_behavior)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            print(f"\n⏳ Exécution: {test_name}")
            results[test_name] = test_func()
            time.sleep(2)  # Pause entre les tests
        except KeyboardInterrupt:
            print("\n🛑 Tests interrompus par l'utilisateur")
            break
        except Exception as e:
            print(f"❌ Erreur dans le test '{test_name}': {e}")
            results[test_name] = False
    
    # Résumé final
    print("\n" + "="*50)
    print("📊 RÉSUMÉ DES TESTS")
    print("="*50)
    
    for test_name, result in results.items():
        status = "✅ RÉUSSI" if result else "❌ ÉCHEC"
        print(f"{test_name}: {status}")
    
    success_rate = sum(results.values()) / len(results) * 100 if results else 0
    print(f"\n🎯 Taux de réussite: {success_rate:.1f}%")
    
    if success_rate == 100:
        print("🎉 Tous les tests sont passés avec succès!")
    elif success_rate >= 75:
        print("⚠️  La plupart des tests sont passés")
    else:
        print("🚨 Plusieurs tests ont échoué - vérifiez l'implémentation")

if __name__ == "__main__":
    main()