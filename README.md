# Cartographie Coolapic

Carte interactive du club de plongée Coolapic, pour préparer les plongées et
se souvenir des plongées passées : sites du club, profondeurs, habitats marins
et météo de la côte méditerranéenne.

L'application est faite de fichiers HTML, CSS et JavaScript statiques, sans
étape de compilation. Elle s'appuie sur [Leaflet](https://leafletjs.com/) 1.9.4
et [leaflet-geosearch](https://github.com/smeijer/leaflet-geosearch) 5.3.0,
chargés depuis un CDN.

## Lancer la carte en local

Les sites de plongée sont lus avec `fetch` : il faut servir le dossier avec un
serveur HTTP plutôt qu'ouvrir directement le fichier HTML. Depuis ce dossier :

```powershell
py -m http.server 8000
```

Puis ouvrir <http://localhost:8000/cartographie_coolapic.html>. Si `py` n'est
pas disponible, utiliser `python -m http.server 8000`.

Une connexion Internet est nécessaire : fonds de carte, bibliothèques, recherche
d'adresses, isobathes, habitats OFB et météo sont chargés à la demande.

## Fonctionnalités

À l'ouverture, la carte se cadre sur l'ensemble des sites de plongée. Par
défaut, elle affiche le Plan IGN, le vent, les isobathes DONIA et les sites
(constante `COUCHES_PAR_DEFAUT` de `js/controle-couches.js`). Un clic sur un
site, sur la carte ou dans l'annuaire, zoome dessus et ouvre sa fiche, avec
sa photo s'il en a une (propriété `photo` du GeoJSON, images dans `jpeg/`).

**Couches** (bouton en haut à droite) :

- **Fond de plan** : carte littorale IGN/Shom, Plan IGN, photographies
  aériennes IGN, OpenStreetMap.
- **Météo**, prévisions heure par heure sur 48 h :
  - vent des modèles Météo-France (AROME, ARPEGE), en flèches colorées selon
    la force, avec les vagues dans la fiche de chaque point ;
  - température de l'eau en surface (modèle Météo-France), une étiquette par
    maille du modèle (environ 8 km).

  Un curseur commun choisit l'heure.
- **Bathymétrie** : isobathes DONIA (plateforme MEDTRIX, visibles à partir du
  zoom 10) et isobathes GEBCO 2021.
- **Biodiversité** : habitats marins des Calanques et de la rade d'Hyères
  (couleurs de l'Atlas de la biodiversité marine Aix-Marseille-Provence) et
  observations faune/flore du golfe du Lion, avec leur légende.
- **Sites de plongée**, aussi listés dans l'annuaire à droite, avec recherche
  par nom ou par ville.

Les isobathes GEBCO et les habitats ont un curseur d'opacité. Les choix de
couches et d'opacité sont mémorisés dans le navigateur.

**Barre d'outils** : informations et sources (avec les adresses des flux à
copier dans un SIG), recherche d'adresses (masquée sur téléphone),
localisation, plein écran et couches. Les panneaux ouverts, la légende et le
curseur météo s'empilent sous la barre, dans l'ordre d'ouverture.

## Ajouter un site de plongée

Les sites sont dans `geojson/sites_de_plongee.geojson`. Chaque site est un
point avec trois propriétés obligatoires, de type texte :

```json
{
  "type": "Feature",
  "id": "site-nom-du-site",
  "properties": { "nom": "Nom du site", "ville": "Commune", "commentaire": "", "photo": "jpeg/photo.jpg" },
  "geometry": { "type": "Point", "coordinates": [5.6122873, 43.16039] }
}
```

Les coordonnées sont dans l'ordre **longitude, latitude**. La propriété
`photo` est facultative. Une fiche invalide
empêche le chargement de tous les sites (un message s'affiche sur la carte).

## Profondeur des sites

La profondeur affichée dans la fiche des sites est calculée à l'avance par
`outils/profondeur_sites.py`, à relancer après l'ajout d'un site. Le script lit
le MNT Litto3D à 1 m (IGN / Shom) : profondeur au point et plage de profondeurs
dans un rayon de 30 m (réglage `RAYON_M`). Sans Litto3D, il se rabat sur le MNT
de façade HOMONIM à 100 m. Il s'exécute avec le Python d'ArcGIS Pro (GDAL) :

```powershell
& "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe" outils\profondeur_sites.py
```

- `--inventaire` liste les paquets Litto3D nécessaires ;
- `--telecharger` les télécharge depuis le Shom (environ 80 Mo chacun,
  7-Zip requis) et n'en garde que les MNT à 1 m.

Les MNT sont rangés dans le dossier `mnt/`, exclu de Git car trop lourd pour
GitHub : voir `mnt/LISEZMOI.md` pour son organisation.

## Organisation du code

Les scripts sont chargés dans cet ordre par `cartographie_coolapic.html` ;
chacun peut utiliser ce que définissent les précédents.

| Fichier | Rôle |
|---|---|
| `js/utilitaires.js` | Messages sur la carte, lecture des GeoJSON, fonctions de texte. |
| `js/carte.js` | Carte, ordre d'affichage des couches, fonds de plan, isobathes, échelle et coordonnées. |
| `js/barre-outils.js` | Icônes, pile sous la barre, recherche d'adresses, localisation, plein écran. |
| `js/a-propos.js` | Panneau d'informations : sources, flux à copier, liens. |
| `js/meteo.js` | Vent, vagues et température de l'eau (Open-Meteo), curseur d'heure. |
| `js/sites-plongee.js` | Marqueurs, fiches, annuaire et cadrage sur les sites. |
| `js/biodiversite-ofb.js` | Flux WFS de l'OFB, couleurs des habitats, légende. |
| `js/controle-couches.js` | Panneau des couches, curseurs d'opacité, mémorisation des choix. |
| `js/application.js` | Démarrage. |
| `outils/profondeur_sites.py` | Calcul de la profondeur des sites (Litto3D, HOMONIM). |
| `css/style.css` | Présentation, organisée par zones de la page. |

Après une modification, changer le paramètre `?v=` des fichiers dans
`cartographie_coolapic.html` force les navigateurs à recharger les fichiers.

## Sources des données

| Données | Source | Accès |
|---|---|---|
| Fonds de plan | IGN – Géoplateforme, OpenStreetMap | WMS, tuiles |
| Isobathes DONIA | Plateforme MEDTRIX | WMS (projet public « Suivi_Mouillage_AIS ») |
| Isobathes GEBCO 2021 | OpenSeaMap | WMS |
| Habitats et observations | Office français de la biodiversité (OFB) | WFS |
| Vent | Modèles Météo-France, via Open-Meteo | API JSON |
| Vagues et température de l'eau | Modèles marins et Météo-France, via Open-Meteo | API JSON |
| Recherche d'adresses | Nominatim (OpenStreetMap) | API |
| Sites de plongée | Club Coolapic | `geojson/sites_de_plongee.geojson` |

L'API officielle de Météo-France demande une clé, qui serait visible dans le
code de la page : elle n'est donc pas utilisée directement. Open-Meteo est
gratuit pour un usage non commercial, avec mention de la source (CC BY 4.0).

Les prévisions et les données affichées sont indicatives : elles ne remplacent
ni les cartes marines officielles ni le bulletin météo côtier.
