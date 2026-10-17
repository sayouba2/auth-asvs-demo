# TEST.md — Plan de vérification OWASP ASVS 5.0.0 / V6 / L1

## 1. Objectif

Vérifier l'application **Next.js + NestJS** de `AGENTS.md` : demande d'inscription validée par un administrateur, mot de passe initial, connexion, changement de mot de passe, déconnexion et page `/welcome` protégée affichant **« Bienvenue ! Vous êtes authentifié. »**.

**Référentiel :** [OWASP ASVS 5.0.0 — V6 Authentication](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md). La suite comprend **13 exigences L1**. La vérification V6.4.1 peut être **N/A** uniquement si aucun mot de passe initial ou code d'activation n'est généré.

**Attention :** ce document est **un plan de test**, pas un procès-verbal de conformité. Aucune case n'est « PASS » avant exécution effective.

## 2. Préparation de l'environnement

- Backend NestJS et frontend Next.js accessibles derrière la **même origine** (proxy `/api`).
- PostgreSQL et Redis de test opérationnels, schéma migré, base **isolée** et réinitialisable.
- Données de tests : un utilisateur créé via API (`test-user@example.test`) et aucun compte système prédéfini.
- Liste de mots de passe interdits traçable, contenant **au moins 3 000 valeurs distinctes compatibles avec la politique de longueur**. Noter le nombre effectif et un exemple bloqué validé par fixture.
- URL cible par défaut : `http://localhost:3000` ; remplacer par URL HTTPS du déploiement pour la vérification de `Secure`.
- Outils : **Jest + Supertest** (API), **Playwright** (navigateur), éventuellement `curl` pour inspection manuelle. Les tests doivent être automatiques et répétables.
- Utiliser des mots de passe **fictifs** dans les fixtures. Ne jamais publier des cookies réels, des mots de passe ou des secrets dans les rapports.

**États de résultats :** `PASS`, `FAIL`, `NON TESTÉ`, `N/A` (avec justification et preuve). Toute exigence conditionnelle non testée et sans justification reste `NON TESTÉ`.

## 3. Scénarios fonctionnels fondamentaux

| ID | Scénario | Résultat attendu |
|---|---|---|
| F-01 | Ouvrir `/register`, demander un compte (e-mail seul) ; l'administrateur valide sur `/admin` et envoie les identifiants. | Demande enregistrée sans mot de passe ; compte créé à la validation ; aucune donnée sensible renvoyée hors mot de passe initial à l'administrateur. |
| F-02 | Se connecter avec le compte créé. | Session valide ; redirection vers `/welcome`. |
| F-03 | Consulter `/welcome` avec session valide. | Affichage exact : **« Bienvenue ! Vous êtes authentifié. »** |
| F-04 | Consulter `/welcome` sans cookie puis appeler `GET /api/auth/me`. | Redirection vers `/login` ; API répond `401`. |
| F-05 | Modifier le mot de passe avec l'ancien et un nouveau valides. | Changement réussi ; **sessions existantes révoquées** ; reconnexion requise. |
| F-06 | Tenter une connexion avec l'ancien mot de passe puis le nouveau. | Ancien refusé ; nouveau accepté. |
| F-07 | Se déconnecter et réutiliser l'ancien cookie. | Cookie supprimé ; session révoquée ; `GET /api/auth/me` répond `401`. |
| F-08 | Modifier le mot de passe ou consulter `me` sans session. | `401` ; aucune modification réalisée. |
| F-09 | Envoyer des identifiants erronés avec e-mail inconnu puis e-mail connu. | Messages d'erreur génériques ; aucune information sur l'existence du compte. |

## 4. Tests normatifs — les 13 exigences L1

### T-01 — V6.1.1 : politique anti-force-brute documentée

**Procédure :** lire `security/rate-limiting.md` ; vérifier la présence des seuils, fenêtres, critères de comptage (IP et combinaison IP+compte), stockage Redis, codes `429`, `Retry-After`, configuration proxy, conduite en cas de panne Redis, prévention du verrouillage de compte malveillant et politique de journalisation.

