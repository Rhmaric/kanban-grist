# Widgets Grist

Widgets personnalisés pour [Grist](https://www.getgrist.com/). La configuration et le fonctionnement de chacun sont décrits dans son propre README :

| Widget | Documentation | URL à coller dans Grist |
| --- | --- | --- |
| Kanban | [kanban/README.md](kanban/README.md) | [https://rhmaric.github.io/kanban-grist/](https://rhmaric.github.io/kanban-grist/) |
| Matrice des risques | [risk-matrix/README.md](risk-matrix/README.md) | [https://rhmaric.github.io/kanban-grist/risk-matrix/](https://rhmaric.github.io/kanban-grist/risk-matrix/) |

## Contenu

Chaque widget a son dossier (`kanban/`, `risk-matrix/`), avec le même découpage :

- `README.md` — configuration et fonctionnement
- `index.html` — structure de la vue
- `styles.css` — styles
- `logic.js` — logique pure (testable)
- `widget.js` — câblage Grist / DOM

Les tests sont rangés de la même façon dans `test/kanban/` et `test/risk-matrix/`.

Les deux dépendances, l'API plugin Grist et SortableJS (glisser-déposer), sont téléchargées dans `vendor/` (non versionné) puis intégrées au bundle : aucune ressource n'est chargée depuis un domaine tiers à l'exécution.

## Développement

```bash
npm ci                   # outils de développement (ESLint)
npm run vendor:update    # télécharge les dépendances des widgets dans vendor/
npm run check            # lint, tests, contrôle de vendor/, bundle et contrôle de dist/
```

Scripts unitaires : `npm run lint`, `npm test`, `npm run check:vendor`, `npm run bundle` (génère `dist/` pour le kanban et `dist/risk-matrix/` pour la matrice) et `npm run check:dist`.

## Intégration continue

Le workflow **CI** tourne sur chaque pull request et chaque push sur `main` :

- `npm audit` sur les outils de développement ;
- ESLint avec des règles de sécurité : `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` et `no-unsanitized`, qui refuse tout `innerHTML` alimenté par autre chose qu'un littéral ;
- tests unitaires ;
- téléchargement de `vendor/` et contrôle qu'aucune dépendance n'utilise `eval` ou `new Function` ;
- bundle, puis contrôle des pages de `dist/` : pas de script ni de ressource externe, pas de script, style ou gestionnaire d'événement inline, CSP stricte présente ;
- analyse CodeQL (requêtes `security-extended`).

## Sécurité

### Content Security Policy

Chaque page embarque une CSP en balise meta, GitHub Pages ne permettant pas d'en-têtes HTTP :

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none';
form-action 'none'; base-uri 'none'; object-src 'none'
```

Scripts et styles ne peuvent venir que du widget lui-même, et le widget ne peut émettre aucune requête réseau (`connect-src 'none'`) : un code injecté ne pourrait pas envoyer les données du document vers un serveur tiers par `fetch` ou XHR. Grist communique avec le widget par `postMessage`, que la CSP ne restreint pas.

Le kanban autorise en plus `img-src https:` et `frame-src https:` pour sa visionneuse de pièces jointes, servies par l'instance Grist dont le domaine n'est pas connu à l'avance (voir [kanban/README.md](kanban/README.md#sécurité)).

Limites :

- en balise meta, `frame-ancestors` et `report-uri` sont ignorés par les navigateurs ;
- `img-src https:` laisse au kanban la possibilité de charger une image depuis n'importe quel domaine HTTPS, ce qui reste un canal d'exfiltration possible par l'URL d'une image.

### Dépendances

`npm run vendor:update` télécharge :

- l'API plugin depuis `https://grist.numerique.gouv.fr/grist-plugin-api.js`. Celle de `docs.getgrist.com` est un build webpack de développement truffé d'`eval`, que la CSP bloquerait ;
- SortableJS depuis le registre npm, en version épinglée dans le script, avec vérification de l'intégrité du tarball annoncée par le registre.

`vendor/` n'est pas versionné et ses empreintes ne sont pas vérifiées : chaque build embarque la version de l'API plugin servie à cet instant.

### Droits demandés

Les deux widgets demandent l'accès **document complet**, seul niveau Grist qui permette d'écrire. Il donne aussi accès en lecture et en écriture à toutes les tables du document : ne l'accorder qu'à une URL de widget de confiance.

## Publication

Le workflow **Publier le widget** (onglet Actions) rejoue d'abord la CI complète, crée une release GitHub et déploie le bundle sur GitHub Pages. L'URL publique ainsi obtenue se colle dans Grist (vue personnalisée → URL personnalisée).

### Première mise en service

1. Dans le dépôt : **Settings → Pages → Build and deployment → Source** = **GitHub Actions**.
2. **Actions → Publier le widget → Run workflow**, avec une version semver (`1.0.0`).

Les widgets sont alors servis sur `https://<compte>.github.io/kanban-grist/` (Kanban) et `https://<compte>.github.io/kanban-grist/risk-matrix/` (matrice des risques). Accorder ensuite l'accès **document complet** dans Grist ; le détail de la configuration est dans le README de chaque widget (voir [le tableau en tête](#widgets-grist)).

Une version préliminaire (`1.0.0-beta.1`) crée une release sans remplacer l'URL GitHub Pages.
