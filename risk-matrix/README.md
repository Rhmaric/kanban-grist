# Matrice des risques

Widget personnalisé Grist qui place chaque ligne d'une table dans une matrice 4 × 4 Gravité × Probabilité, sous la forme d'une pastille `R` suivie de l'identifiant de ligne Grist (`R12` pour la ligne 12). Cet identifiant reste stable quel que soit le tri ou le filtre de la vue.

URL à coller dans Grist (vue personnalisée → URL personnalisée) : `https://<compte>.github.io/kanban-grist/risk-matrix/` (pour ce dépôt : [https://rhmaric.github.io/kanban-grist/risk-matrix/](https://rhmaric.github.io/kanban-grist/risk-matrix/)).

Accorder l'accès **document complet**, requis pour déplacer les pastilles.

## Configuration

Tout se règle dans le panneau de configuration de la vue Grist.

| Option | Type attendu | Rôle |
| --- | --- | --- |
| Gravité | Entier (1 à 4) | Axe vertical, 4 en haut (obligatoire) |
| Probabilité | Entier (1 à 4) | Axe horizontal, 4 à droite (obligatoire) |
| Intitulé (infobulle) | Texte | Affiché au survol d'une pastille (facultatif) |

Les risques les plus graves et les plus probables se trouvent donc en haut à droite. Chaque case est colorée selon le produit gravité × probabilité : vert jusqu'à 2, jaune de 3 à 6, orange pour 8 et 9, rouge à partir de 12.

## Sélection

Cliquer une pastille la met en évidence et positionne le curseur Grist sur la ligne ; `allowSelectBy` permet aux autres vues de la page de se filtrer dessus. À l'inverse, déplacer le curseur dans une autre vue met en évidence la pastille correspondante.

## Déplacement

Glisser une pastille vers une autre case écrit la gravité et la probabilité de cette case en une seule action, qu'un seul « Annuler » dans Grist défait. Une pastille du bandeau « Non positionnés » peut être placée dans la matrice ; le bandeau n'accepte en revanche aucun dépôt. Le déplacement est désactivé lorsque le document est en lecture seule ou que le widget n'a pas l'accès complet. En cas d'échec (colonne formule, droits insuffisants), un message s'affiche et la pastille reprend sa place.

## Lignes non positionnées, filtres et tri

Les lignes dont la gravité ou la probabilité est vide ou hors de 1 à 4 sont listées sous la matrice, dans le bandeau « Non positionnés », et restent cliquables. Les filtres et le tri de la vue s'appliquent : le tri détermine l'ordre des pastilles dans une case.