**Attendu :** documentation concordante avec les paramètres du code ; aucune configuration « implicite » non décrite. **Preuves :** fichier, configuration du rate limiter et revue croisée. **Automatisation :** contrôle de configuration + revue manuelle.

### T-02 — V6.2.1 : longueur minimale

**Procédure :** tenter un changement de mot de passe avec 7, 8, 14 et 15 caractères, en choisissant des valeurs absentes de la liste d'interdiction. Contrôler aussi l'envoi direct par API.

**Attendu :** 7 caractères refusés ; 8, 14 et 15 acceptés si non interdits ; indication visible que **15+ caractères sont recommandés**. **Preuves :** tests API et capture UI.

### T-03 — V6.2.2 : changement de mot de passe disponible

**Procédure :** se connecter, ouvrir `/account/security`, changer le mot de passe puis se reconnecter avec le nouveau.

**Attendu :** fonctionnalité accessible à l'utilisateur authentifié ; ancien secret inutilisable, nouveau opérationnel ; éventuelles autres sessions révoquées selon la conception. **Preuves :** Playwright + Supertest.

### T-04 — V6.2.3 : ancien et nouveau mots de passe requis

**Procédure :** appeler `POST /api/auth/change-password` avec (a) ancien absent, (b) nouveau absent, (c) ancien erroné, (d) ancien correct et nouveau valide.

**Attendu :** (a), (b), (c) refusés sans mutation ; seul (d) réussit. Le contournement par appel API direct doit échouer. **Preuves :** assertions API, vérification d'absence de changement dans la base.

### T-05 — V6.2.4 : liste de mots de passe courants

**Procédure :** vérifier que la source fournit **au moins 3 000 mots de passe fréquents distincts qui satisfont la politique de longueur** (8+). Essayer un mot de passe présent dans cette liste au changement, via formulaire **et** API, et vérifier que les mots de passe initiaux générés n'y figurent pas ; puis un mot de passe fort absent.

**Attendu :** valeurs listées refusées sur les deux parcours ; valeur non listée acceptée si les autres règles sont respectées. **Preuves :** compteur vérifiable du dataset, origine/version du fichier et tests intégration. Ne pas fabriquer artificiellement des valeurs pour atteindre 3 000.

### T-06 — V6.2.5 : aucune règle de composition

**Procédure :** tester des mots de passe autorisés par longueur et absents de la liste : uniquement des minuscules, uniquement des majuscules, uniquement des chiffres, phrase avec espaces, caractères accentués et symboles. Vérifier le changement via API.

**Attendu :** aucune obligation de catégorie (chiffres, majuscules, symboles). Un mot de passe peut être rejeté s'il figure dans la liste interdite, et **non** pour une règle de composition. **Preuves :** tests paramétrés.

### T-07 — V6.2.6 : masquage des champs

**Procédure :** inspecter les pages `/register`, `/login` et `/account/security` avec Playwright.

**Attendu :** tous les champs de mot de passe et de confirmation sont `input[type=password]` par défaut ; une éventuelle fonction « afficher » reste volontaire et temporaire. **Preuves :** assertions DOM + captures.

### T-08 — V6.2.7 : collage et gestionnaires de mots de passe

**Procédure :** coller une valeur dans chacun des champs de mot de passe ; inspecter l'absence de `onpaste` bloquant et `autocomplete` : `current-password` pour connexion/ancien mot de passe, `new-password` pour nouveau mot de passe et confirmation ; `username` pour l'e-mail.

**Attendu :** collage effectif ; autocomplétion et gestionnaires non désactivés par le site. **Preuves :** Playwright (collage) + inspection DOM. La compatibilité avec différents gestionnaires tiers peut nécessiter une vérification manuelle.

### T-09 — V6.2.8 : vérification sans modification du mot de passe

**Procédure :** créer des comptes de test séparés avec valeurs distinctes par la casse (`Abc…` vs `abc…`), par les espaces initiaux/finaux, par les accents et par les séquences Unicode distinctes si acceptées ; essayer chaque variante à la connexion. Utiliser des secrets absents de la liste bloquée.

