# Carnet BT

Application de suivi des bons de transport (patients, BT en série, scanner, alertes).

## Structure du projet

```
index.html          → page principale
css/style.css        → tout le style visuel
js/supabaseClient.js → connexion à la base de données (Supabase)
js/icons.js          → icônes
js/storage.js        → sauvegarde des données (compte utilisateur, Supabase)
js/image-processing.js → détection de contour + amélioration des scans
js/alerts.js          → logique des alertes (BT terminé, ADELI manquant, etc.)
js/ui.js              → petits composants réutilisables (champs, compteurs)
js/auth.js            → écran de connexion / création de compte
js/app.js             → l'application principale (écrans, navigation)
js/main.js            → démarre l'application
```

Chaque fonctionnalité vit dans son propre fichier. Pour ajouter ou modifier
une fonctionnalité plus tard, on ne touche en général qu'un seul fichier.

## Mise en ligne (une seule fois)

### Étape 1 — Créer un compte GitHub (si tu n'en as pas)
Va sur https://github.com et crée un compte gratuit.

### Étape 2 — Créer un dépôt (« repository »)
1. Clique sur le bouton **+** en haut à droite → **New repository**
2. Nomme-le par exemple `carnet-bt`
3. Laisse-le en **Public** ou **Private** (peu importe)
4. Clique **Create repository**

### Étape 3 — Envoyer les fichiers
1. Sur la page du dépôt fraîchement créé, clique **uploading an existing file**
2. Glisse-dépose **tout le contenu de ce dossier** (index.html, css/, js/, README.md)
3. Clique **Commit changes**

### Étape 4 — Connecter Netlify
1. Va sur https://app.netlify.com et crée un compte gratuit (tu peux te connecter directement avec ton compte GitHub)
2. Clique **Add new site** → **Import an existing project**
3. Choisis **GitHub**, puis sélectionne le dépôt `carnet-bt`
4. Laisse les réglages par défaut, clique **Deploy**

En moins d'une minute, tu obtiens une adresse du style
`https://carnet-bt-xyz.netlify.app` — c'est ton appli, en ligne, pour de vrai.

### Étape 5 — Installer sur ton téléphone
Ouvre cette adresse dans Chrome sur ton téléphone, puis menu **⋮ → Ajouter à
l'écran d'accueil**.

## Mises à jour futures

Comme le dépôt est relié à Netlify, **chaque fois que les fichiers changent
sur GitHub, le site se met à jour automatiquement** — tu n'as rien à refaire
sur Netlify.

Pour mettre à jour :
1. Va sur ton dépôt GitHub
2. Ouvre le fichier modifié (ex: `js/app.js`)
3. Clique sur le crayon ✏️ (Edit this file)
4. Remplace le contenu par la nouvelle version que je te donne
5. Clique **Commit changes**

Netlify redéploie automatiquement en quelques secondes.

## Comptes utilisateurs

Chaque chauffeur crée son propre compte (e-mail + mot de passe) directement
dans l'appli. Les patients, BT et photos sont liés à ce compte et stockés
sur un serveur (Supabase) — **un chauffeur ne peut jamais voir les documents
d'un autre chauffeur**, cette isolation est imposée par la base de données
elle-même, pas seulement par l'appli.

Voir la section technique "Configurer Supabase" (fournie séparément lors de
la mise en place) pour créer le projet, exécuter le script SQL et connecter
les identifiants dans `js/supabaseClient.js`.

## Important à savoir

- Une connexion internet est nécessaire pour consulter ou modifier tes
  patients/BT/photos (elles ne sont plus stockées uniquement sur le
  téléphone). L'appli elle-même (l'interface) reste installable et
  s'ouvre même hors-ligne, mais sans données tant que le réseau n'est pas
  revenu.
- Ce n'est pas un hébergement agréé données de santé (HDS) — l'usage visé
  est le transport (taxi/VSL), pas le soin. Reste prudent : ne mets pas en
  ligne d'informations médicales détaillées, seulement ce qui est
  nécessaire au transport (nom, destination, n° de BT).
