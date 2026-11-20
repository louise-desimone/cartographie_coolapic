"use strict";

// Carte Leaflet, fonds de plan, isobathes (WMS), échelle et coordonnées.

const carte = L.map("carte").setView([43.16, 5.62], 14);

// Calques d'affichage au-dessus des fonds de plan (tuiles : 200). Chaque
// couche superposée a le sien : un fond choisi ensuite ne peut pas la couvrir.
function creerPane(nom, zIndex) {
    carte.createPane(nom).style.zIndex = String(zIndex);
}
creerPane("isobathesGebco", 250);
creerPane("habitatsOFB", 350);
creerPane("isobathesDonia", 360);

// Adresses des services, reprises dans le panneau « À propos ».
const URL_WMS_IGN = "https://data.geopf.fr/wms-r/wms";
const URL_TUILES_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const URL_WMS_GEBCO =
    "https://geoserver.openseamap.org/geoserver/gwc/service/wms";
// Projet MEDTRIX public « Suivi_Mouillage_AIS » : le projet « donia » de la
// plateforme demande une authentification.
const URL_WMS_DONIA =
    "https://plateforme.medtrix.fr/index.php/lizmap/service/gestioncotiere/Suivi_Mouillage_AIS";
const URL_RECHERCHE_NOMINATIM = "https://nominatim.openstreetmap.org/search";

const LIEN_OSM =
    '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function creerFondIGN(couche, format) {
    return L.tileLayer.wms(URL_WMS_IGN, {
        layers: couche,
        version: "1.3.0",
        format: format,
        maxZoom: 19,
        attribution:
            '&copy; <a href="https://geoservices.ign.fr/">IGN - Géoplateforme</a>',
    });
}

const fondCartesLittorales = creerFondIGN(
    "GEOGRAPHICALGRIDSYSTEMS.COASTALMAPS",
    "image/png"
);
const fondPlanIGNV2 = creerFondIGN(
    "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    "image/png"
);
const fondOrthophotographieHR = creerFondIGN(
    "OI.OrthoimageCoverage.HR",
    "image/jpeg"
);
const fondOpenStreetMap = L.tileLayer(URL_TUILES_OSM, {
    maxZoom: 19,
    attribution: "&copy; " + LIEN_OSM,
});

// Isobathes GEBCO 2021, telles que le calque « Marine Profile » d'OpenSeaMap.
const coucheIsobathesGebco = L.tileLayer.wms(URL_WMS_GEBCO, {
    layers: "gebco2021:gebco_2021",
    version: "1.1.1",
    format: "image/png",
    transparent: true,
    TILED: true,
    opacity: 0.8,
    pane: "isobathesGebco",
    attribution:
        'Marine Profile : <a href="https://www.gebco.net/">GEBCO 2021 Grid</a> ' +
        "(produit dérivé), &copy; " + LIEN_OSM + " contributors (ODbL)",
});

// Isobathes DONIA : le service ne les dessine qu'à partir du 1/500 000.
const coucheIsobathesDonia = L.tileLayer.wms(URL_WMS_DONIA, {
    layers: "Isobathes_Med_Atl_DONIA_WGS84",
    version: "1.3.0",
    format: "image/png",
    transparent: true,
    minZoom: 10,
    maxZoom: 19,
    pane: "isobathesDonia",
    attribution:
        'Isobathes : <a href="https://plateforme.medtrix.fr/">MEDTRIX</a> (DONIA)',
});

// Fond affiché avant que le panneau des couches applique les choix
// enregistrés ; le même que le fond par défaut, pour éviter un changement.
fondPlanIGNV2.addTo(carte);
L.control.scale({ metric: true, imperial: false }).addTo(carte);

// Coordonnées du pointeur, à côté de l'échelle.
const controleCoordonnees = L.control({ position: "bottomleft" });
controleCoordonnees.onAdd = function () {
    const conteneur = L.DomUtil.create("div", "coordonnees-carte");
    const texteParDefaut = "Déplacez le pointeur sur la carte";
    conteneur.textContent = texteParDefaut;
    carte.on("mousemove", function (evenement) {
        const latitude = evenement.latlng.lat.toFixed(5).replace(".", ",");
        const longitude = evenement.latlng.lng.toFixed(5).replace(".", ",");
        conteneur.textContent = "Lat " + latitude + "  ·  Lon " + longitude;
    });
    carte.on("mouseout", function () {
        conteneur.textContent = texteParDefaut;
    });
    L.DomEvent.disableClickPropagation(conteneur);
    return conteneur;
};
controleCoordonnees.addTo(carte);
