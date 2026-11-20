"use strict";

// Barre d'outils en haut à droite (informations, recherche d'adresses,
// localisation, plein écran, couches) et pile des panneaux sous la barre.

// Icônes SVG des boutons (trait de la couleur du texte).
const ICONES_BARRE_OUTILS = {
    localisation:
        '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' +
        '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    pleinEcran: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    quitterPleinEcran: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
    couches:
        '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/>' +
        '<path d="m2 16 10 5 10-5"/>',
    info:
        '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/>' +
        '<circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>',
};

function iconeBarreOutils(nom) {
    return (
        '<svg class="icone-barre-outils" viewBox="0 0 24 24" width="18" height="18" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        ICONES_BARRE_OUTILS[nom] +
        "</svg>"
    );
}

function creerBoutonBarre(parent, classe, icone, etiquette) {
    const bouton = L.DomUtil.create(
        "button",
        "bouton-barre-outils " + classe,
        parent
    );
    bouton.type = "button";
    bouton.innerHTML = iconeBarreOutils(icone);
    bouton.title = etiquette;
    bouton.setAttribute("aria-label", etiquette);
    return bouton;
}

// Pile sous la barre : panneaux, recherche, légende et heure météo s'y
// empilent, alignés à droite, dans l'ordre où ils ont été ouverts.
const zoneSousBarre = L.DomUtil.create(
    "div",
    "zone-sous-barre",
    carte.getContainer().querySelector(".leaflet-top.leaflet-right")
);
L.DomEvent.disableClickPropagation(zoneSousBarre);
L.DomEvent.disableScrollPropagation(zoneSousBarre);
let rangOuvertureSousBarre = 0;

// Range l'élément dans la pile et le place en dernier (le plus bas).
function afficherSousBarre(element) {
    if (element.parentNode !== zoneSousBarre) {
        zoneSousBarre.appendChild(element);
    }
    rangOuvertureSousBarre += 1;
    element.style.order = String(rangOuvertureSousBarre);
}

// Bouton « × » placé en haut à droite d'un panneau.
function creerBoutonFermer(panneau, etiquette) {
    const entete = L.DomUtil.create("div", "entete-panneau", panneau);
    const bouton = L.DomUtil.create("button", "bouton-fermer-panneau", entete);
    bouton.type = "button";
    bouton.textContent = "×";
    bouton.title = "Fermer";
    bouton.setAttribute("aria-label", etiquette);
    return entete;
}

// Relie un bouton de la barre à un panneau de la pile : le bouton l'ouvre
// ou le ferme ; la croix, Échap ou un clic sur la carte le ferment.
function relierPanneauSousBarre(bouton, panneau, avantOuverture) {
    panneau.hidden = true;
    zoneSousBarre.appendChild(panneau);
    bouton.setAttribute("aria-expanded", "false");

    function fermer() {
        panneau.hidden = true;
        bouton.setAttribute("aria-expanded", "false");
    }
    function fermerEtRevenir() {
        fermer();
        bouton.focus();
    }

    L.DomEvent.on(bouton, "click", function () {
        if (!panneau.hidden) {
            fermer();
            return;
        }
        if (avantOuverture) {
            avantOuverture();
        }
        panneau.hidden = false;
        bouton.setAttribute("aria-expanded", "true");
        afficherSousBarre(panneau);
    });
    const croix = panneau.querySelector(".bouton-fermer-panneau");
    if (croix) {
        L.DomEvent.on(croix, "click", fermerEtRevenir);
    }
    L.DomEvent.on(panneau, "keydown", function (evenement) {
        if (evenement.key === "Escape") {
            fermerEtRevenir();
        }
    });
    carte.on("click", fermer);
}

// Recherche d'adresses (OpenStreetMap / Nominatim).
if (window.GeoSearch) {
    const controleRecherche = new window.GeoSearch.GeoSearchControl({
        provider: new window.GeoSearch.OpenStreetMapProvider({
            params: {
                countrycodes: "fr",
                "accept-language": "fr",
                addressdetails: 1,
                limit: 5,
            },
        }),
        style: "button",
        position: "topright",
        searchLabel: "Rechercher une adresse",
        notFoundMessage: "Aucune adresse n'a été trouvée.",
        showMarker: true,
        showPopup: true,
        retainZoom: false,
        animateZoom: true,
        autoClose: true,
        keepResult: true,
        updateMap: true,
    }).addTo(carte);

    // Le formulaire du module est déplacé dans la pile, dans une enveloppe
    // qui reprend les classes du contrôle (styles du module) et recopie son
    // état ouvert ou fermé.
    const conteneurRecherche = controleRecherche.getContainer();
    const formulaireRecherche = conteneurRecherche.querySelector("form");
    if (formulaireRecherche) {
        const enveloppe = L.DomUtil.create(
            "div",
            "leaflet-control-geosearch leaflet-geosearch-button enveloppe-recherche",
            zoneSousBarre
        );
        enveloppe.hidden = true;
        enveloppe.appendChild(formulaireRecherche);

        new MutationObserver(function () {
            const ouvert = conteneurRecherche.classList.contains("active");
            enveloppe.classList.toggle("active", ouvert);
            if (ouvert && enveloppe.hidden) {
                enveloppe.hidden = false;
                afficherSousBarre(enveloppe);
            } else if (!ouvert) {
                enveloppe.hidden = true;
            }
        }).observe(conteneurRecherche, {
            attributes: true,
            attributeFilter: ["class"],
        });
    }
}

