"use strict";

// Météo, via Open-Meteo (gratuit pour un usage non commercial, sans clé,
// CC BY 4.0) :
// - vent des modèles Météo-France (AROME / ARPEGE), avec les vagues en fiche ;
// - température de l'eau en surface (modèle Météo-France, mailles d'environ
//   8 km), en étiquettes.
// Le flux WMS de Météo-France exige une clé qui serait visible dans le code
// de la page : il n'est donc pas utilisé directement.
const URL_METEO_VENT = "https://api.open-meteo.com/v1/meteofrance";
const URL_METEO_MARIN = "https://marine-api.open-meteo.com/v1/marine";
const HEURES_PREVISION_METEO = 48;
const ESPACEMENT_FLECHES_PX = 110;
const NOMBRE_MAX_POINTS_METEO = 60;
// Pas de grille possibles, en degrés : la grille reste fixe quand on déplace
// la carte, ce qui permet de réutiliser les points déjà téléchargés.
const PAS_GRILLE_METEO = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
// Les prévisions commencent à l'heure courante : au-delà de cette durée, on
// recharge tout pour que tous les points partagent les mêmes heures.
const DUREE_VALIDITE_METEO_MS = 30 * 60 * 1000;

// Échelle de couleur du vent, en nœuds (proche de l'échelle de Beaufort).
const CLASSES_VENT = [
    { max: 7, couleur: "#2e86de", libelle: "< 7" },
    { max: 17, couleur: "#20bf6b", libelle: "7–16" },
    { max: 22, couleur: "#f7b731", libelle: "17–21" },
    { max: 28, couleur: "#fa8231", libelle: "22–27" },
    { max: 34, couleur: "#eb3b5a", libelle: "28–33" },
    { max: Infinity, couleur: "#8854d0", libelle: "≥ 34" },
];
// Échelle de couleur de la température de l'eau, en °C.
const CLASSES_TEMPERATURE_EAU = [
    { max: 13, couleur: "#2c7bb6", libelle: "< 13" },
    { max: 16, couleur: "#00a6ca", libelle: "13–15" },
    { max: 19, couleur: "#4dbd8f", libelle: "16–18" },
    { max: 22, couleur: "#e3b505", libelle: "19–21" },
    { max: 25, couleur: "#f29e2e", libelle: "22–24" },
    { max: Infinity, couleur: "#d7191c", libelle: "≥ 25" },
];
const DIRECTIONS_CARDINALES = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
];
const ATTRIBUTION_OPEN_METEO =
    'Météo : <a href="https://open-meteo.com/">Open-Meteo</a> ' +
    "(modèles Météo-France et marins, CC BY 4.0)";

const coucheVent = L.layerGroup([], { attribution: ATTRIBUTION_OPEN_METEO });
const coucheTemperatureEau = L.layerGroup([], {
    attribution: ATTRIBUTION_OPEN_METEO,
});

// Données par point de grille ; pour le marin, avec la maille du modèle.
const cacheVent = new Map();
const cacheMarin = new Map();
const marqueursVent = new Map();
const marqueursTemperature = new Map();
let heuresMeteo = [];
let indexHeureMeteo = 0;
let controleurMeteo = null;
let minuterieMeteo = null;
let elementsControleMeteo = null;
let dateChargementMeteo = 0;

function meteoActive() {
    return carte.hasLayer(coucheVent) || carte.hasLayer(coucheTemperatureEau);
}

function viderCacheMeteoSiPerime() {
    if (Date.now() - dateChargementMeteo < DUREE_VALIDITE_METEO_MS) {
        return;
    }
    cacheVent.clear();
    cacheMarin.clear();
    marqueursVent.forEach(function (marqueur) {
        coucheVent.removeLayer(marqueur);
    });
    marqueursVent.clear();
    marqueursTemperature.forEach(function (marqueur) {
        coucheTemperatureEau.removeLayer(marqueur);
    });
    marqueursTemperature.clear();
    heuresMeteo = [];
    indexHeureMeteo = 0;
    dateChargementMeteo = Date.now();
}

function couleurSelonClasses(classes, valeur) {
    return classes.find(function (classe) {
        return valeur < classe.max;
    }).couleur;
}

function directionCardinale(degres) {
    return DIRECTIONS_CARDINALES[Math.round(degres / 22.5) % 16];
}

