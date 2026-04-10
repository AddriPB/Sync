# Codex Notes - Sync

## Produit

`Sync` est une webapp agenda mobile-first construite avec `Next.js`.
Le produit vise un usage smartphone, avec une interface sombre, sobre, et centrée sur le calendrier.

Le nom du produit est `Sync`.

## Vues principales

L'application propose 3 vues accessibles en un clic :

- `planning`
- `week`
- `month`

### Vue `planning`

- C'est une liste complète des jours qui contiennent au moins un événement.
- Les jours sans événement ne sont pas affichés.
- Le scroll vertical est autorisé et attendu dans cette vue.
- Les jours passés sont en haut, les jours à venir en bas.
- Le bouton flottant `+` est présent dans cette vue.
- Le bouton `+` doit être visuellement très mis en avant et passer devant les autres éléments de l'écran.

### Vue `week`

- La navigation se fait par swipe horizontal, pas avec des flèches.
- Les swipes semaine/mois ont maintenant une animation latérale légère dans le sens du mouvement.
- La grille affiche les heures de `08` à `00`.
- Les libellés d'heure sont affichés sans `h`.
- Il n'y a pas de ligne d'en-tête séparée pour les jours.
- Le jour courant reprend le style de la vue mois : numéro noir sur cercle blanc, assez grand pour les dates à 2 chiffres.
- La colonne des heures doit rester très collée à gauche pour perdre le moins d'espace possible.

### Vue `month`

- La navigation se fait par swipe horizontal, pas avec des flèches.
- Les swipes semaine/mois ont maintenant une animation latérale légère dans le sens du mouvement.
- La grille mensuelle reste visible.
- Le panneau du bas avec les événements du jour peut scroller.
- Le panneau du bas a été agrandi pour laisser plus de place aux événements du jour.
- Un appui bref sur un jour ne crée pas d'événement : il sélectionne le jour et met à jour le panneau du bas.
- Le bouton flottant `+` est présent dans cette vue et crée un événement à la date actuellement sélectionnée.

## Création et édition d'événements

L'application permet d'ajouter, modifier et supprimer des événements.

Champs du formulaire :

- `Titre`
- `Toute la journée`
- `Date de début`
- `Heure de début`
- `Date de fin`
- `Heure de fin`
- `Lieu`
- `Couleur`

Contraintes :

- Champs obligatoires : `Titre`, `Date de début`, `Date de fin`
- Les heures sont optionnelles
- Les minutes sont limitées à `00`, `15`, `30`, `45`
- Si l'utilisateur modifie la date de début, la date de fin suit automatiquement tant qu'elle n'a pas été explicitement changée ensuite
- Le champ lieu est sur une seule ligne

La création contextuelle dépend de la vue :

- `planning` : via le bouton `+`
- `week` : appui bref sur une colonne/jour pour créer avec jour + heure par défaut selon la position du doigt
- `month` : le bouton `+` crée à la date sélectionnée ; un appui bref sur un jour sert à sélectionner ce jour et afficher ses événements en bas

Important :

- Un appui long ne doit jamais créer d'événement
- La création doit partir uniquement sur appui bref
- Si l'utilisateur choisit une nouvelle `date de début` postérieure à la `date de fin` actuelle, alors `date de fin` doit automatiquement prendre la valeur de la nouvelle `date de début`

## Appui long `sur site`

Un appui long sur un jour permet de marquer la journée comme `sur site`.

Surfaces concernées :

- bloc d'un jour en vue `planning`
- colonne d'un jour en vue `week`
- case d'un jour en vue `month`

Règles :

- L'information n'est pas affichée sous forme de texte
- Le jour est mis en avant par une couleur discrète, avec faible opacité
- Les événements doivent rester plus visibles que l'état `sur site`
- L'appui long sert uniquement à cette action et ne doit pas ouvrir la création

## Paramètres

Les paramètres ne doivent plus afficher de blocs `sources externes`, `Google` ou `Apple`.

Ils contiennent surtout le référentiel de couleurs utilisateur.

## Référentiel de couleurs

Chaque utilisateur possède un référentiel de couleurs personnalisable.

Règles actuelles :

- 3 couleurs par défaut
- affichées dans les paramètres
- suppression via appui long puis confirmation
- bouton `+` pour ajouter une couleur au référentiel
- la palette de choix prend une grande partie de l'écran, environ `70%` minimum
- la palette propose beaucoup de couleurs et des styles variés
- au clic sur une couleur de la palette, elle est ajoutée au référentiel utilisateur
- les événements ne choisissent leur couleur que parmi le référentiel utilisateur
- si une couleur est supprimée alors que des événements l'utilisent, ces événements doivent être reliés à une autre couleur restante

