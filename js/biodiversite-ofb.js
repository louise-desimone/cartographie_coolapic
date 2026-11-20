"use strict";

// Habitats marins et observations de l'OFB (flux WFS chargés pour la zone
// affichée), avec leur légende.

const URL_WFS_HABITATS = "https://wxs.ofb.fr/geoserver/habitat/ows";
const TYPE_WFS_HABITATS =
    "habitat:eco_med_n2000_dhff_mpnc_habitat_aamp_pol_3857";
const TYPE_WFS_BIOCENOSES_FR9301613 =
    "habitat:eco_med_n2000_dhff_fr9301613_biocenose_aamp_pol_3857";
const TYPE_WFS_OBSERVATIONS_GOLFE_DU_LION =
    "habitat:eco_med_n2000_dhff_mcv_observations_aamp_pt_3857";
const TAILLE_PAGE_WFS = 1000;
// Couleurs reprises de l'Atlas de la biodiversité marine de la métropole
// Aix-Marseille-Provence (couche ArcGIS « Biocénoses sous-marines »).
// Chaque libellé OFB est rattaché à la classe la plus proche de cet atlas.
const COULEURS_ATLAS_AMP = {
    herbierPosidonie: "#38a800",
    matteMorte: "#e69800",
    herbierCymodocee: "#bee8ff",
    alguesInfralittorales: "#a80000",
    galetsInfralittoraux: "#ffbee8",
    fondsMeublesInfralittoraux: "#ffffbe",
    fondsMeublesCircalittoraux: "#ffebaf",
    coralligene: "#c500ff",
    rocheDuLarge: "#fcc1b8",
    vasesBathyales: "#cdcd66",
    rochesBathyales: "#894444",
    // Pas d'équivalent dans l'atlas.
    rocheMediolittorale: "#b4b4b4",
    nonClasse: "#6e6e6e",
};

const COULEURS_PAR_LIB_MNHN = {
    // Herbiers et matte morte
    "Biocénose de l'herbier à Posidonia oceanica":
        COULEURS_ATLAS_AMP.herbierPosidonie,
    "Association de la matte morte de Posidonia oceanica":
        COULEURS_ATLAS_AMP.matteMorte,
    "Association à Cymodocea nodosa sur SFBC":
        COULEURS_ATLAS_AMP.herbierCymodocee,
    // Substrats durs infralittoraux
    "Biocénose des algues infralittorales":
        COULEURS_ATLAS_AMP.alguesInfralittorales,
    "Biocénose des galets infralittoraux (GI)":
        COULEURS_ATLAS_AMP.galetsInfralittoraux,
    // Fonds meubles infralittoraux (et médiolittoraux)
    "Biocénose des sables fins bien calibrés (SFBC)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Biocénose des sables et graviers sous influence des courants de fond (SGCF)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Biocénose des sables fins de haut niveau (SFHN)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Biocénose des sables vaseux superficiels de mode calme (SVMC)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Biocénose des sables médiolittoraux (SM)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Biocénose du détritique médiolittoral (DM)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    // Fonds meubles circalittoraux
    "Biocénose du détritique côtier (DC)":
        COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    "Association à rhodolithes sur DC (Lithothamnion spp., Neogoniolithon mamillosum, Spongites fruticulosa )":
        COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    "Biocénose des fonds détritiques du large (DL)":
        COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    "Biocénose des fonds détritiques envasés (DE)":
        COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    VASES: COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    // Substrats durs circalittoraux et du large
    "Biocénose coralligène (C)": COULEURS_ATLAS_AMP.coralligene,
    "Biocénose de la roche du large (RL)": COULEURS_ATLAS_AMP.rocheDuLarge,
    // Étage bathyal
    "Biocénose des roches bathyales": COULEURS_ATLAS_AMP.rochesBathyales,
    "Biocénose des vases bathyales": COULEURS_ATLAS_AMP.vasesBathyales,
    // Sans équivalent dans l'atlas
    "Biocénose de la roche médiolittorale supérieure (RMS)":
        COULEURS_ATLAS_AMP.rocheMediolittorale,
    "Pas de correspondance": COULEURS_ATLAS_AMP.nonClasse,
    "Non renseigné": COULEURS_ATLAS_AMP.nonClasse,
    // Observations du golfe du Lion (catégories construites par l'application)
    "Herbiers et posidonies (observations)": COULEURS_ATLAS_AMP.herbierPosidonie,
    "Algues infralittorales (observations)":
        COULEURS_ATLAS_AMP.alguesInfralittorales,
    "Sables fins bien calibrés (observations)":
        COULEURS_ATLAS_AMP.fondsMeublesInfralittoraux,
    "Sables grossiers, graviers et galets (observations)":
        COULEURS_ATLAS_AMP.galetsInfralittoraux,
    "Vases (observations)": COULEURS_ATLAS_AMP.fondsMeublesCircalittoraux,
    "Coralligène (observations)": COULEURS_ATLAS_AMP.coralligene,
    "Autres substrats (observations)": COULEURS_ATLAS_AMP.nonClasse,
};
function creerCoucheHabitatsOFB() {
    return L.geoJSON(null, {
        pane: "habitatsOFB",
        attribution:
            'Données habitats : <a href="https://wxs.ofb.fr/geoserver/habitat/ows?service=WFS&amp;request=GetCapabilities">OFB</a>',
        style: function (entite) {
            const couleur = couleurHabitatMNHN(valeurLibelleMNHN(entite));
            return {
                color: couleur,
                weight: 0.5,
                opacity: 1,
                fillColor: couleur,
                // Transparence réglée sur tout le pane (curseur d'opacité).
                fillOpacity: 1,
            };
        },
        onEachFeature: function (entite, couche) {
            couche.bindPopup(creerFenetreHabitat(entite));
        },
    });
}