function formaterNombre(valeur, decimales) {
    return Number(valeur).toLocaleString("fr-FR", {
        maximumFractionDigits: decimales,
    });
}

function formaterHeureMeteo(texteIso) {
    // Les heures sont demandées en heure de Paris (paramètre timezone).
    const [date, heure] = texteIso.split("T");
    const [annee, mois, jour] = date.split("-").map(Number);
    const jourSemaine = new Date(annee, mois - 1, jour).toLocaleDateString(
        "fr-FR",
        { weekday: "short", day: "numeric", month: "short" }
    );
    return jourSemaine + " · " + heure.replace(":00", " h");
}

function valeurA(serie, index) {
    return serie && Number.isFinite(serie[index]) ? serie[index] : null;
}

// Points de la grille visibles, alignés sur un pas fixe en degrés.
function pointsGrilleMeteo() {
    const limites = carte.getBounds();
    const degresParPixel = 360 / (256 * Math.pow(2, carte.getZoom()));
    const pasIdeal = degresParPixel * ESPACEMENT_FLECHES_PX;
    const pas =
        PAS_GRILLE_METEO.find(function (valeur) {
            return valeur >= pasIdeal;
        }) || PAS_GRILLE_METEO[PAS_GRILLE_METEO.length - 1];

    const points = [];
    const latMin = Math.ceil(limites.getSouth() / pas);
    const latMax = Math.floor(limites.getNorth() / pas);
    const lonMin = Math.ceil(limites.getWest() / pas);
    const lonMax = Math.floor(limites.getEast() / pas);
    for (let i = latMin; i <= latMax; i++) {
        for (let j = lonMin; j <= lonMax; j++) {
            const lat = Number((i * pas).toFixed(4));
            const lon = Number((j * pas).toFixed(4));
            points.push({ cle: lat + "," + lon, lat: lat, lon: lon });
        }
    }
    return points.slice(0, NOMBRE_MAX_POINTS_METEO);
}

async function lireOpenMeteo(url, parametres, points, signal) {
    const adresse = new URL(url);
    Object.keys(parametres).forEach(function (nom) {
        adresse.searchParams.set(nom, parametres[nom]);
    });
    adresse.searchParams.set("forecast_hours", String(HEURES_PREVISION_METEO));
    adresse.searchParams.set("timezone", "Europe/Paris");
    adresse.searchParams.set(
        "latitude",
        points.map(function (point) { return point.lat; }).join(",")
    );
    adresse.searchParams.set(
        "longitude",
        points.map(function (point) { return point.lon; }).join(",")
    );
    const reponse = await fetch(adresse, { signal: signal });
    if (!reponse.ok) {
        throw new Error("Open-Meteo a répondu avec le statut " + reponse.status);
    }
    const donnees = await reponse.json();
    // Une seule position renvoie un objet, plusieurs renvoient une liste.
    return Array.isArray(donnees) ? donnees : [donnees];
}

function retenirHeures(horaire) {
    if (heuresMeteo.length === 0 && horaire && horaire.time) {
        heuresMeteo = horaire.time;
    }
}

async function chargerVent(points, signal) {
    const manquants = points.filter(function (point) {
        return !cacheVent.has(point.cle);
    });
    if (manquants.length === 0) {
        return;
    }
    const reponses = await lireOpenMeteo(
        URL_METEO_VENT,
        {
            hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
            wind_speed_unit: "kn",
        },
        manquants,
        signal
    );
    manquants.forEach(function (point, index) {
        const horaire = reponses[index] && reponses[index].hourly;
        if (horaire) {
            cacheVent.set(point.cle, horaire);
            retenirHeures(horaire);
        }
    });
}

async function chargerMarin(points, signal) {
    const manquants = points.filter(function (point) {
        return !cacheMarin.has(point.cle);
    });
    if (manquants.length === 0) {
        return;
    }
    const reponses = await lireOpenMeteo(
        URL_METEO_MARIN,
        {
            hourly:
                "wave_height,wave_direction,wave_period,sea_surface_temperature",
        },
        manquants,
        signal
    );
    manquants.forEach(function (point, index) {
        const reponse = reponses[index];
        if (!reponse || !reponse.hourly) {
            return;
        }
        // Open-Meteo renvoie la maille marine la plus proche du point demandé.
        const latMaille = Number(reponse.latitude.toFixed(4));
        const lonMaille = Number(reponse.longitude.toFixed(4));
        cacheMarin.set(point.cle, {
            horaire: reponse.hourly,
            maille: {
                cle: latMaille + "," + lonMaille,
                lat: latMaille,
                lon: lonMaille,
            },
        });
        retenirHeures(reponse.hourly);
    });
}