// Localisation de l'utilisateur et plein écran.
const controleNavigation = L.control({ position: "topright" });
controleNavigation.onAdd = function () {
    const conteneur = L.DomUtil.create("div", "controle-navigation-carte");
    const boutonLocalisation = creerBoutonBarre(
        conteneur,
        "bouton-localisation",
        "localisation",
        "Me localiser"
    );
    const boutonPleinEcran = creerBoutonBarre(
        conteneur,
        "bouton-plein-ecran",
        "pleinEcran",
        "Afficher la carte en plein écran"
    );
    let marqueurPosition = null;
    let cerclePrecision = null;
    let messageLocalisation = "";

    function finirLocalisation() {
        boutonLocalisation.setAttribute("aria-pressed", "false");
        boutonLocalisation.disabled = false;
    }

    function signalerLocalisation(texte) {
        messageLocalisation = texte;
        afficherMessage(texte, true);
    }

    function afficherPosition(position) {
        const point = [position.coords.latitude, position.coords.longitude];
        const precision = position.coords.accuracy;
        if (marqueurPosition) {
            marqueurPosition.setLatLng(point);
            cerclePrecision.setLatLng(point).setRadius(precision);
        } else {
            marqueurPosition = L.circleMarker(point, {
                radius: 7,
                color: "#ffffff",
                weight: 2,
                fillColor: "#247ba0",
                fillOpacity: 1,
            }).addTo(carte);
            cerclePrecision = L.circle(point, {
                radius: precision,
                color: "#247ba0",
                weight: 1,
                opacity: 0.6,
                fillOpacity: 0.12,
            }).addTo(carte);
        }
        carte.setView(point, Math.max(carte.getZoom(), 16), { animate: true });
        finirLocalisation();
        if (messageLocalisation) {
            masquerMessage(messageLocalisation);
            messageLocalisation = "";
        }
    }

    function signalerEchecLocalisation(erreur) {
        const raisons = {
            1: "L'accès à votre position a été refusé.",
            2: "Votre position n'a pas pu être déterminée.",
            3: "La demande de géolocalisation a expiré.",
        };
        signalerLocalisation(
            raisons[erreur.code] || "La géolocalisation n'est pas disponible."
        );
        finirLocalisation();
    }

    L.DomEvent.on(boutonLocalisation, "click", function () {
        if (!navigator.geolocation) {
            signalerLocalisation(
                "La géolocalisation n'est pas prise en charge par votre navigateur."
            );
            return;
        }
        boutonLocalisation.setAttribute("aria-pressed", "true");
        boutonLocalisation.disabled = true;
        navigator.geolocation.getCurrentPosition(
            afficherPosition,
            signalerEchecLocalisation,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });

    L.DomEvent.on(boutonPleinEcran, "click", function () {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else if (carte.getContainer().requestFullscreen) {
            carte.getContainer().requestFullscreen();
        }
    });
    document.addEventListener("fullscreenchange", function () {
        const actif = Boolean(document.fullscreenElement);
        const etiquette = actif
            ? "Quitter le plein écran"
            : "Afficher la carte en plein écran";
        boutonPleinEcran.innerHTML = iconeBarreOutils(
            actif ? "quitterPleinEcran" : "pleinEcran"
        );
        boutonPleinEcran.setAttribute("aria-pressed", String(actif));
        boutonPleinEcran.setAttribute("aria-label", etiquette);
        boutonPleinEcran.title = etiquette;
        window.setTimeout(function () {
            carte.invalidateSize();
        }, 100);
    });

    L.DomEvent.disableClickPropagation(conteneur);
    L.DomEvent.disableScrollPropagation(conteneur);
    return conteneur;
};
controleNavigation.addTo(carte);