const coucheHabitatsOFB = creerCoucheHabitatsOFB();
const coucheBiocenosesFR9301613 = creerCoucheHabitatsOFB();
const coucheZonesOFB = L.layerGroup([
    coucheHabitatsOFB,
    coucheBiocenosesFR9301613,
]);
const coucheObservationsGolfeDuLion = L.geoJSON(null, {
    pointToLayer: function (entite, latlng) {
        const couleur = couleurHabitatMNHN(
            categorieObservationOFB(entite)
        );
        return L.circleMarker(latlng, {
            radius: 6,
            color: "#333333",
            weight: 1,
            fillColor: couleur,
            fillOpacity: 0.95,
        });
    },
    onEachFeature: function (entite, couche) {
        couche.bindPopup(creerFenetreObservationGolfeDuLion(entite));
    },
});

const legendeHabitatsOFB = L.control({ position: "topright" });
legendeHabitatsOFB.onAdd = function () {
    const conteneur = L.DomUtil.create("details", "legende-habitats");
    const titre = L.DomUtil.create("summary", "", conteneur);
    titre.textContent = "Légende habitats et observations OFB";
    L.DomUtil.create("div", "legende-habitats-liste", conteneur);
    L.DomEvent.disableClickPropagation(conteneur);
    L.DomEvent.disableScrollPropagation(conteneur);
    return conteneur;
};

const sourcesHabitatsOFB = [
    {
        couche: coucheHabitatsOFB,
        typeName: TYPE_WFS_HABITATS,
        nom: "habitats marins des Calanques",
        categoriePourLegende: valeurLibelleMNHN,
        controleur: null,
        empriseEnCours: "",
        empriseChargee: "",
        categories: [],
        erreur: false,
    },
    {
        couche: coucheBiocenosesFR9301613,
        typeName: TYPE_WFS_BIOCENOSES_FR9301613,
        nom: "habitats marins de la Rade d'Hyères",
        categoriePourLegende: valeurLibelleMNHN,
        controleur: null,
        empriseEnCours: "",
        empriseChargee: "",
        categories: [],
        erreur: false,
    },
    {
        couche: coucheObservationsGolfeDuLion,
        typeName: TYPE_WFS_OBSERVATIONS_GOLFE_DU_LION,
        nom: "observations du golfe du Lion",
        categoriePourLegende: categorieObservationOFB,
        controleur: null,
        empriseEnCours: "",
        empriseChargee: "",
        categories: [],
        erreur: false,
    },
];
let minuterieDeplacementHabitats = null;

