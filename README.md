# Kanban Grist

Widget personnalisé Grist affichant les lignes d'une table sous forme de tableau Kanban.

## Contenu

- `index.html` — structure et styles de la vue
- `logic.js` — logique pure (testable)
- `widget.js` — câblage Grist / DOM

Dépendances chargées par CDN : l'API plugin Grist et SortableJS (glisser-déposer).

## Développement

```bash
npm test                 # tests unitaires (logic.js)
npm run bundle           # génère dist/index.html + dist/widget.bundle.js
```

## Configuration

Tout se règle dans le panneau de configuration de la vue Grist.

| Option | Type attendu | Rôle |
| --- | --- | --- |
| Titre de la carte | Texte | Libellé affiché en haut de chaque carte (obligatoire) |
| Grouper par | Choix unique | Définit les colonnes du Kanban (obligatoire) |
| Propriétés visibles | Toute colonne, multiple | Champs affichés sous le titre (facultatif) |

Les colonnes du tableau correspondent aux valeurs de la colonne « Grouper par », dans leur ordre et avec les couleurs définies dans l'éditeur de colonne Grist. Réordonner ou recolorer les choix dans Grist se répercute directement sur le Kanban.

Les propriétés visibles sont en lecture seule et rendues selon leur type : badges colorés pour les colonnes Choix et Liste de choix, dates localisées, liens cliquables, et pièces jointes ouvertes dans une visionneuse intégrée (images et PDF affichés en ligne, téléchargement proposé sinon).

Un curseur « Taille » en haut à droite ajuste l'échelle d'affichage entre 50 % et 150 %. La valeur est mémorisée dans les options du widget, donc partagée par le document et restaurée au rechargement ; un utilisateur en lecture seule bénéficie du réglage pour sa session sans qu'il soit enregistré.

## Sélection

Cliquer sur une carte la met en évidence et positionne le curseur Grist sur la ligne correspondante. Le widget déclare `allowSelectBy`, ce qui permet aux autres vues de la page d'utiliser « Sélectionner par » sur ce Kanban et de se filtrer sur la carte active. Déplacer une carte la sélectionne également. Si la ligne sélectionnée disparaît (filtre ou suppression), la sélection est oubliée.

## Filtres et tri

Le widget consomme les enregistrements tels que Grist les lui transmet : les filtres et le tri définis dans l'onglet « Trier et filtrer » de la vue s'appliquent donc au Kanban. Le tri de la vue détermine l'ordre des cartes à l'intérieur de chaque colonne.

## Écriture

Trois actions modifient le document : le déplacement d'une carte vers une autre colonne, qui change sa valeur de groupe, la création d'une carte et sa suppression. L'ordre à l'intérieur d'une colonne n'est pas persisté, puisqu'il découle du tri de la vue. Titre et propriétés se modifient depuis Grist (vue fiche par exemple).

Un bouton « + » dans l'entête de chaque colonne et un bouton en pied de colonne créent une carte vide dans cette colonne, sans formulaire intermédiaire : la carte est ajoutée puis sélectionnée, l'édition se fait ensuite dans Grist. Une icône corbeille apparaît au survol de chaque carte et demande confirmation avant suppression définitive.

Ces boutons ne sont pas affichés lorsque le document est ouvert en lecture seule ou que le widget ne dispose pas de l'accès complet.

### Création et filtres

Pour qu'une carte créée dans une vue filtrée ne disparaisse pas aussitôt, le widget la préremplit avant de l'enregistrer, à partir :

- des filtres **enregistrés** de la vue (métadonnées `_grist_Filters`), lorsque la section du widget peut être identifiée ;
- du linking **Sélectionner par** : toute colonne Référence (ou Liste de références) qui a la même valeur sur toutes les cartes déjà visibles est recopiée sur la nouvelle carte — c'est typiquement la colonne qui relie le Kanban à la vue source (ex. l'offre sélectionnée).

L'API des widgets n'exposant ni les filtres ni le curseur de la vue source, cela implique :

- seuls les filtres **enregistrés** sont pris en compte ; un filtre posé sans être sauvegardé reste côté client et demeure invisible du widget ;
- seuls les filtres par valeurs incluses sont exploités, la première valeur de la liste étant retenue ; les filtres par exclusion et les plages de valeurs sont ignorés ;
- si le tableau est vide à cause du « Sélectionner par » (aucune carte pour la ligne source choisie), la valeur du lien ne peut pas être déduite.

Quand la carte créée n'est malgré tout pas visible parce que les filtres ou le linking actifs l'excluent, un message le signale plutôt que de laisser croire à un échec de la création.
