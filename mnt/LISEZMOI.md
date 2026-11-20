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