// Texte d'attribut protégé, avec une valeur par défaut s'il est vide.
function texteAttribut(texte) {
    const valeur = String(texte || "").trim();
    return protegerTexte(valeur || "Non renseigné");
}

function valeurLibelleMNHN(entite) {
    const proprietes = entite.properties || {};
    return String(proprietes.lib_mnhn || "").trim() || "Non renseigné";
}

function couleurHabitatMNHN(libelle) {
    return Object.prototype.hasOwnProperty.call(
        COULEURS_PAR_LIB_MNHN,
        libelle
    )
        ? COULEURS_PAR_LIB_MNHN[libelle]
        : COULEURS_ATLAS_AMP.nonClasse;
}

function categorieObservationOFB(entite) {
    const infos = entite.properties || {};
    const substrat = sansAccents(infos.obs_subst);
    const autresObservations = sansAccents(
        [infos.obs_faune, infos.obs_flore, infos.obs_div].join(" ")
    );

    if (substrat.includes("sable fin") && substrat.includes("calibre")) {
        return "Sables fins bien calibrés (observations)";
    }
    if (substrat.includes("corralig") || substrat.includes("corallig")) {
        return "Coralligène (observations)";
    }
    if (
        substrat.includes("sgcf") ||
        substrat.includes("sable grossier") ||
        substrat.includes("gravier") ||
        substrat.includes("galet") ||
        substrat.includes("caillou")
    ) {
        return "Sables grossiers, graviers et galets (observations)";
    }
    if (substrat.includes("vase")) {
        return "Vases (observations)";
    }
    if (
        substrat.includes("posidon") ||
        substrat.includes("herbier")
    ) {
        return "Herbiers et posidonies (observations)";
    }
    if (
        substrat.includes("algue") &&
        substrat.includes("infralittoral")
    ) {
        return "Algues infralittorales (observations)";
    }
    if (
        autresObservations.includes("posidon") ||
        autresObservations.includes("herbier")
    ) {
        return "Herbiers et posidonies (observations)";
    }
    if (
        autresObservations.includes("corralig") ||
        autresObservations.includes("corallig") ||
        autresObservations.includes("eunicella")
    ) {
        return "Coralligène (observations)";
    }
    if (autresObservations.includes("algue")) {
        return "Algues infralittorales (observations)";
    }

    return "Autres substrats (observations)";
}

function observationEstRenseignee(entite) {
    const infos = entite.properties || {};
    return [
        infos.obs_subst,
        infos.obs_faune,
        infos.obs_flore,
        infos.obs_div,
    ].some(function (valeur) {
        return String(valeur || "").trim() !== "";
    });
}

function actualiserLegendeHabitats() {
    const liste = document.querySelector(".legende-habitats-liste");
    if (!liste) {
        return;
    }

    const categories = Array.from(
        new Set(
            sourcesHabitatsOFB.reduce(function (toutes, source) {
                if (carte.hasLayer(source.couche)) {
                    return toutes.concat(source.categories);
                }
                return toutes;
            }, [])
        )
    ).sort(function (premiere, seconde) {
        return premiere.localeCompare(seconde, "fr");
    });

    liste.innerHTML = categories
        .map(function (libelle) {
            return (
                '<div class="element-legende-habitat">' +
                '<span class="couleur-legende-habitat" style="background-color:' +
                couleurHabitatMNHN(libelle) +
                '"></span><span>' +
                protegerTexte(libelle) +
                "</span></div>"
            );
        })
        .join("");
}

