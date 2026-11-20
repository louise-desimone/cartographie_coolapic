"use strict";

// Panneau « À propos » : présentation, sources, flux à copier et liens.

const TEXTE_A_PROPOS =
    "<p>Carte interactive du club Coolapic pour préparer les plongées " +
    "et se souvenir des plongées passées : sites du club, profondeurs " +
    "et habitats marins de la côte méditerranéenne.</p>" +
    "<h3>Sources des données</h3>" +
    "<dl>" +
    "<dt>Fonds de plan</dt>" +
    "<dd>Carte littorale (IGN / Shom), Plan IGN et photographies " +
    "aériennes : IGN – Géoplateforme. OpenStreetMap et ses " +
    "contributeurs.</dd>" +
    "<dt>Bathymétrie</dt>" +
    "<dd>Isobathes DONIA diffusées par la plateforme MEDTRIX. " +
    "Isobathes GEBCO 2021, diffusées par OpenSeaMap.</dd>" +
    "<dt>Biodiversité</dt>" +
    "<dd>Habitats marins des Calanques et de la rade d'Hyères, et " +
    "observations du golfe du Lion : flux WFS de l'Office français " +
    "de la biodiversité (OFB).</dd>" +
    "<dt>Sites de plongée</dt>" +
    "<dd>Recensement du club Coolapic.</dd>" +
    "<dt>Météo</dt>" +
    "<dd>Vent : modèles Météo-France (AROME, ARPEGE), diffusés par " +
    "Open-Meteo. Température de l'eau en surface : modèle Météo-France, " +
    "diffusé par Open-Meteo. Vagues : modèles marins diffusés par " +
    "Open-Meteo (licence CC BY 4.0).</dd>" +
    "<dt>Recherche d'adresses</dt>" +
    "<dd>Nominatim (OpenStreetMap).</dd>" +
    "</dl>" +
    "<h3>Flux de données</h3>" +
    "<p>Adresses des services utilisés, à reprendre dans un SIG " +
    "(QGIS, ArcGIS…) :</p>" +
    '<ul class="flux-informations"></ul>' +
    "<h3>Pour aller plus loin</h3>" +
    '<ul class="liens-informations">' +
    '<li><a href="https://www.arcgis.com/apps/dashboards/cd29f5808c354d469f4849a643918f0f" target="_blank" rel="noopener">' +
    "Atlas de la biodiversité marine de la métropole Aix-Marseille-Provence</a> : " +
    "biocénoses sous-marines et références bibliographiques.</li>" +
    '<li><a href="https://plateforme.medtrix.fr/index.php" target="_blank" rel="noopener">' +
    "Plateforme MEDTRIX</a> : données et indicateurs de surveillance du " +
    "milieu marin méditerranéen.</li>" +
    '<li><a href="https://map.openseamap.org/" target="_blank" rel="noopener">' +
    "OpenSeaMap</a> : carte marine libre et collaborative (balisage, " +
    "ports, profondeurs).</li>" +
    "</ul>";

// Services utilisés par la carte. Construite à la première ouverture : les
// constantes des modules chargés après celui-ci sont alors définies.
function listerFluxDonnees() {
    return [
        {
            nom: "Fonds IGN – Géoplateforme",
            type: "WMS",
            couches: [
                fondCartesLittorales.options.layers,
                fondPlanIGNV2.options.layers,
                fondOrthophotographieHR.options.layers,
            ],
            url: URL_WMS_IGN,
        },
        { nom: "OpenStreetMap", type: "Tuiles XYZ", couches: [], url: URL_TUILES_OSM },
        {
            nom: "Isobathes DONIA (MEDTRIX)",
            type: "WMS",
            couches: [coucheIsobathesDonia.options.layers],
            url: URL_WMS_DONIA,
        },
        {
            nom: "Isobathes GEBCO 2021 (OpenSeaMap)",
            type: "WMS",
            couches: [coucheIsobathesGebco.options.layers],
            url: URL_WMS_GEBCO,
        },
        {
            nom: "Habitats et observations (OFB)",
            type: "WFS",
            couches: [
                TYPE_WFS_HABITATS,
                TYPE_WFS_BIOCENOSES_FR9301613,
                TYPE_WFS_OBSERVATIONS_GOLFE_DU_LION,
            ],
            url: URL_WFS_HABITATS,
        },
        {
            nom: "Vent, modèles Météo-France (Open-Meteo)",
            type: "API JSON",
            couches: [],
            url: URL_METEO_VENT,
        },
        {
            nom: "Vagues et température de l'eau, Météo-France (Open-Meteo)",
            type: "API JSON",
            couches: [],
            url: URL_METEO_MARIN,
        },
        {
            nom: "Recherche d'adresses (Nominatim)",
            type: "API",
            couches: [],
            url: URL_RECHERCHE_NOMINATIM,
        },
    ];
}

