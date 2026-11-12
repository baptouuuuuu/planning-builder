# Planning Builder

Générateur de planning d'équipe sous contraintes. 100 % front-end (React + TypeScript + Vite), PWA installable, déployable sur GitHub Pages et portable vers iOS/Android via [Capacitor](https://capacitorjs.com/).

## Fonctionnalités

- **Équipe** : personnes + plages de disponibilité (jour + heure à la minute).
- **Tâches et sous-tâches** : une plage imposée peut être définie sur la tâche ; chaque sous-tâche possède sa durée et ses personnes préférées. Les boutons monter/descendre réorganisent les sous-tâches. Une option par tâche impose leur exécution dans l'ordre affiché ; sinon elles sont indépendantes.
- **Contraintes globales** : nombre de jours, plage d'affichage, export JSON, jeu de données d'exemple.
- **Planning** : plannings verticaux par jour, personnes côte à côte (défilement horizontal si nécessaire), zoom vertical à la molette ou par pincement à deux doigts, **Générer**, **Régénérer** (nouvelle seed), **verrouillage** de créneaux (clic sur un bloc) puis régénération du reste uniquement, **Annuler/Rétablir** (historique de 100 états).
- **Conflits & non planifiées** : avertissement, solution maximale, raison par tâche non planifiée, score.
- Données persistées en `localStorage`.

À la première ouverture de données anciennes, les relations explicites et les plages horaires préférées sont supprimées. Une chaîne de dépendances déjà conforme à l'ordre d'affichage active l'option d'ordre ; les autres relations ne sont pas conservées. Les changements sont affichés et une copie des données d'origine est conservée dans `localStorage` sous `planning-builder:v1:avant-ordre` lorsque le stockage le permet. Vérifiez l'ordre et régénérez le planning après cette migration.

## Démarrage

```bash
npm ci
npm run dev        # serveur de dev
npm test           # tests unitaires du solveur (vitest)
npm run typecheck  # TypeScript strict
npm run build      # build de production (dist/)
npm run preview    # prévisualiser le build
```

## Architecture

```
src/
  domain/   modèles et types (minutes absolues = jour*1440 + minute)
  solver/   rng seedé, validation des contraintes, solveur
  state/    store zustand (+ historique, persistance localStorage)
  ui/       composants React (vues Équipe, Tâches, Contraintes, Planning)
  data/     jeu de données d'exemple
```

## Solveur

1. Ordre topologique des tâches (priorité aux plages imposées étroites, bruit seedé).
2. Placement glouton : pour chaque tâche, candidats (personne × début) sur une grille de 15 min + points d'ancrage à la minute (début de disponibilité, fins de tâches, bornes de plage…), filtrés par les contraintes dures ; coût = pénalités souples + bruit.
3. Amélioration locale : relocalisation aléatoire seedée si la pénalité baisse.
4. Plusieurs redémarrages seedés ; on garde le meilleur (max de tâches planifiées, puis score).

Score = 100 × tâches planifiées − pénalités (personne non préférée : 30, plus équilibrage de charge). Même seed ⇒ même résultat ; « Régénérer » tire une nouvelle seed. Les créneaux verrouillés sont traités comme des contraintes dures.

## Déploiement GitHub Pages

1. Dans *Settings → Pages*, choisir **Source : GitHub Actions**.
2. Chaque push et chaque pull request déclenche `.github/workflows/deploy.yml` (tests et build avec `BASE_PATH=/<repo>/`). Seul `main` publie sur GitHub Pages ; les autres branches et les PR ne remplacent pas le site de production.
3. Le routage utilise `HashRouter` : aucune configuration serveur nécessaire.

Le `base` Vite vaut `/planning-builder/` par défaut ; surchargez avec `BASE_PATH`.

## Limites du MVP

- Heuristique : pas d'optimalité garantie ; la « solution maximale » est approchée.
- Horizon de 1 à 14 jours, disponibilités saisies jour par jour (pas de récurrence).
- Un seul planning, sans multi-utilisateur ni synchronisation ; pas d'import JSON.
- Un créneau verrouillé devenu incohérent après modification des données est signalé comme conflit.

## Roadmap

- Import JSON, plusieurs plannings, disponibilités récurrentes.
- Glisser-déposer des créneaux, vue calendrier mensuelle.
- Solveur avancé (recherche locale/CP-SAT en Web Worker), pauses générales et temps de déplacement.
- Packaging Capacitor (iOS/Android) et stockage IndexedDB.