**Attendu :** seule la séquence exacte enregistrée authentifie. Aucun `trim`, changement de casse, normalisation Unicode ou troncature. **Preuves :** tests API paramétrés et revue du service de hachage/vérification.

### T-10 — V6.3.1 : protections contre les attaques réellement actives

**Procédure :** en environnement isolé, dépasser les **5 échecs / 5 minutes pour (IP,e-mail)** puis les **30 tentatives / 15 minutes par IP**, d'après la configuration retenue. Tester les limites via API, la durée des fenêtres, les réponses `429`, `Retry-After` et la persistance des compteurs avec deux instances de l'API. Vérifier que le compte ne reste pas bloqué indéfiniment par un tiers.

**Attendu :** protection conforme au document V6.1.1, avec preuve de bon fonctionnement et absence de verrouillage permanent de compte. Vérifier aussi le comportement derrière le proxy et en cas de Redis indisponible. **Preuves :** tests contrôlés, captures des réponses HTTP et état des compteurs ; ne pas lancer de charge contre un système tiers.

### T-11 — V6.3.2 : aucun compte utilisateur par défaut

**Procédure :** inspecter migrations, seeders, scripts d'initialisation, variables d'environnement et base fraîche ; chercher les comptes `admin`, `root`, `sa` créés par l'application.

**Attendu :** aucun compte utilisateur applicatif par défaut actif. Les comptes techniques PostgreSQL/Redis ne sont pas des utilisateurs applicatifs, mais doivent être protégés séparément. **Preuves :** revue du code et requête dans la table `User` après migration sans inscription.

### T-12 — V6.4.1 : mots de passe initiaux / codes d'activation

**Procédure :** demander un compte, le faire valider par un administrateur, puis vérifier : mot de passe initial généré par CSPRNG (24 caractères, 144 bits), distinct à chaque validation et conforme à la politique ; seul son hash Argon2id est stocké ; refus après 24 h ; refus d'une seconde connexion avec le même secret ; la session obtenue impose le changement, refuse l'administration et refuse un nouveau mot de passe identique au secret initial ; après changement, le secret initial ne fonctionne plus.

**Attendu :** `PASS` ou `FAIL` selon preuve (tests API, Playwright et contrôle statique).

### T-13 — V6.4.2 : aucun indice ni question secrète

**Procédure :** rechercher dans les écrans, routes, DTO, schéma SQL/Prisma et code toute fonctionnalité d'indices ou questions de sécurité du type « nom de jeune fille de votre mère », « ville de naissance », `passwordHint`, `securityQuestion`.

**Attendu :** ces mécanismes sont absents, y compris dans un éventuel parcours de récupération ajouté ultérieurement. **Preuves :** revue du dépôt, inspection UI et API.

## 5. Tests complémentaires utiles (hors périmètre normatif strict V6/L1)

| ID | Contrôle | Résultat attendu |
|---|---|---|
| C-01 | Examiner le cookie de session en production HTTPS. | `HttpOnly`, `Secure`, `SameSite=Lax`, durée limitée, pas de jeton dans `localStorage`. |
| C-02 | Lire la table des sessions. | Uniquement le **hachage** du jeton ; pas de jeton brut. |
| C-03 | Lire la table des utilisateurs. | Hash Argon2id, jamais de mot de passe en clair. |
| C-04 | Rejouer une session expirée ou révoquée. | `401` ; `/welcome` inaccessible. |
| C-05 | Changer le mot de passe avec deux sessions actives. | Révocation de **toutes** les sessions, y compris sur un autre navigateur. |
| C-06 | Simuler une requête de mutation inter-origine non autorisée. | Rejet par la protection CSRF/Origin. |
| C-07 | Inspecter les réponses et logs après connexion échouée. | Ni hash, ni mot de passe, ni cookie brut, ni fuite de secrets. |
| C-08 | Appeler les API privées en contournant Next.js. | Le guard NestJS bloque tout accès non authentifié. |
| C-09 | Vérifier le rendu initial de `/welcome` sans session. | Redirection serveur ; aucune donnée privée rendue avant le contrôle. |