function creerIconeVent(vitesse, direction) {
    const couleur = couleurSelonClasses(CLASSES_VENT, vitesse);
    // La direction météo indique d'où vient le vent : la flèche pointe
    // dans le sens où il souffle.
    const rotation = (direction + 180) % 360;
    return L.divIcon({
        className: "icone-vent",
        html:
            '<span class="fleche-vent" style="color:' + couleur + '">' +
            '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" ' +
            'style="transform:rotate(' + rotation + 'deg)">' +
            '<path d="M12 2 19 14h-4.5v8h-5v-8H5Z" fill="currentColor" ' +
            'stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"/></svg>' +
            '<span class="vitesse-vent">' + Math.round(vitesse) + "</span></span>",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -14],
    });
}

function creerIconeTemperature(temperature) {
    const couleur = couleurSelonClasses(CLASSES_TEMPERATURE_EAU, temperature);
    return L.divIcon({
        className: "icone-temperature-eau",
        html:
            '<span class="etiquette-temperature-eau" style="--couleur-eau:' +
            couleur + '">' + formaterNombre(temperature, 1) + "°</span>",
        iconSize: [48, 22],
        iconAnchor: [24, 11],
        popupAnchor: [0, -10],
    });
}

function ligneVagues(marin, index) {
    const hauteur = valeurA(marin.wave_height, index);
    if (hauteur === null) {
        return "";
    }
    return (
        "<br>Vagues : " + formaterNombre(hauteur, 1) + " m, période " +
        formaterNombre(marin.wave_period[index], 0) + " s, de " +
        directionCardinale(marin.wave_direction[index])
    );
}

function contenuPopupVent(point, vent, marin, index) {
    const direction = vent.wind_direction_10m[index];
    let texte =
        "<strong>" + formaterHeureMeteo(vent.time[index]) + "</strong><br>" +
        "Vent : " + formaterNombre(vent.wind_speed_10m[index], 0) +
        " nœuds, de " + directionCardinale(direction) +
        " (" + Math.round(direction) + "°)<br>" +
        "Rafales : " + formaterNombre(vent.wind_gusts_10m[index], 0) + " nœuds";
    if (marin) {
        texte += ligneVagues(marin.horaire, index);
    }
    return (
        '<div class="popup-meteo">' + texte +
        '<p class="source-popup-meteo">' +
        formaterNombre(point.lat, 3) + " N, " + formaterNombre(point.lon, 3) +
        " E · modèles Météo-France via Open-Meteo</p></div>"
    );
}

function contenuPopupTemperature(maille, horaire, index) {
    return (
        '<div class="popup-meteo"><strong>' +
        formaterHeureMeteo(horaire.time[index]) + "</strong><br>" +
        "Eau en surface : " +
        formaterNombre(horaire.sea_surface_temperature[index], 1) + " °C" +
        ligneVagues(horaire, index) +
        '<p class="source-popup-meteo">Valeur moyenne de la maille du modèle ' +
        "(environ 8 km), centrée sur " + formaterNombre(maille.lat, 3) +
        " N, " + formaterNombre(maille.lon, 3) +
        " E · modèle Météo-France via Open-Meteo. En plongée, l'eau peut " +
        "être nettement plus froide " +
        "en profondeur.</p></div>"
    );
}

// Crée, met à jour ou retire les marqueurs d'une couche.
function synchroniserMarqueurs(couche, marqueurs, elements) {
    const clesVisibles = new Set();
    elements.forEach(function (element) {
        clesVisibles.add(element.cle);
        let marqueur = marqueurs.get(element.cle);
        if (marqueur) {
            marqueur.setLatLng(element.position);
            marqueur.setIcon(element.icone);
            marqueur.setPopupContent(element.popup);
            return;
        }
        marqueur = L.marker(element.position, {
            icon: element.icone,
            keyboard: false,
            bubblingMouseEvents: false,
        }).bindPopup(element.popup, {
            // Garder la fiche sous la barre d'outils et les boîtiers
            // affichés en haut à droite.
            autoPanPaddingTopLeft: L.point(20, 190),
        });
        marqueurs.set(element.cle, marqueur);
        couche.addLayer(marqueur);
    });
    marqueurs.forEach(function (marqueur, cle) {
        if (!clesVisibles.has(cle)) {
            couche.removeLayer(marqueur);
            marqueurs.delete(cle);
        }
    });
}

