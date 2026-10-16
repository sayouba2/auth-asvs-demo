# Liste de mots de passe courants — V6.2.4

Le fichier livré `password-blocklist.txt` contient **10 000 entrées distinctes**,
de 8 à 128 points de code Unicode. Il est utilisé côté NestJS à l'inscription
et au changement. Le chargement échoue si la liste manque, contient des doublons,
des longueurs invalides ou moins de 3 000 entrées. Aucun appel réseau ne se fait
pendant une inscription ou une connexion.

Source : [SecLists, 100k-most-used-passwords-NCSC.txt](https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt).
Récupération : 14 octobre 2026 via le connecteur GitHub. Version immuable du contenu
(Git blob SHA-1) : `38eb37702244f55fda75cab281eb2145cd7685b6`.
Licence MIT du dépôt, copyright Daniel Miessler ; copie intégrale dans
`SECLISTS-LICENSE.txt`. Les métadonnées et le SHA-256 du fichier dérivé
sont consignés dans `password-blocklist.json`.

Construction : lire le fichier UTF-8, séparer les lignes LF/CRLF, conserver
les valeurs de 8 à 128 points de code, dédupliquer en conservant l'ordre,
retenir les 10 000 premières. Aucun trim, changement de casse, normalisation
Unicode ou ajout de valeurs synthétiques. La comparaison est exacte.
Exemple réellement présent : `password`.

Reproduire la liste et vérifier l'intégrité (accès Internet nécessaire) :

```bash
node scripts/rebuild-blocklist.mjs
pnpm test:static
```

Pour actualiser : sélectionner une nouvelle version de la source, relever son
Git blob, réexaminer la licence, mettre à jour les métadonnées et reconstruire ;
vérifier la taille et le nouveau checksum, puis exécuter T-05 sur les deux routes.
Examiner les mises à jour au moins trimestriellement. La source est une liste
historique de mots de passe fréquents ; elle ne constitue pas une recherche
exhaustive dans toutes les fuites connues. Ne jamais transmettre ni journaliser
les mots de passe saisis.
