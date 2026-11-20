# -*- coding: utf-8 -*-
"""Calcule la profondeur des sites de plongée et l'écrit dans le GeoJSON.

Pour chaque site de geojson/sites_de_plongee.geojson :
- profondeur au point et plage de profondeurs (minimum, maximum) dans un
  rayon autour du site, lues dans le MNT Litto3D à 1 m (IGN / Shom) ;
- à défaut de Litto3D, valeur du MNT de façade HOMONIM à 100 m (Shom).

Le résultat est écrit dans la propriété « profondeur » de chaque site, que la
carte affiche dans la fiche. Les profondeurs sont positives, en mètres.

Lancement, avec le Python d'ArcGIS Pro (GDAL y est fourni) :
    "C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\python.exe" outils\\profondeur_sites.py
Options :
    --telecharger   télécharge les paquets Litto3D manquants depuis le Shom
                    (environ 80 Mo par paquet ; 7-Zip requis) ;
    --inventaire    liste seulement les paquets nécessaires, sans rien écrire.

Références verticales : Litto3D est en IGN69, HOMONIM au niveau moyen (NM) ;
en Méditerranée, l'écart avec le zéro des cartes marines est de quelques
dizaines de centimètres. Valeurs indicatives : ne pas utiliser pour naviguer.
"""
from pathlib import Path
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

from osgeo import gdal, osr

gdal.UseExceptions()

# --- Réglages ---------------------------------------------------------------
RAYON_M = 30  # rayon autour du site pour la plage de profondeurs

DEPOT = Path(__file__).resolve().parents[1]           # cartographie_web
PROJET = DEPOT.parent                                  # dossier coolapic
FICHIER_SITES = DEPOT / "geojson" / "sites_de_plongee.geojson"
# Dossiers où chercher des dalles Litto3D déjà extraites (MNT 1 m, .asc).
DOSSIERS_LITTO3D = [
    PROJET / "la_ciotat",
    PROJET / "calcul_profondeur" / "litto3d_auto",
    PROJET / "calcul_profondeur" / "litto3d_sites",
]
DOSSIER_TELECHARGEMENT = PROJET / "calcul_profondeur" / "litto3d_sites"
MNT_HOMONIM = (PROJET / "data" / "MNT_FACADE_GDL-CA_HOMONIM_NM" / "DONNEES"
               / "MNT_MED100m_GDL-CA_HOMONIM_WGS84_NM_ZNEG.asc")

# Collections Litto3D du Shom, de la moins à la plus prioritaire : là où
# plusieurs éditions se recouvrent, la plus récente l'emporte.
COLLECTIONS = [
    ("LITTO3D_LR_2009_PACK_DL", "Litto3D Languedoc-Roussillon 2009"),
    ("L3D_MAR_LR_2011_PACK_DL", "Litto3D Languedoc-Roussillon 2011"),
    ("L3D_MAR_LR_2014_2015_PACK_DL", "Litto3D Languedoc-Roussillon 2014-2015"),
    ("LITTO3D_PACA_2015_PACK_DL", "Litto3D PACA 2015"),
]
URL_CATALOGUE = "https://services.data.shom.fr/INSPIRE/telechargement/prepackageGroup"
URL_METADONNEES = "https://services.data.shom.fr/geonetwork/srv/api/records/{}/formatters/xml"
USER_AGENT = "carte-plongee-profondeur/1.0"


# --- Projections -------------------------------------------------------------
def transformation(epsg_source, epsg_cible):
    source, cible = osr.SpatialReference(), osr.SpatialReference()
    source.ImportFromEPSG(epsg_source)
    cible.ImportFromEPSG(epsg_cible)
    for ref in (source, cible):  # ordre longitude, latitude
        ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(source, cible)


VERS_LAMBERT93 = transformation(4326, 2154)


