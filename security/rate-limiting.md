# Politique anti-automatisation — V6.1.1 / V6.3.1

Configuration effective : `apps/api/src/security/rate-limit.service.ts`.
Fenêtres fixes, démarrant à la première requête, compteurs partagés Redis.

| Opération | Clé | Maximum | Fenêtre |
|---|---|---:|---:|
| login | IP | 30 tentatives | 900 s |
| login | IP + e-mail normalisé | 5 échecs | 300 s |
| register (demande d'inscription) | IP | 10 tentatives | 900 s |
| change-password | utilisateur | 5 tentatives | 900 s |

Une réservation atomique Lua est prise avant la vérification Argon2, y compris
pour les requêtes concurrentes. Un succès libère sa réservation de la paire ;
un échec la conserve. Les requêtes en cours comptent temporairement comme échecs.
Les refus n'allongent jamais le TTL. Au dépassement : HTTP 429 et
`Retry-After` entier en secondes, calculé depuis le TTL restant.
Les requêtes malformées consomment le compteur IP avant la validation DTO.

Pas de verrouillage fondé sur l'e-mail seul : une autre IP peut encore se
connecter. L'expiration permet de réessayer ; les tentatives refusées ne la
repoussent pas. Les clés IP/compte sont pseudonymisées par HMAC-SHA-256 avec
`RATE_LIMIT_SECRET`, commun à toutes les instances. Ne pas changer ce secret
sans tenir compte de la remise à zéro pratique des compteurs.

## Proxy et exposition

Nest écoute sur 127.0.0.1 par défaut, sans confiance dans X-Forwarded-For.
Next utilise un serveur Node personnalisé : il remplace l'en-tête
`X-Demo-Client-IP` par l'adresse de la connexion TCP et authentifie cette transmission avec
un secret partagé `PROXY_SECRET`. Nest n'utilise cette adresse que si le
secret fourni est valide. Tout en-tête de ce nom envoyé par le navigateur
est écrasé. Aucun proxy amont n'est approuvé par défaut.

En production, un proxy TLS placé devant Next doit remplacer X-Forwarded-For
par une seule adresse. Définir `TRUSTED_PROXY_IP` avec l'adresse TCP exacte
de ce proxy ; Next n'accepte cet en-tête que de cette adresse. Ne pas publier
le port Nest, ni accepter des listes de proxies ou une confiance globale.
L'absence de configuration correcte peut regrouper les visiteurs sous
l'adresse du proxy ; elle ne doit jamais permettre de choisir sa propre IP.

## Indisponibilité et observation

Si Redis est indisponible : refus fermé, HTTP 503 sur les opérations limitées.
Ne jamais basculer silencieusement vers un compteur local. Lecture de session
et déconnexion restent possibles. Délai Redis borné à 1 seconde par commande.

Les logs JSON contiennent seulement horodatage, type d'événement, identifiant
pseudonyme et résultat ; jamais corps, e-mail, IP brute, mot de passe, hash
de mot de passe ou jeton. Événements : demande d'inscription, validation par l'administrateur, échec/succès de connexion,
changement, déconnexion, limitation, Redis indisponible, erreurs internes.
Collecter ces logs avec rétention courte (7 jours recommandés), accès restreint.
Surveiller les volumes d'échecs, de 429 et de 503 ; alerter sur une hausse.

## Limites et preuves

Ces seuils de démonstration ne bloquent pas à eux seuls une attaque distribuée
sur de nombreuses IP. Avant exposition publique, prévoir une détection
agrégée des anomalies et une réponse graduée au niveau du proxy (temporisation,
challenge adapté), après analyse du trafic réel. Aucun verrouillage durable
automatique d'un compte sur son seul e-mail n'est implémenté.

Les tests T-10 vérifient deux instances partageant Redis, concurrence, TTL,
réouverture après expiration, autre IP, en-têtes forgés et panne Redis.
Les résultats effectifs sont conservés dans `security/evidence/`.
