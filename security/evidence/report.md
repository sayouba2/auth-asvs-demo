# Résultats V6/L1

Exécution : 2026-10-17T19:08:41.536Z

| Exigence | Test | Résultat | Preuve |
|---|---|---|---|
| V6.1.1 | T-01 | PASS | jest.json (1 assertions) ; security/rate-limiting.md : présence des paramètres et procédures ; revue de concordance toujours nécessaire. ; Revue documentaire : LIMITS et rate-limiting.md concordent (30/900, 5/300, 10/900, 5/900). Lua atomique, pas de prolongation sur refus, HMAC des clés, refus fermé 503, proxy explicite et limites distribuées documentés. Exécution Redis évaluée séparément par T-10. |
| V6.2.1 | T-02 | PASS | jest.json (7 assertions) ; playwright.json (1 scénarios) |
| V6.2.2 | T-03 | PASS | jest.json (1 assertions) ; playwright.json (1 scénarios) |
| V6.2.3 | T-04 | PASS | jest.json (1 assertions) |
| V6.2.4 | T-05 | PASS | jest.json (2 assertions) ; playwright.json (1 scénarios) ; 10000 entrées, unicité, longueur et SHA-256 ; source et licence versionnées. |
| V6.2.5 | T-06 | PASS | jest.json (6 assertions) |
| V6.2.6 | T-07 | PASS | playwright.json (2 scénarios) |
| V6.2.7 | T-08 | PASS | playwright.json (2 scénarios) |
| V6.2.8 | T-09 | PASS | jest.json (7 assertions) |
| V6.3.1 | T-10 | PASS | jest.json (9 assertions) ; playwright.json (1 scénarios) |
| V6.3.2 | T-11 | PASS | Migration DDL seule, aucun seeder ; contrôle complémentaire de base fraîche par le lanceur. ; Revue migrations, package.json et setup-env.mjs : aucun INSERT ni seed. Le premier administrateur est créé par l'opérateur (pnpm admin:create) avec un mot de passe initial aléatoire à usage unique : aucun compte ni secret par défaut livré. ; 0 utilisateur après migration dans un schéma neuf |
| V6.4.1 | T-12 | PASS | jest.json (3 assertions) ; playwright.json (1 scénarios) ; Mot de passe initial généré par CSPRNG (randomBytes), expirant après 24 h ou au premier usage ; inventaire des routes. ; Inscription sans mot de passe ; l'administrateur valide la demande. Mot de passe initial : randomBytes(18) (144 bits), conforme à la politique, seul le hash Argon2id est stocké, valable 24 h et consommé à la première connexion ; la session obtenue impose le choix d'un nouveau mot de passe différent. Envoi par lien mailto depuis la messagerie de l'administrateur. |
| V6.4.2 | T-13 | PASS | Inventaire du schéma, DTO, contrôleur et écrans : aucun indice ni question secrète. ; Revue complète des routes, DTO, schéma Prisma, composants et pages : aucune question secrète ou indication du mot de passe ; aucun parcours de récupération. |

Contrôles manuels : voir ../manual-review.json. Compatibilité avec les gestionnaires tiers : NON TESTÉ.
C-01 sur déploiement HTTPS réel : NON TESTÉ (configuration et attributs testés séparément).
Ce rapport ne constitue pas une certification ASVS ni une évaluation des autres chapitres.