# --- Dalles Litto3D locales --------------------------------------------------
class Dalle:
    """Dalle MNT Litto3D à 1 m (ASCII ESRI, Lambert-93)."""

    def __init__(self, chemin):
        self.chemin = chemin
        jeu = gdal.Open(str(chemin))
        self.x0, self.pas, _, self.y0, _, pas_y = jeu.GetGeoTransform()
        self.largeur, self.hauteur = jeu.RasterXSize, jeu.RasterYSize
        self.x1 = self.x0 + self.largeur * self.pas
        self.y1 = self.y0 + self.hauteur * pas_y
        # Date d'acquisition dans le nom : sert à départager les éditions.
        date = re.search(r"_(\d{8})_LAMB93", chemin.name)
        self.date = date.group(1) if date else "00000000"
        self.source = libelle_source(chemin)

    def couvre(self, x, y, marge=0.0):
        return (self.x0 - marge <= x < self.x1 + marge
                and self.y1 - marge <= y < self.y0 + marge)

    def valeurs_cercle(self, x, y, rayon):
        """Altitudes (IGN69) des cellules de la dalle dans le cercle."""
        col0 = max(int((x - rayon - self.x0) // self.pas), 0)
        col1 = min(int((x + rayon - self.x0) // self.pas) + 1, self.largeur)
        lig0 = max(int((self.y0 - (y + rayon)) // self.pas), 0)
        lig1 = min(int((self.y0 - (y - rayon)) // self.pas) + 1, self.hauteur)
        if col0 >= col1 or lig0 >= lig1:
            return []
        # Garder le jeu de données dans une variable : sinon Python le libère
        # et la bande devient invalide.
        jeu = gdal.Open(str(self.chemin))
        bande = jeu.GetRasterBand(1)
        nodata = bande.GetNoDataValue()
        tableau = bande.ReadAsArray(col0, lig0, col1 - col0, lig1 - lig0)
        valeurs = []
        for i, ligne in enumerate(tableau):
            cy = self.y0 - (lig0 + i + 0.5) * self.pas
            for j, z in enumerate(ligne):
                cx = self.x0 + (col0 + j + 0.5) * self.pas
                if z != nodata and (cx - x) ** 2 + (cy - y) ** 2 <= rayon ** 2:
                    valeurs.append(((cx - x) ** 2 + (cy - y) ** 2, float(z)))
        return valeurs


def libelle_source(chemin):
    texte = str(chemin).upper()
    for collection, libelle in reversed(COLLECTIONS):
        if collection in texte:
            return libelle
    if "PACA_2015" in texte:
        return "Litto3D PACA 2015"
    return "Litto3D"


def lister_dalles():
    dalles = []
    for dossier in DOSSIERS_LITTO3D:
        if not dossier.is_dir():
            continue
        for chemin in dossier.rglob("*_MNT_*.asc"):
            # Seulement le MNT à 1 m (les dossiers MNT5m sont ignorés).
            if chemin.parent.name.upper() == "MNT1M":
                dalles.append(Dalle(chemin))
    # La source XML du paquet indique l'édition PACA 2015.
    for dalle in dalles:
        xml = list(dalle.chemin.parents[2].glob("*PACA_2015*.xml"))
        if xml and dalle.source == "Litto3D":
            dalle.source = "Litto3D PACA 2015"
    return dalles


# --- Calcul de la profondeur d'un site ----------------------------------------
def profondeur_litto3d(dalles, x, y):
    """Plage de profondeurs (m) dans le rayon, ou None sans Litto3D au point."""
    au_point = [d for d in dalles if d.couvre(x, y)]
    if not au_point:
        return None
    au_point.sort(key=lambda d: d.date, reverse=True)
    principale = au_point[0]
    # Cellules du cercle, toutes dalles confondues ; en cas de recouvrement,
    # chaque dalle apporte les siennes (écarts négligeables entre éditions).
    valeurs = []
    for dalle in dalles:
        if dalle.couvre(x, y, marge=RAYON_M):
            valeurs.extend(dalle.valeurs_cercle(x, y, RAYON_M))
    if not valeurs:
        return None  # dalle sans valeur ici : repli sur HOMONIM
    _, z_point = min(valeurs)  # cellule la plus proche du site
    profondeurs = [-z for _, z in valeurs if z < 0]
    resultat = {
        "source": principale.source + " (1 m)",
        "reference": "IGN69",
        "rayon_m": RAYON_M,
        "point_m": round(-z_point, 1) if z_point < 0 else 0.0,
    }
    if profondeurs:
        resultat["min_m"] = round(min(profondeurs), 1)
        resultat["max_m"] = round(max(profondeurs), 1)
    resultat["a_terre"] = z_point >= 0
    return resultat


class Homonim:
    def __init__(self, chemin):
        self.jeu = gdal.Open(str(chemin))
        self.transformation = self.jeu.GetGeoTransform()
        self.bande = self.jeu.GetRasterBand(1)

    def profondeur(self, lon, lat):
        x0, px, _, y0, _, py = self.transformation
        col, lig = int((lon - x0) / px), int((lat - y0) / py)
        if not (0 <= col < self.jeu.RasterXSize and 0 <= lig < self.jeu.RasterYSize):
            return None
        z = float(self.bande.ReadAsArray(col, lig, 1, 1)[0][0])
        if z == self.bande.GetNoDataValue() or z >= 0:
            return None
        return {
            "source": "MNT de façade HOMONIM, Shom (100 m)",
            "reference": "niveau moyen",
            "point_m": round(-z, 1),
        }


# --- Téléchargement des paquets Litto3D manquants (option --telecharger) -----
def lire_url(url):
    for essai in range(4):
        try:
            requete = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(requete, timeout=120) as reponse:
                return reponse.read()
        except Exception:
            if essai == 3:
                raise
            time.sleep(2 ** essai)


def emprise_paquet(identifiant, cache):
    fichier = cache / (identifiant + ".json")
    if fichier.exists():
        return json.loads(fichier.read_text(encoding="utf-8"))
    racine = ET.fromstring(lire_url(URL_METADONNEES.format(identifiant)))
    noms = ["westBoundLongitude", "southBoundLatitude",
            "eastBoundLongitude", "northBoundLatitude"]
    valeurs = {}
    for element in racine.iter():
        nom = element.tag.split("}")[-1]
        if nom in noms and nom not in valeurs:
            valeurs[nom] = float("".join(element.itertext()).strip())
    emprise = [valeurs[n] for n in noms]
    fichier.write_text(json.dumps(emprise), encoding="utf-8")
    return emprise


def paquets_pour(sites_manquants):
    """Paquet Litto3D le plus récent couvrant chaque site sans dalle locale."""
    cache = DOSSIER_TELECHARGEMENT / "catalogue"
    cache.mkdir(parents=True, exist_ok=True)
    choix = {}
    for priorite, (collection, libelle) in enumerate(COLLECTIONS):
        catalogue = json.loads(lire_url(URL_CATALOGUE + "/" + collection))
        for paquet in catalogue["prepackageResources"]:
            nom = paquet["prepackageName"]
            correspondance = re.fullmatch(r"(\d{4})_(\d{4})", nom)
            if not correspondance:
                continue
            x_km, y_km = (int(v) for v in correspondance.groups())
            for site in sites_manquants:
                # Préfiltre large sur le repère kilométrique du paquet.
                if abs(site["x"] / 1000 - x_km) > 12 or abs(site["y"] / 1000 - y_km) > 12:
                    continue
                ouest, sud, est, nord = emprise_paquet(paquet["metadataIds"][0], cache)
                if ouest <= site["lon"] <= est and sud <= site["lat"] <= nord:
                    actuel = choix.get(site["nom"])
                    if actuel is None or priorite >= actuel["priorite"]:
                        choix[site["nom"]] = {"collection": collection, "nom": nom,
                                              "libelle": libelle, "priorite": priorite}
    return choix


def chemin_7zip():
    for candidat in (shutil.which("7z"), r"C:\Program Files\7-Zip\7z.exe",
                     r"C:\Program Files (x86)\7-Zip\7z.exe"):
        if candidat and Path(candidat).is_file():
            return candidat
    raise RuntimeError("7-Zip est nécessaire pour extraire les paquets Litto3D.")


def telecharger_paquet(paquet, sept_zip):
    dossier = DOSSIER_TELECHARGEMENT / paquet["collection"]
    dossier.mkdir(parents=True, exist_ok=True)
    archive = dossier / (paquet["nom"] + ".7z")
    extrait = dossier / paquet["nom"]
    if (extrait / "extraction_ok").exists():
        return
    if not archive.exists():
        url = "{0}/{1}/prepackage/{2}/file/{2}.7z".format(
            URL_CATALOGUE, paquet["collection"], paquet["nom"])
        print("  téléchargement de", paquet["libelle"], paquet["nom"], "…")
        temporaire = archive.with_suffix(".part")
        temporaire.write_bytes(lire_url(url))
        temporaire.replace(archive)
    test = subprocess.run([sept_zip, "t", str(archive)], capture_output=True, text=True)
    if test.returncode != 0:
        archive.unlink()
        raise RuntimeError("Archive invalide, supprimée : " + archive.name)
    # Seulement les MNT à 1 m (.asc et .prj), extraits un par un ; les chemins
    # suspects (« .. », absolus) sont écartés.
    liste = subprocess.run([sept_zip, "l", "-slt", str(archive)],
                           capture_output=True, text=True, check=True).stdout
    for ligne in liste.splitlines():
        if not ligne.startswith("Path = "):
            continue
        nom = ligne[7:]
        morceaux = nom.replace("\\", "/").split("/")
        if (".." in morceaux or nom.startswith(("/", "\\")) or ":" in nom
                or "MNT1m" not in morceaux
                or not nom.lower().endswith((".asc", ".prj"))):
            continue
        subprocess.run([sept_zip, "x", "-y", "-o" + str(extrait), str(archive), nom],
                       check=True, stdout=subprocess.DEVNULL)
    (extrait / "extraction_ok").touch()


# --- Programme principal -------------------------------------------------------
def main():
    analyse = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    analyse.add_argument("--telecharger", action="store_true")
    analyse.add_argument("--inventaire", action="store_true")
    options = analyse.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    donnees = json.loads(FICHIER_SITES.read_text(encoding="utf-8"))
    sites = []
    for entite in donnees["features"]:
        lon, lat = entite["geometry"]["coordinates"]
        x, y, _ = VERS_LAMBERT93.TransformPoint(lon, lat)
        sites.append({"nom": entite["properties"]["nom"], "lon": lon, "lat": lat,
                      "x": x, "y": y, "entite": entite})

    dalles = lister_dalles()
    print(len(dalles), "dalles Litto3D 1 m trouvées en local.")
    manquants = [s for s in sites if not any(d.couvre(s["x"], s["y"]) for d in dalles)]

    if (options.telecharger or options.inventaire) and manquants:
        print("Recherche des paquets Litto3D pour", len(manquants), "site(s)…")
        choix = paquets_pour(manquants)
        for site in manquants:
            paquet = choix.get(site["nom"])
            print("  {:22} {}".format(site["nom"], "{} {}".format(
                paquet["libelle"], paquet["nom"]) if paquet else "aucun paquet Litto3D"))
        if options.inventaire:
            return
        sept_zip = chemin_7zip()
        for paquet in {(p["collection"], p["nom"]): p for p in choix.values()}.values():
            telecharger_paquet(paquet, sept_zip)
        dalles = lister_dalles()
    elif options.inventaire:
        print("Toutes les dalles nécessaires sont déjà en local.")
        return

    homonim = Homonim(MNT_HOMONIM) if MNT_HOMONIM.exists() else None
    for site in sites:
        resultat = profondeur_litto3d(dalles, site["x"], site["y"])
        if resultat is None and homonim:
            resultat = homonim.profondeur(site["lon"], site["lat"])
        proprietes = site["entite"]["properties"]
        if resultat and "point_m" in resultat:
            proprietes["profondeur"] = resultat
            plage = ("{min_m}–{max_m} m".format(**resultat)
                     if "min_m" in resultat else "—")
            print("  {:22} point {:>5} m  plage {:>13}  {}{}".format(
                site["nom"], resultat["point_m"], plage, resultat["source"],
                "  (point à terre)" if resultat.get("a_terre") else ""))
        else:
            proprietes.pop("profondeur", None)
            print("  {:22} aucune donnée de profondeur".format(site["nom"]))

    with FICHIER_SITES.open("w", encoding="utf-8", newline="\n") as fichier:
        json.dump(donnees, fichier, ensure_ascii=False, indent=2)
        fichier.write("\n")
    print("Profondeurs écrites dans", FICHIER_SITES.name)


if __name__ == "__main__":
    main()