// Copie dans le presse-papiers ; à défaut (page non sécurisée, refus du
// navigateur), sélectionne le texte pour un Ctrl+C manuel.
function copierTexte(texte, element) {
    function selectionner() {
        const plage = document.createRange();
        plage.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(plage);
        return false;
    }
    if (!navigator.clipboard || !window.isSecureContext) {
        return Promise.resolve(selectionner());
    }
    return navigator.clipboard.writeText(texte).then(function () {
        return true;
    }, selectionner);
}

function remplirFluxDonnees(liste) {
    if (liste.childElementCount > 0) {
        return;
    }
    listerFluxDonnees().forEach(function (service) {
        const element = L.DomUtil.create("li", "", liste);
        L.DomUtil.create("strong", "", element).textContent = service.nom;
        L.DomUtil.create("span", "type-flux", element).textContent =
            " · " + service.type;

        const ligneUrl = L.DomUtil.create("div", "url-flux", element);
        const code = L.DomUtil.create("code", "", ligneUrl);
        code.textContent = service.url;
        const boutonCopier = L.DomUtil.create(
            "button",
            "bouton-copier-flux",
            ligneUrl
        );
        boutonCopier.type = "button";
        boutonCopier.textContent = "Copier";
        boutonCopier.setAttribute(
            "aria-label",
            "Copier l'adresse du flux " + service.nom
        );
        L.DomEvent.on(boutonCopier, "click", function () {
            copierTexte(service.url, code).then(function (reussi) {
                boutonCopier.textContent = reussi ? "Copié" : "Sélectionné";
                window.setTimeout(function () {
                    boutonCopier.textContent = "Copier";
                }, 1500);
            });
        });

        if (service.couches.length > 0) {
            L.DomUtil.create("div", "couches-flux", element).textContent =
                (service.couches.length > 1 ? "Couches : " : "Couche : ") +
                service.couches.join(", ");
        }
    });
}

const controleInformations = L.control({ position: "topright" });
controleInformations.onAdd = function () {
    const conteneur = L.DomUtil.create("div", "controle-informations");
    const bouton = creerBoutonBarre(
        conteneur,
        "bouton-informations",
        "info",
        "À propos de la carte et sources des données"
    );

    const panneau = L.DomUtil.create("div", "contenu-informations");
    panneau.setAttribute("role", "dialog");
    panneau.setAttribute("aria-label", "À propos de la carte");
    const entete = creerBoutonFermer(panneau, "Fermer « À propos »");
    const titre = L.DomUtil.create("h2", "");
    titre.textContent = "À propos de cette carte";
    entete.insertBefore(titre, entete.firstChild);
    // Texte statique écrit ci-dessus : aucune donnée externe n'est injectée.
    panneau.insertAdjacentHTML("beforeend", TEXTE_A_PROPOS);

    relierPanneauSousBarre(bouton, panneau, function () {
        remplirFluxDonnees(panneau.querySelector(".flux-informations"));
    });
    L.DomEvent.disableClickPropagation(conteneur);
    return conteneur;
};
controleInformations.addTo(carte);