function actualiserErreurHabitats() {
    const sourceEnErreur = sourcesHabitatsOFB.find(function (source) {
        return source.erreur && carte.hasLayer(source.couche);
    });

    if (!sourceEnErreur) {
        masquerMessage("Le flux WFS ");
        return;
    }
    afficherMessage(
        "Le flux WFS " +
            sourceEnErreur.nom +
            " n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.",
        true
    );
}

function creerFenetreHabitat(entite) {
    const infos = entite.properties || {};
    const dateMission = String(infos.date_supp || "").trim();

    return (
        "<strong>" +
        texteAttribut(valeurLibelleMNHN(entite)) +
        "</strong><br>" +
        "Site : " +
        texteAttribut(infos.site) +
        "<br>" +
        "Zone : " +
        texteAttribut(infos.zone_) +
        (dateMission
            ? "<br>Date de mission : " + texteAttribut(dateMission)
            : "")
    );
}

function creerFenetreObservationGolfeDuLion(entite) {
    const infos = entite.properties || {};
    const observations = [
        { nom: "Faune", valeur: infos.obs_faune },
        { nom: "Flore", valeur: infos.obs_flore },
        { nom: "Substrat", valeur: infos.obs_subst },
        { nom: "Diversité", valeur: infos.obs_div },
    ]
        .map(function (observation) {
            return {
                nom: observation.nom,
                valeur: String(observation.valeur || "").trim(),
            };
        })
        .filter(function (observation) {
            return observation.valeur !== "";
        });
    const titre = observations.shift();
    const valeurs = [];

    if (titre) {
        valeurs.push(
            "<strong>" + protegerTexte(titre.valeur) + "</strong>"
        );
    }

    [
        { nom: "Site", valeur: infos.site },
        { nom: "Zone", valeur: infos.zone_ },
        { nom: "Date d'observation", valeur: infos.date_obs },
    ].forEach(function (champ) {
        const valeur = String(champ.valeur || "").trim();
        if (valeur) {
            valeurs.push(champ.nom + " : " + protegerTexte(valeur));
        }
    });

    observations.forEach(function (observation) {
        valeurs.push(
            observation.nom + " : " + protegerTexte(observation.valeur)
        );
    });

    return valeurs.join("<br>");
}

function cleEmprise(bounds) {
    return [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
    ]
        .map(function (coordonnee) {
            return coordonnee.toFixed(5);
        })
        .join(",");
}

async function lireHabitatsWFS(bounds, signal, typeName) {
    const entites = [];
    let indexDepart = 0;

    while (true) {
        const url = new URL(URL_WFS_HABITATS);
        url.searchParams.set("service", "WFS");
        url.searchParams.set("version", "2.0.0");
        url.searchParams.set("request", "GetFeature");
        url.searchParams.set("typeNames", typeName);
        url.searchParams.set("outputFormat", "application/json");
        url.searchParams.set("srsName", "EPSG:4326");
        url.searchParams.set(
            "bbox",
            [
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth(),
                "EPSG:4326",
            ].join(",")
        );
        url.searchParams.set("count", String(TAILLE_PAGE_WFS));
        url.searchParams.set("startIndex", String(indexDepart));

        const reponse = await fetch(url, { signal: signal });
        if (!reponse.ok) {
            throw new Error("Le service WFS a répondu avec le statut " + reponse.status);
        }

        const collection = await reponse.json();
        if (!Array.isArray(collection.features)) {
            throw new Error("La réponse du service WFS ne contient pas de géométries GeoJSON.");
        }

        entites.push.apply(entites, collection.features);
        indexDepart += collection.features.length;

        const nombreCorrespondant = Number(collection.numberMatched);
        if (
            collection.features.length === 0 ||
            (Number.isFinite(nombreCorrespondant) &&
                indexDepart >= nombreCorrespondant) ||
            (!Number.isFinite(nombreCorrespondant) &&
                collection.features.length < TAILLE_PAGE_WFS)
        ) {
            break;
        }
    }

    return { type: "FeatureCollection", features: entites };
}

