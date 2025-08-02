# Messenger

Une application de chat en temps réel avec support WebSocket, présentant une interface utilisateur moderne et des fonctionnalités d'internationalisation.

## Fonctionnalités

- Messagerie en temps réel avec Socket.io
- Fonctionnalité de téléchargement de fichiers et d'images
- Support des notifications push
- Interface multilingue
- Intégration de base de données SQLite

## Installation

### Prérequis
- Node.js (v14 ou supérieur)
- npm (v6 ou supérieur)

### Étapes
1. Cloner le dépôt
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. Installer les dépendances
   ```bash
   npm install
   ```

3. Créer un fichier `.env` (optionnel) pour la configuration :
   ```
   PORT=3000
   ```

## Utilisation

### Démarrage du serveur

```bash
# En utilisant npm
npm start

# En utilisant le fichier batch Windows
start.bat
```

### Accès à l'application
Ouvrez votre navigateur et accédez à `http://localhost:3000`

## Configuration
- **Notifications push** : Ajoutez les URL de notifications push dans les paramètres de l'application
- **Langue** : L'application détecte automatiquement vos préférences linguistiques, avec un remplacement manuel disponible dans les paramètres

## Licence
Licence AGPL-3.0

## Technologies utilisées
- [Express](https://expressjs.com/) - Framework web
- [Socket.io](https://socket.io/) - Communication en temps réel
- [SQLite3](https://www.sqlite.org/) - Base de données
- [Sharp](https://sharp.pixelplumbing.com/) - Traitement d'images