## Modales

Les modales concernées :

- création / édition d'événement
- paramètres
- palette d'ajout de couleur

Règles :

- elles doivent apparaître au-dessus de l'écran comme de vraies modales
- elles peuvent être fermées par swipe vers le bas en partant du haut
- le formulaire de création / édition est une vraie modale qui recouvre l'écran, pas une simple couche laissant trop voir l'arrière-plan

## Authentification

L'authentification utilise `Firebase Auth` avec `Email/Password`, mais l'expérience utilisateur reste en `identifiant + mot de passe` sans e-mail visible.

Principe :

- l'utilisateur crée un `id` et un `mot de passe`
- à l'inscription, il y a confirmation du mot de passe
- côté code, l'identifiant est converti en e-mail technique de type `username@sync.local`
- la session est persistée côté navigateur

Collections Firestore utilisées :

- `users`
- `userMeta`
- `events`
- `usernames`

## Données stockées

### `CalendarEvent`

Champs principaux :

- `id`
- `userId`
- `title`
- `allDay`
- `startDate`
- `startTime?`
- `endDate`
- `endTime?`
- `location?`
- `colorId`
- `source`
- `sourceMeta?`
- `createdAt`
- `updatedAt`

### `UserMeta`

Champs principaux :

- `locations`
- `sources`
- `onSiteDates`
- `colorPresets`

Même si le type `sources` existe encore dans les données, il n'est plus exposé dans l'UI actuelle des paramètres.

## Persistance et services

Le projet utilise `Firebase` / `Firestore`.

Fichiers techniques importants :

- `/Users/adri/Desktop/Codex/Sync/components/sync-app.tsx` : composant principal, vues, gestes, modales, auth UI
- `/Users/adri/Desktop/Codex/Sync/lib/storage.ts` : auth Firebase, Firestore, CRUD événements, couleurs, jours `sur site`
- `/Users/adri/Desktop/Codex/Sync/lib/types.ts` : types principaux
- `/Users/adri/Desktop/Codex/Sync/lib/colors.ts` : bibliothèque et presets de couleurs
- `/Users/adri/Desktop/Codex/Sync/lib/date.ts` : helpers calendrier
- `/Users/adri/Desktop/Codex/Sync/lib/location.ts` : suggestions de lieu gratuites via Nominatim
- `/Users/adri/Desktop/Codex/Sync/firestore.rules` : règles Firestore

## Intégrations externes

Des traces de modèle existent pour `google` et `apple_birthdays`, mais le produit ne doit plus se concentrer sur ces intégrations pour l'instant.

Direction actuelle :

- priorité à l'amélioration de l'app elle-même
- pas de travail produit prioritaire sur récupération Google / Apple
- pas de blocs d'UI liés aux sources externes dans les paramètres

## Déploiement

Le dépôt cible est :

- [https://github.com/AddriPB/Sync](https://github.com/AddriPB/Sync)

Le projet est configuré pour `GitHub Pages` avec export statique.
- Le workflow Pages a été mis à jour pour `Node 24`.

## Règles UX importantes

- design sombre et minimaliste
- la plus grande partie de l'écran doit être réservée au calendrier
- peu d'espace perdu à gauche et à droite
- la barre du haut est volontairement très compacte, sans le texte `Sync`
- la barre du bas est volontairement très compacte et n'affiche que les icônes des vues
- pas de flèches gauche/droite pour naviguer entre semaine/mois
- navigation par swipe horizontal
- les textes d'interface hors champs de saisie doivent être non sélectionnables

## État actuel à connaître

- `codex.md` est destiné à rester local pour servir de mémoire de projet et économiser du contexte dans les nouvelles discussions
- quand on repart dans une nouvelle discussion, il faut privilégier `codex.md` + l'état réel du code comme source de vérité de départ
- les intégrations Google / Apple ne sont pas la priorité actuelle produit
- on travaille itérativement sur l'ergonomie mobile, les gestes tactiles et la lisibilité du calendrier

## Tests et validation

Avant de finaliser une modification, vérifier autant que possible :

- `npm test`
- `npm run build`

## Conventions de travail utiles

- Les changements se font directement dans ce repo local
- Les corrections ont souvent été poussées directement sur `main`
- Utiliser `apply_patch` pour les éditions manuelles
- Faire attention à ne pas casser les interactions tactiles mobile en corrigeant les vues calendrier
