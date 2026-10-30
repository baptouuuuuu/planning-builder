# Planning Builder

Générateur de planning d'équipe sous contraintes. 100 % front-end (React + TypeScript + Vite), PWA installable, déployable sur GitHub Pages et portable vers iOS/Android via [Capacitor](https://capacitorjs.com/).

## Fonctionnalités

- **Équipe** : personnes + plages de disponibilité (jour + heure à la minute).
- **Tâches** : durée, plage horaire imposée (dure), plage préférée (souple), personnes préférées, dépendances / enchaînement (option « même personne »).
- **Contraintes globales** : nombre de jours, plage d'affichage, export JSON, jeu de données d'exemple.
- **Planning** : timeline par jour et par personne, **Générer**, **Régénérer** (nouvelle seed), **verrouillage** de créneaux (clic sur un bloc) puis régénération du reste uniquement, **Annuler/Rétablir** (historique de 100 états).
- **Conflits & non planifiées** : avertissement, solution maximale, raison par tâche non planifiée, score.
- Données persistées en `localStorage`.

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

Score = 100 × tâches planifiées − pénalités (personne non préférée : 30 ; hors plage préférée : 10 à 40). Même seed ⇒ même résultat ; « Régénérer » tire une nouvelle seed. Les créneaux verrouillés sont traités comme des contraintes dures.

## Déploiement GitHub Pages

1. Dans *Settings → Pages*, choisir **Source : GitHub Actions**.
2. Un push sur `main` déclenche `.github/workflows/deploy.yml` (tests, build avec `BASE_PATH=/<repo>/`, déploiement).
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
- Solveur avancé (recherche locale/CP-SAT en Web Worker), pauses et temps de déplacement.
- Packaging Capacitor (iOS/Android) et stockage IndexedDB.
