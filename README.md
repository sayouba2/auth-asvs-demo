# Accès — démonstrateur d'authentification

Application française Next.js (App Router) + NestJS + PostgreSQL/Prisma + Redis.
Inscription, connexion, page protégée, changement de mot de passe et déconnexion.
Après connexion, le titre est exactement **« Bienvenue ! Vous êtes authentifié. »**.

Le périmètre étudié est **OWASP ASVS 5.0.0, chapitre V6, niveau L1**.
Il ne s'agit ni d'une certification, ni d'une évaluation globale ASVS.
Les résultats effectifs et les vérifications encore manquantes se trouvent
dans [TEST.md](TEST.md) et [le rapport](security/evidence/report.md).

## Installation locale

Prérequis : Node.js >= 20.19 (Node 22 LTS conseillé), pnpm 10.34.7, Docker avec
le plugin Compose. Le terminal doit accéder au registre npm, aux moteurs Prisma
et au téléchargement Chromium pour Playwright.

```bash
npm install --global pnpm@10.34.7
pnpm install
pnpm setup:env
docker compose up -d postgres redis
pnpm --filter @demo/api prisma generate
pnpm --filter @demo/api prisma migrate dev
pnpm dev
```

Ouvrir **http://localhost:3000/register**. Aucun compte n'est précréé.
L'inscription mène à la connexion. Le changement révoque toutes les sessions
et demande une nouvelle connexion.

`setup:env` crée un `.env` local, non versionné, avec des secrets aléatoires
et des permissions 0600. Il ne remplace jamais un fichier existant.
Le mot de passe PostgreSQL est un identifiant technique, pas un compte applicatif.

La seule origine publique est `PUBLIC_ORIGIN`. Le navigateur appelle
`/api/*`, transmis à Nest par Next. L'adresse interne
`http://127.0.0.1:3001` n'est utilisée que par les serveurs.
Les ports de PostgreSQL (54329) et Redis (63799) sont liés à 127.0.0.1.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Démarrer les deux serveurs |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict API et interface |
| `pnpm build` | Compiler Nest et Next |
| `pnpm test:static` | Vérifications de fichiers sans base de données |
| `pnpm test` | Jest + Supertest sur PostgreSQL et Redis réels |
| `pnpm test:e2e` | Tests API, puis Playwright |
| `pnpm test:security` | Tests API + interface et rapport des 13 exigences |

Avant les tests navigateur :

```bash
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
```

Si Chrome est déjà installé : `CHROME_PATH=/usr/bin/google-chrome pnpm test:e2e`.
Les tests utilisent un **schéma PostgreSQL neuf** `asvs_test_<aléatoire>`,
migré puis supprimé en fin d'exécution. Ils utilisent des clés Redis avec
un espace de noms aléatoire et un secret HMAC propre. Aucun FLUSHDB,
aucune suppression dans le schéma public. Utiliser malgré tout une base
de développement dédiée, jamais une base de production pour les tests.
Le test de base fraîche vérifie zéro utilisateur immédiatement après migration.

Ports de test : 3100 (interface) et 3101 (API), configurables via
`TEST_WEB_PORT` et `TEST_API_PORT`. Les serveurs de test sont lancés
et arrêtés par Playwright. Les tests refusent de réutiliser un serveur existant.
Deux instances NestJS vérifient le partage réel des compteurs Redis.
Les tests de TTL contrôlent la valeur réelle puis accélèrent uniquement la clé
de test pour vérifier l'expiration sans attendre 5 minutes.