function afficherVent(points) {
    const elements = [];
    points.forEach(function (point) {
        const vent = cacheVent.get(point.cle);
        if (!vent) {
            return;
        }
        const vitesse = valeurA(vent.wind_speed_10m, indexHeureMeteo);
        const direction = valeurA(vent.wind_direction_10m, indexHeureMeteo);
        if (vitesse === null || direction === null) {
            return;
        }
        elements.push({
            cle: point.cle,
            position: [point.lat, point.lon],
            icone: creerIconeVent(vitesse, direction),
            popup: contenuPopupVent(
                point,
                vent,
                cacheMarin.get(point.cle),
                indexHeureMeteo
            ),
        });
    });
    synchroniserMarqueurs(coucheVent, marqueursVent, elements);
}

// Une étiquette par maille marine : au centre de la maille s'il est visible,
// sinon au milieu des points de grille qui s'y rattachent.
function afficherTemperatureEau(points) {
    const limites = carte.getBounds();
    const mailles = new Map();
    points.forEach(function (point) {
        const marin = cacheMarin.get(point.cle);
        if (!marin) {
            return;
        }
        let groupe = mailles.get(marin.maille.cle);
        if (!groupe) {
            groupe = { maille: marin.maille, horaire: marin.horaire, points: [] };
            mailles.set(marin.maille.cle, groupe);
        }
        groupe.points.push(point);
    });

    const elements = [];
    mailles.forEach(function (groupe) {
        const temperature = valeurA(
            groupe.horaire.sea_surface_temperature,
            indexHeureMeteo
        );
        if (temperature === null) {
            return;
        }
        let position = [groupe.maille.lat, groupe.maille.lon];
        if (!limites.contains(position)) {
            position = [
                groupe.points.reduce(function (somme, p) { return somme + p.lat; }, 0) /
                    groupe.points.length,
                groupe.points.reduce(function (somme, p) { return somme + p.lon; }, 0) /
                    groupe.points.length,
            ];
        }
        elements.push({
            cle: groupe.maille.cle,
            position: position,
            icone: creerIconeTemperature(temperature),
            popup: contenuPopupTemperature(
                groupe.maille,
                groupe.horaire,
                indexHeureMeteo
            ),
        });
    });
    synchroniserMarqueurs(coucheTemperatureEau, marqueursTemperature, elements);
}

function afficherMeteo() {
    const points = pointsGrilleMeteo();
    if (carte.hasLayer(coucheVent)) {
        afficherVent(points);
    }
    if (carte.hasLayer(coucheTemperatureEau)) {
        afficherTemperatureEau(points);
    }
}

function remplirLegende(conteneur, classes) {
    while (conteneur.firstChild) {
        conteneur.removeChild(conteneur.firstChild);
    }
    classes.forEach(function (classe) {
        const element = L.DomUtil.create("span", "", conteneur);
        element.style.setProperty("--couleur-classe", classe.couleur);
        element.textContent = classe.libelle;
    });
}

function actualiserControleMeteo(etat) {
    if (!elementsControleMeteo) {
        return;
    }
    const e = elementsControleMeteo;
    e.curseur.max = String(Math.max(heuresMeteo.length - 1, 0));
    e.curseur.value = String(indexHeureMeteo);
    e.curseur.disabled = heuresMeteo.length === 0;
    e.heure.textContent = heuresMeteo.length
        ? formaterHeureMeteo(heuresMeteo[indexHeureMeteo])
        : "—";
    e.blocVent.hidden = !carte.hasLayer(coucheVent);
    e.blocTemperature.hidden = !carte.hasLayer(coucheTemperatureEau);
    if (etat !== undefined) {
        e.statut.textContent = etat;
        e.statut.hidden = !etat;
    }
}

