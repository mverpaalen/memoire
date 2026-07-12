# Interface locale (type Notion)

Petit serveur local, sans dépendance externe (juste Python 3), pour parcourir
et éditer directement les fiches de ce dépôt dans une interface web.

## Lancer

```bash
cd memoire        # à la racine du dépôt (là où se trouvent les dossiers plan/, annexes/, etc.)
python3 app/server.py
```

Puis ouvrir http://localhost:8420 dans le navigateur.

## Fonctionnement

- Le menu de gauche liste les 4 catégories (Plan, Expériences & cas,
  Références & concepts, Idées/thèses/arguments) et leurs fiches.
- Cliquer sur une fiche l'ouvre en aperçu, avec les liens `[[...]]`
  cliquables vers les autres fiches.
- Le bouton "Éditer" bascule vers l'édition du markdown brut ;
  "Enregistrer" (ou Cmd/Ctrl+S) écrit directement le fichier `.md`
  correspondant sur le disque.
- "+ Nouvelle fiche" crée un nouveau fichier vide dans la catégorie choisie.
- "Commit & push" (dans le menu de gauche) exécute `git add -A`,
  `git commit` et `git push` dans le dossier du dépôt — utile si ce
  dossier est bien un clone git configuré avec vos identifiants.

Tout se passe en local : le serveur ne communique avec aucun service
extérieur à part le chargement de la bibliothèque `marked.js` (rendu
markdown) depuis un CDN au chargement de la page.
