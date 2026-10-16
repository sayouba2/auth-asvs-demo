# Résultats V6/L1

Exécution : 2026-10-14T20:28:32.014Z

| Exigence | Test | Résultat | Preuve |
|---|---|---|---|
| V6.1.1 | T-01 | NON TESTÉ | security/rate-limiting.md : présence des paramètres et procédures ; revue de concordance toujours nécessaire. ; Revue documentaire : LIMITS et rate-limiting.md concordent (30/900, 5/300, 10/900, 5/900). Lua atomique, pas de prolongation sur refus, HMAC des clés, refus fermé 503, proxy explicite et limites distribuées documentés. Exécution Redis évaluée séparément par T-10. |
| V6.2.1 | T-02 | NON TESTÉ | Suite non exécutée |
| V6.2.2 | T-03 | NON TESTÉ | Suite non exécutée |
| V6.2.3 | T-04 | NON TESTÉ | Suite non exécutée |
| V6.2.4 | T-05 | NON TESTÉ | 10000 entrées, unicité, longueur et SHA-256 ; source et licence versionnées. |
| V6.2.5 | T-06 | NON TESTÉ | Suite non exécutée |
| V6.2.6 | T-07 | NON TESTÉ | Suite non exécutée |
| V6.2.7 | T-08 | NON TESTÉ | Suite non exécutée |
| V6.2.8 | T-09 | NON TESTÉ | Suite non exécutée |
| V6.3.1 | T-10 | NON TESTÉ | Suite non exécutée |
| V6.3.2 | T-11 | NON TESTÉ | Migration DDL seule, aucun seeder ; contrôle complémentaire de base fraîche par le lanceur. ; Revue migrations, package.json et setup-env.mjs : aucun INSERT, seed ou compte utilisateur initial. Contrôle de la base fraîche encore requis. |
| V6.4.1 | T-12 | N/A justifié | Inventaire exact des cinq routes ; inscription imposant un mot de passe choisi. Aucun parcours activation/récupération. ; N/A : seuls register/login/me/change-password/logout existent. CredentialsDto impose un mot de passe choisi. Aucun e-mail ni code d'activation ni mot de passe initial n'est émis. Le hash fictif anti-énumération ne correspond à aucun compte ; les jetons aléatoires sont des sessions. Réévaluer si un nouveau parcours est ajouté. |
| V6.4.2 | T-13 | PASS | Inventaire du schéma, DTO, contrôleur et écrans : aucun indice ni question secrète. ; Revue complète des routes, DTO, schéma Prisma, composants et pages : aucune question secrète ou indication du mot de passe ; aucun parcours de récupération. |

Contrôles manuels : voir ../manual-review.json. Compatibilité avec les gestionnaires tiers : NON TESTÉ.
C-01 sur déploiement HTTPS réel : NON TESTÉ (configuration et attributs testés séparément).
Ce rapport ne constitue pas une certification ASVS ni une évaluation des autres chapitres.
