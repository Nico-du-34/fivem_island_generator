# Island Forge — worker local d'export GTA natif

Le worker Node.js est intégré au lancement de l'application. Il reçoit les buffers de terrain depuis Next.js et transmet le travail à Island Forge Native Engine, un exécutable C++20 basé sur Ragekit. Il ne lance pas Blender, Sollumz ni CodeWalker.

## Démarrage local sans configuration

Prérequis :
- Windows 10/11 x64 pour l'export RAGE natif ;
- Node.js 20+.

Depuis la racine du dépôt :

~~~powershell
npm install
npm run dev
~~~

Ouvre ensuite http://localhost:3000.

Le lanceur scripts/run-local.mjs :
1. démarre le worker sur 127.0.0.1:8787 ;
2. télécharge automatiquement le moteur natif Windows depuis la release native-engine-v0.1.0 s'il n'est pas présent dans .islandforge/bin/ ;
3. démarre Next.js dans le même terminal ;
4. arrête le worker lorsque Next.js s'arrête.

Aucun fichier .env, Blender, Sollumz, PyMateria ou second terminal n'est requis. npm start lance aussi Next.js et le worker après npm run build. npm run worker démarre uniquement le worker.

Le premier lancement nécessite une connexion Internet pour récupérer l'exécutable publié. Si la release native n'est pas encore publiée ou si le téléchargement échoue, l'éditeur, la génération et l'export source OBJ/GLB restent disponibles ; l'export natif affiche une erreur explicite.

Le binaire téléchargé est placé dans .islandforge/bin/, répertoire ignoré par Git. Il n'est pas ajouté au dépôt.

## Formats natifs générés

- **YDR** : géométrie du terrain découpée en tuiles, avec quatre niveaux de détail.
- **YBN** : collisions BVH séparées par tuile.
- **YTD** : dictionnaire de textures de secours du terrain.
- **YTYP** : définitions des archétypes pour les tuiles de terrain.
- **YMAP** : ressource RSC7 native avec les placements du terrain, des arbres, rochers, props et des batches d'herbe.

Chaque YMAP est relu par Ragekit après écriture ; le worker vérifie l'en-tête RSC7 et refuse de livrer le ZIP si un type de ressource attendu manque.

Les placements de props sont des références aux noms/hashes d'archétypes GTA. Les modèles 3D originaux ne sont pas copiés dans le projet : ils doivent exister dans le build GTA/FiveM cible.

## Données GTA

La recherche des props, zones, IPL et intérieurs utilise l'API de l'application, qui charge avec cache les fichiers publiés par DurtyFree/gta-v-data-dumps. Ce dépôt décrit des noms et des métadonnées ; il ne fournit pas les maillages ou textures originaux des props.

## Textures GunWare

Les sources GunWare fournies contenaient les noms des dictionnaires GTA, pas les images diffuse/normal originales. Le moteur génère des textures procédurales de secours et les place dans le YTD. Elles ne sont pas présentées comme les textures GunWare/GTA originales.

## Limites actuelles

- Les water quads GTA natifs ne sont pas encore produits ; les paramètres d'eau sont conservés dans les métadonnées/configuration de la ressource.
- Le terrain de l'île est généré en 3D ; la vue 3D Monde utilise les tuiles cartographiques GTA en fond, et ne reconstruit pas encore le relief natif de Los Santos/Blaine County.
- Dans l'aperçu web, les props ajoutés sont affichés comme marqueurs ; leurs vrais modèles sont référencés dans le YMAP et sont rendus par le jeu.
- Les noms de props et archétypes doivent exister dans le build cible.
- Les textures de secours ne reproduisent pas les originaux GunWare.
- La compilation C++ et les contrôles RSC7 ne remplacent pas un essai dans CodeWalker puis sur un serveur FiveM propre.
