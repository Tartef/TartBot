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