async function actualiserMeteo() {
    if (!meteoActive()) {
        return;
    }
    viderCacheMeteoSiPerime();
    const points = pointsGrilleMeteo();
    const ventDemande = carte.hasLayer(coucheVent);
    const temperatureDemandee = carte.hasLayer(coucheTemperatureEau);
    const manquePoints = points.some(function (point) {
        return (
            (ventDemande && !cacheVent.has(point.cle)) ||
            !cacheMarin.has(point.cle)
        );
    });
    if (!manquePoints) {
        afficherMeteo();
        actualiserControleMeteo("");
        return;
    }

    if (controleurMeteo) {
        controleurMeteo.abort();
    }
    const controleur = new AbortController();
    controleurMeteo = controleur;
    actualiserControleMeteo("Chargement des prévisions…");

    try {
        await Promise.all([
            ventDemande ? chargerVent(points, controleur.signal) : null,
            chargerMarin(points, controleur.signal).catch(function (erreur) {
                // Pour le vent seul, les vagues ne sont qu'un complément.
                if (temperatureDemandee || controleur.signal.aborted) {
                    throw erreur;
                }
                console.error("Données marines Open-Meteo indisponibles :", erreur);
            }),
        ]);
        if (controleurMeteo === controleur) {
            controleurMeteo = null;
        }
        if (!meteoActive()) {
            return;
        }
        afficherMeteo();
        actualiserControleMeteo("");
    } catch (erreur) {
        if (erreur.name === "AbortError") {
            return;
        }
        console.error("Erreur pendant le chargement de la météo :", erreur);
        actualiserControleMeteo(
            "Prévisions indisponibles. Vérifiez votre connexion."
        );
    }
}

// Boîtier de l'heure de prévision, commun aux couches météo.
const controleMeteo = L.control({ position: "topright" });
controleMeteo.onAdd = function () {
    const conteneur = L.DomUtil.create("div", "controle-meteo");
    const titre = L.DomUtil.create("div", "titre-controle-meteo", conteneur);
    titre.textContent = "Prévisions";
    const heure = L.DomUtil.create("span", "heure-meteo", titre);

    const curseur = L.DomUtil.create("input", "curseur-meteo", conteneur);
    curseur.type = "range";
    curseur.min = "0";
    curseur.step = "1";
    curseur.setAttribute("aria-label", "Heure de la prévision");

    const blocVent = L.DomUtil.create("div", "bloc-legende-meteo", conteneur);
    L.DomUtil.create("div", "titre-legende-meteo", blocVent).textContent =
        "Vent (nœuds)";
    remplirLegende(
        L.DomUtil.create("div", "legende-meteo", blocVent),
        CLASSES_VENT
    );

    const blocTemperature = L.DomUtil.create(
        "div",
        "bloc-legende-meteo",
        conteneur
    );
    L.DomUtil.create("div", "titre-legende-meteo", blocTemperature).textContent =
        "Eau en surface (°C)";
    remplirLegende(
        L.DomUtil.create("div", "legende-meteo", blocTemperature),
        CLASSES_TEMPERATURE_EAU
    );

    const statut = L.DomUtil.create("div", "statut-meteo", conteneur);
    statut.setAttribute("role", "status");
    statut.hidden = true;

    L.DomEvent.on(curseur, "input", function () {
        indexHeureMeteo = Number(curseur.value);
        actualiserControleMeteo();
        afficherMeteo();
    });
    L.DomEvent.disableClickPropagation(conteneur);
    L.DomEvent.disableScrollPropagation(conteneur);

    elementsControleMeteo = {
        curseur: curseur,
        heure: heure,
        statut: statut,
        blocVent: blocVent,
        blocTemperature: blocTemperature,
    };
    actualiserControleMeteo("");
    return conteneur;
};
controleMeteo.onRemove = function () {
    elementsControleMeteo = null;
};

function auChangementCoucheMeteo() {
    if (!meteoActive()) {
        clearTimeout(minuterieMeteo);
        if (controleurMeteo) {
            controleurMeteo.abort();
            controleurMeteo = null;
        }
        controleMeteo.remove();
        return;
    }
    if (!elementsControleMeteo) {
        controleMeteo.addTo(carte);
        afficherSousBarre(controleMeteo.getContainer());
    }
    actualiserControleMeteo();
    actualiserMeteo();
}

// Leaflet retire la couche de la carte avant d'émettre « remove » :
// hasLayer est donc déjà à jour dans les deux cas.
[coucheVent, coucheTemperatureEau].forEach(function (couche) {
    couche.on("add remove", auChangementCoucheMeteo);
});
carte.on("moveend", function () {
    if (!meteoActive()) {
        return;
    }
    clearTimeout(minuterieMeteo);
    minuterieMeteo = setTimeout(actualiserMeteo, 350);
});