**Remarque :** ces contrôles améliorent le démonstrateur, mais réussir uniquement V6/L1 ne constitue **pas** une vérification globale ASVS L1 (les autres chapitres existent).

## 6. Organisation des suites et commandes attendues

Proposer les fichiers de test suivants :

```text
apps/api/test/auth.e2e-spec.ts            # F-01 à F-09, T-02 à T-06, T-09
apps/api/test/rate-limit.e2e-spec.ts      # T-10
apps/api/test/password-policy.spec.ts     # T-02, T-05, T-06, T-09
apps/web/tests/auth.spec.ts               # Connexion, bienvenue, déconnexion
apps/web/tests/password-fields.spec.ts    # T-07, T-08
```

Créer les scripts suivants à la racine du projet :

```bash
pnpm lint
pnpm typecheck
pnpm test               # Jest : unitaires et intégration
pnpm test:e2e           # Playwright et tests API E2E
pnpm test:security      # Sous-ensemble nommé T-01 à T-13 + contrôles statiques
```

La suite `test:security` doit produire un rapport lisible indiquant **exigence → test(s) → résultat → preuve**. Les vérifications manuelles (documentation, inventaire du code, gestionnaires de mots de passe) doivent figurer explicitement dans ce rapport ; elles ne deviennent pas automatiquement `PASS` parce qu'un script se termine à zéro.

## 7. Matrice de traçabilité à compléter après exécution

| Exigence | Test | Statut | Preuve / observation |
|---|---|---|---|
| V6.1.1 | T-01 | PASS | Constantes du code identiques à `security/rate-limiting.md` ; revue documentaire |
| V6.2.1 | T-02 | PASS | Changement avec 7/8/14/15/64/128 caractères ; recommandation 15+ visible (Playwright) |
| V6.2.2 | T-03 | PASS | Changement puis reconnexion ; révocation de toutes les sessions (API et Playwright) |
| V6.2.3 | T-04 | PASS | Secret actuel absent, absent ou faux : refus sans mutation |
| V6.2.4 | T-05 | PASS | 10 000 entrées vérifiées ; refus au changement par API et formulaire |
| V6.2.5 | T-06 | PASS | Composition libre acceptée au changement |
| V6.2.6 | T-07 | PASS | Champs `type="password"` sur `/login` et `/account/security` ; aucun sur `/register` |
| V6.2.7 | T-08 | PASS | Collage réel et `autocomplete` ; gestionnaires tiers non testés |
| V6.2.8 | T-09 | PASS | Casse, espaces, accents, NFC/NFD, absence de troncature, Unicode malformé |
| V6.3.1 | T-10 | PASS | Deux instances, concurrence, TTL, proxy, IP forgées et panne Redis |
| V6.3.2 | T-11 | PASS | Migrations sans insertion ; 0 utilisateur dans une base fraîche ; premier admin créé par l'opérateur |
| V6.4.1 | T-12 | PASS | Mot de passe initial CSPRNG, haché, expiré après 24 h ou au premier usage, remplacement imposé et différent |
| V6.4.2 | T-13 | PASS | Recherche statique et revue des routes, DTO, schéma et UI : aucun indice ni question secrète |

État relevé le 17 octobre 2026 (`pnpm test:security`, Jest 47/47, Playwright 7/7 avec
`CHROME_PATH=/usr/bin/google-chrome`). Voir [le rapport d'exécution](security/evidence/report.md)
et [la revue manuelle](security/manual-review.json). Restent NON TESTÉ hors matrice : le cookie
`Secure` sur un vrai déploiement HTTPS et la compatibilité avec des gestionnaires de mots de passe tiers.

**Critère de clôture :** tous les tests fonctionnels F-01 à F-09 réussissent, les **13 exigences** ont un résultat justifié, aucun contrôle applicable n'est `FAIL` ou `NON TESTÉ`, et les preuves peuvent être reproduites depuis une base propre.