Les journaux et résultats JSON sont écrits dans `security/evidence/`
(ignorés par Git pour éviter de publier des données d'exécution).
Le rapport Markdown distingue PASS / FAIL / NON TESTÉ / N/A justifié.
La revue manuelle est enregistrée séparément dans
`security/manual-review.json` ; elle ne prouve pas l'exécution des tests.

## Choix de sécurité

- Argon2id : 64 Mio, 3 passes, parallélisme 1, sel aléatoire propre à chaque hash.
- Mot de passe de 8 à 128 points de code Unicode, sans transformation ;
  15+ recommandé à l'écran. Aucun critère de composition. Séquences Unicode
  malformées refusées pour éviter un remplacement implicite lors de l'encodage.
- [Liste réelle de 10 000 mots courants](security/password-blocklist.md),
  filtrée et versionnée à partir de SecLists, licence MIT incluse.
- Sessions de 12 h, jeton CSPRNG de 32 octets ; seul SHA-256 persisté.
  Cookie HttpOnly, SameSite=Lax, Path=/ ; Secure et préfixe __Host- en HTTPS.
- Vérification en base par le guard Nest à chaque requête privée ;
  les pages privées interrogent Nest côté serveur avant leur rendu.
- Le changement utilise un verrou de ligne PostgreSQL et révoque toutes
  les sessions dans la même transaction. La connexion partage ce verrou
  pour éviter qu'un ancien mot de passe crée une session après le changement.
- Les sessions expirées sont supprimées toutes les heures tant que l'API tourne.
- Vérification stricte Origin, ou Referer seulement si Origin est absent,
  pour toutes les mutations, y compris inscription et connexion.
- [Politique anti-abus](security/rate-limiting.md) : Redis partagé,
  réservations atomiques avant Argon2, 429/Retry-After, refus fermé en panne.
- Logs limités aux événements et identifiants HMAC ; pas de corps de requête,
  e-mail brut, IP brute, hash de mot de passe ou cookie.

## Déploiement

Configurer HTTPS et `NODE_ENV=production`, une origine HTTPS exacte,
des secrets `PROXY_SECRET` et `RATE_LIMIT_SECRET` distincts et communs aux
instances, ainsi que PostgreSQL/Redis privés et protégés. L'application refuse
une origine HTTP en production. Le mode HTTP n'est permis qu'à localhost
en développement.

Le serveur Next personnalisé doit être lancé avec
`pnpm --filter @demo/web start` (pas `next start`) : il établit l'adresse
client transmise à Nest. Il n'existe aucune confiance implicite dans
X-Forwarded-For. Si un reverse proxy TLS précède Next, configurer
`TRUSTED_PROXY_IP` avec son adresse TCP exacte et lui faire **remplacer**
X-Forwarded-For par l'adresse du client, sans conserver l'en-tête entrant.
Ne jamais exposer le port API ou publier les secrets proxy côté navigateur.
En déploiement multi-hôtes, protéger également le transport interne.

Appliquer les migrations avec `pnpm --filter @demo/api prisma migrate deploy`,
compiler avec `pnpm build`, lancer l'API avec
`pnpm --filter @demo/api start`. En production, injecter explicitement
les variables d'environnement au processus API (le script start ne lit pas .env).

Les limites proposées ne suffisent pas contre tous les réseaux d'attaque
distribués. Mesurer les coûts Argon2 et le trafic, surveiller les logs,
prévoir une réponse graduée au proxy. Le démonstrateur ne vérifie pas la
possession de l'adresse e-mail et n'offre pas de récupération de compte.
L'inscription peut indiquer qu'une adresse n'est pas disponible ; la connexion
emploie un échec générique et un hash fictif pour les comptes inconnus.
Évaluer les autres chapitres ASVS avant toute utilisation sensible.

## État de validation dans l'environnement de création

Le code et les suites sont fournis. Les contrôles statiques de la liste,
des migrations et de l'inventaire fonctionnel ont été exécutés.
Un lint avec les règles du projet a également réussi hors ligne, avec des
outils compatibles déjà présents sur la machine (ESLint 9.39.5,
typescript-eslint 8.68.0, globals 16.5.0). Voir
`security/evidence/lint-offline.json` pour la version et l'empreinte des règles.
L'installation des dépendances, le typecheck complet, les tests API
et Playwright restent à exécuter : le terminal de création ne résout pas
le registre npm et n'accède pas au socket Docker, même après redémarrage.
Sans dépendances installées, aucun lockfile vérifié n'est disponible :
après une installation réussie, conserver le `pnpm-lock.yaml` généré et
utiliser `pnpm install --frozen-lockfile` en CI.
