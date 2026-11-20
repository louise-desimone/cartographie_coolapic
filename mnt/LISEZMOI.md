# Modèles numériques de terrain (MNT)

Ce dossier contient les MNT utilisés par `outils/profondeur_sites.py` pour
calculer la profondeur des sites de plongée. Ils ne sont **pas** dans le dépôt
Git (plusieurs centaines de Mo, au-delà des limites de GitHub) : seul ce
fichier l'est.

```
mnt/
├── litto3d/
│   ├── catalogue/                     emprises des paquets Shom (cache)
│   └── <collection Shom>/<paquet>/    dalles Litto3D, MNT à 1 m (.asc)
│       ex. LITTO3D_PACA_2015_PACK_DL/0910_6235/…/MNT1m/*.asc
└── homonim/
    └── MNT_MED100m_GDL-CA_HOMONIM_WGS84_NM_ZNEG.asc   (+ .prj)
```

- **Litto3D** (IGN / Shom, 1 m, Lambert-93, IGN69) : le script télécharge les
  paquets manquants avec l'option `--telecharger` et n'en garde que les MNT à
  1 m. Le dossier d'un paquet doit se trouver sous celui de sa collection
  (`LITTO3D_PACA_2015_PACK_DL`, `L3D_MAR_LR_2011_PACK_DL`…) : c'est ainsi que
  le script connaît son édition.
- **HOMONIM** (Shom, MNT de façade Golfe du Lion – Côte d'Azur, 100 m, WGS84,
  niveau moyen) : à placer à la main, il sert de repli hors Litto3D.

Une fois les profondeurs calculées, ces fichiers peuvent être supprimés : les
résultats sont dans `geojson/sites_de_plongee.geojson`.

## Dalle d'exemple

Une seule dalle est versionnée, pour montrer à quoi ressemble un MNT et
pouvoir lancer le script sans rien télécharger :

`litto3d/LITTO3D_PACA_2015_PACK_DL/0910_6235/LITTO3D_FRA_0912_6233_20150529_LAMB93_RGF93_IGN69/MNT1m/LITTO3D_FRA_0912_6233_MNT_20150128_LAMB93_RGF93_IGN69.asc`

Elle couvre 1 km² autour de la Petite Calanque (île Verte, La Ciotat). C'est
une grille texte (format ASCII ESRI) de 1 000 × 1 000 cellules de 1 m :

```
ncols 1000             nombre de colonnes
nrows 1000             nombre de lignes
xllcenter 912000.000   coin sud-ouest, en Lambert-93 (m)
yllcenter 6232001.000
cellsize 1.0000        taille d'une cellule : 1 m
nodata_value -99999    valeur des cellules sans donnée
6.470 6.300 6.240 …    altitudes IGN69 en m, ligne par ligne du nord au sud
                       (positives à terre, négatives en mer)
```

Une altitude négative est une profondeur : -12,3 signifie 12,3 m sous le
niveau de référence. Le nom de la dalle donne son coin nord-ouest en km
(0912 = 912 km à l'est, 6233 = 6 233 km au nord) et sa date d'acquisition.

Source : Litto3D PACA 2015, © IGN / Shom, sous Licence Ouverte Etalab 2.0
(réutilisation libre en citant la source).
