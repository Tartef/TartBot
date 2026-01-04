# ⏰ Discord Alert Bot

Bot Discord **auto-hébergé**, **gratuit** et **hautement configurable** permettant de créer des **alertes périodiques** (secondes, minutes ou heures), envoyées **pile à l’heure**, avec persistance et gestion multi-serveurs.

---

## 📌 Fonctionnalités

- ✅ Plusieurs alarmes par serveur
- ⏱️ Intervalle en **secondes / minutes / heures**
- 🕒 Envoi **aligné sur l’heure réelle** (ex : 15:00:00)
- 🔢 Gestion des **heures paires / impaires / toutes**
- 💬 Message personnalisé par alarme
- 📢 Support de `@everyone` et des rôles
- 🆔 Chaque alarme possède un **ID unique**
- ✏️ Modification ciblée par ID
- 🗑️ Suppression ciblée par ID
- 📋 Liste détaillée des alarmes
- 💾 Sauvegarde automatique (`config.json`)
- 🔄 Rechargement automatique après redémarrage
- 🌍 Multi-serveurs
- 🚀 Compatible hébergement gratuit (Eternodes, Railway…)

---

## 📦 Prérequis

- **Node.js 18 ou supérieur**
- Un **bot Discord** (Discord Developer Portal)
- Un hébergement Node.js (local ou distant)

---

## 🤖 Création du bot Discord

1. Aller sur :  
   👉 https://discord.com/developers/applications
2. Cliquer sur **New Application**
3. Onglet **Bot**
    - Créer le bot
    - Copier le **Bot Token**
4. Onglet **OAuth2 > URL Generator**
    - **Scopes** :
        - `bot`
        - `applications.commands`
    - **Bot Permissions** :
        - Send Messages
        - Mention Everyone
        - Read Message History
5. Copier l’URL générée et inviter le bot sur ton serveur

---
## 🧾 Commandes Slash

### ➕ `/setup` — Créer une alarme

**Syntaxe :**

`/setup value:<nombre> unit:<Secondes | Minutes | Heures> channel:<salon> message:<texte> hour_type:<optionnel>`

**Description des champs :**

- `value` : Valeur de l'intervalle
- `unit` : Unité de temps (Secondes, Minutes, Heures)
- `channel` : Salon Discord où envoyer l’alerte
- `message` : Message à envoyer (supporte @everyone et rôles)
- `hour_type` : Heures paires / impaires / toutes (uniquement si unit=Heures, optionnel)

**Exemple :**

`/setup value:2 unit:Heures channel:#alerts message:@everyone ⏰ Pause ! hour_type:Heures paires`

---

### ✏️ `/edit` — Modifier une alarme

**Syntaxe :**

`/edit id:<id> [value:<nombre>] [unit:<Secondes | Minutes | Heures>] [channel:<salon>] [message:<texte>] [hour_type:<optionnel>]`

**Description des champs :**

- `id` : ID de l'alarme à modifier (obligatoire)
- `value` : Nouvelle valeur de l'intervalle (optionnel)
- `unit` : Nouvelle unité de temps (optionnel)
- `channel` : Nouveau salon (optionnel)
- `message` : Nouveau message (optionnel)
- `hour_type` : Heures paires / impaires / toutes (optionnel)

**Exemple :**

`/edit id:1 value:3 message:@everyone 🔔 Nouvelle alerte hour_type:Heures impaires`

---

### 🗑️ `/delete` — Supprimer une alarme

**Syntaxe :**

`/delete id:<id>`

**Description des champs :**

- `id` : ID de l'alarme à supprimer (obligatoire)

**Exemple :**

`/delete id:1`

---

### 📋 `/list` — Lister les alarmes

**Syntaxe :**

`/list`

**Description :**

Affiche toutes les alarmes configurées pour le serveur avec pour chaque alarme :

- ID
- Intervalle
- Unité
- Type d’heure (Paire / Impaire / Toutes)
- Salon
- Message