async function chargerHabitatsOFB(source) {
    const bounds = carte.getBounds();
    const empriseDemandee = cleEmprise(bounds);

    if (empriseDemandee === source.empriseChargee) {
        if (source.controleur) {
            source.controleur.abort();
        }
        return;
    }
    if (empriseDemandee === source.empriseEnCours) {
        return;
    }

    if (source.controleur) {
        source.controleur.abort();
    }

    const controleur = new AbortController();
    source.controleur = controleur;
    source.empriseEnCours = empriseDemandee;

    try {
        const donnees = await lireHabitatsWFS(
            bounds,
            controleur.signal,
            source.typeName
        );
        if (
            controleur.signal.aborted ||
            !carte.hasLayer(source.couche) ||
            cleEmprise(carte.getBounds()) !== empriseDemandee
        ) {
            return;
        }

        const entites = donnees.features.filter(function (entite) {
            return (
                source.typeName !== TYPE_WFS_OBSERVATIONS_GOLFE_DU_LION ||
                observationEstRenseignee(entite)
            );
        });
        source.couche.clearLayers();
        source.couche.addData({
            type: "FeatureCollection",
            features: entites,
        });
        source.categories = Array.from(
            new Set(entites.map(source.categoriePourLegende))
        );
        source.erreur = false;
        actualiserLegendeHabitats();
        actualiserErreurHabitats();
        source.empriseChargee = empriseDemandee;
    } catch (erreur) {
        if (controleur.signal.aborted) {
            return;
        }

        console.error(
            "Erreur pendant le chargement du flux WFS OFB (" +
                source.nom +
                ") :",
            erreur
        );
        source.erreur = true;
        actualiserErreurHabitats();
    } finally {
        if (source.controleur === controleur) {
            source.controleur = null;
            source.empriseEnCours = "";
        }
    }
}

function sourcesOFBActives() {
    return sourcesHabitatsOFB.filter(function (source) {
        return carte.hasLayer(source.couche);
    });
}

function auAjoutCoucheOFB() {
    // La légende n'entre dans la pile qu'à sa première apparition : activer
    // une deuxième couche OFB ne la déplace pas.
    const legende = legendeHabitatsOFB.getContainer();
    if (!legende || !legende.isConnected) {
        legendeHabitatsOFB.addTo(carte);
        afficherSousBarre(legendeHabitatsOFB.getContainer());
    }
    actualiserLegendeHabitats();
    actualiserErreurHabitats();
    sourcesOFBActives().forEach(chargerHabitatsOFB);
}

function auRetraitCoucheOFB() {
    sourcesHabitatsOFB.forEach(function (source) {
        if (carte.hasLayer(source.couche)) {
            return;
        }
        if (source.controleur) {
            source.controleur.abort();
            source.controleur = null;
            source.empriseEnCours = "";
        }
        source.erreur = false;
    });
    if (sourcesOFBActives().length === 0) {
        clearTimeout(minuterieDeplacementHabitats);
        legendeHabitatsOFB.remove();
    } else {
        actualiserLegendeHabitats();
    }
    actualiserErreurHabitats();
}

// Leaflet met la carte à jour avant d'émettre « add » et « remove ».
[coucheZonesOFB, coucheObservationsGolfeDuLion].forEach(function (couche) {
    couche.on("add", auAjoutCoucheOFB);
    couche.on("remove", auRetraitCoucheOFB);
});

// Recharge les flux actifs pour la nouvelle zone affichée.
carte.on("moveend", function () {
    if (sourcesOFBActives().length === 0) {
        return;
    }
    clearTimeout(minuterieDeplacementHabitats);
    minuterieDeplacementHabitats = setTimeout(function () {
        sourcesOFBActives().forEach(chargerHabitatsOFB);
    }, 250);
});
