# Island Forge — worker local d'export GTA natif

Le worker est démarré automatiquement avec l'application. Il reçoit les buffers du terrain, reconstruit les maillages Blender et exporte les ressources GTA natives avec Sollumz/szio + PyMateria.

## Démarrage sans configuration

Prérequis sur Windows 10/11 :
- Node.js 20+
- Blender 4.5+ recommandé
- Sollumz installé dans le profil Blender utilisé
- PyMateria disponible pour Sollumz/szio

Depuis la racine du dépôt :

~~~powershell
npm install
npm run dev
~~~

Ouvre ensuite http://localhost:3000. Le script scripts/run-local.mjs :
1. cherche automatiquement blender.exe dans les installations Windows habituelles ou dans le PATH ;
2. détecte l'extension Sollumz dans le profil Blender ;
3. démarre native-worker/server.mjs sur 127.0.0.1:8787 ;
4. démarre Next.js dans le même terminal ;
5. arrête le worker quand Next.js s'arrête.

Aucun fichier .env, token à copier ou second terminal n'est requis. npm start utilise le même démarrage automatique après npm run build. Pour démarrer uniquement le worker, lance npm run worker.

Si Blender n'est pas trouvé, l'éditeur et l'export source OBJ/GLB restent utilisables. Le bouton d'export natif retournera une erreur claire tant que Blender et Sollumz ne sont pas installés.

Le worker local écoute uniquement sur 127.0.0.1. Ne le rends pas accessible publiquement. La configuration d'une machine de conversion distante est un déploiement avancé et n'est pas nécessaire au développement local.

## Fichiers générés

- **YDR** terrain visuel en tuiles.
- **YBN** collisions BVH indépendantes.
- **YTYP** archetypes de terrain et LOD.
- **YTD** dictionnaires diffuse/normal.
- **YMAP** natif RSC7 avec placements HD/LOD/SLOD et arbres/rochers.
- Sources CodeWalker XML facultatives pour inspection.
- fxmanifest.lua, rapports et manifests matériaux/eau/végétation/herbe.

Le terrain comprend six niveaux visuels : HD, LOD, SLOD1, SLOD2, SLOD3 et SLOD4. Les collisions sont séparées du rendu. Les arbres et rochers référencent des archétypes déjà présents dans le jeu ; le worker ne copie pas les assets du jeu.

## Validation YMAP native

Sollumz construit un AssetMapData, l'exporte avec le fournisseur natif PyMateria et relit ensuite chaque fichier via szio.try_load_asset. L'export échoue si le YMAP est absent, illisible, ne possède pas d'en-tête RSC7 ou ne contient aucune entité.

Le projet szio contient un test de round-trip natif AssetMapData :
- https://github.com/Sollumz/szio/blob/main/tests/test_maps.py
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider.py
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider_gen9.py

CodeWalker est facultatif pour inspecter ou modifier les YMAP ; il n'est pas requis pour la conversion binaire.

## Textures GunWare

Les fichiers de référence fournis avec Island Forge contenaient les noms des dictionnaires de textures GTA, mais pas les bitmaps diffuse/normal originaux. Sans images de remplacement, le worker génère des PNG procéduraux de secours, les ajoute au YTD et les assigne aux matériaux. Ces PNG ne sont pas les textures GunWare originales.

Pour fournir des images localement, place les fichiers sous native-worker/textures avec les noms :
- <material-id>_diffuse.png
- <material-id>_normal.png

Le worker détectera ce dossier sans configuration supplémentaire. Les textures originales extraites du jeu doivent être obtenues et utilisées conformément aux droits applicables.

## Limites actuelles

- Les water quads GTA natifs ne sont pas générés ; les paramètres d'eau sont conservés dans config/water.json.
- Les placements d'herbe sont conservés dans config/grass-placements.json, mais ne sont pas encore écrits comme YMAP grass instance lists natives.
- Les arbres/rochers référencent des archétypes GTA existants à vérifier sur le build cible.
- Une inspection finale CodeWalker et un essai sur un serveur FiveM propre restent recommandés.
