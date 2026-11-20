"use strict";

// Sites de plongée : marqueurs, fiches et annuaire avec recherche.

// featureGroup (et non layerGroup) : il sait calculer l'emprise des sites.
const coucheSitesPlongee = L.featureGroup().addTo(carte);
const listeGeosignets = document.getElementById("liste-sites-annuaire");
const champRechercheSites = document.getElementById("recherche-sites");
const comparateurSites = new Intl.Collator("fr", {
    sensitivity: "base",
    numeric: true,
});
const iconeSitePlongee = L.divIcon({
    className: "icone-site-plongee",
    html: '<span><img src="png/coolapic.png?v=20261119" alt=""></span>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -23],
});
// Sites triés par ville puis par nom, chacun avec son marqueur.
let sitesPlongee = [];

function normaliserTexteRecherche(texte) {
    return sansAccents(texte)
        .replace(/œ/g, "oe")
        .replace(/æ/g, "ae")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function siteEstValide(entite) {
    const proprietes = entite && entite.properties;
    const geometrie = entite && entite.geometry;
    const coordonnees = geometrie && geometrie.coordinates;
    return Boolean(
        entite &&
            entite.type === "Feature" &&
            proprietes &&
            typeof proprietes.nom === "string" &&
            proprietes.nom.trim() &&
            typeof proprietes.ville === "string" &&
            typeof proprietes.commentaire === "string" &&
            // Photo facultative : chemin d'une image du site.
            (proprietes.photo === undefined ||
                typeof proprietes.photo === "string") &&
            // Profondeur facultative, écrite par outils/profondeur_sites.py.
            (proprietes.profondeur === undefined ||
                Number.isFinite(
                    proprietes.profondeur && proprietes.profondeur.point_m
                )) &&
            geometrie &&
            geometrie.type === "Point" &&
            Array.isArray(coordonnees) &&
            Number.isFinite(coordonnees[0]) &&
            Number.isFinite(coordonnees[1]) &&
            Math.abs(coordonnees[0]) <= 180 &&
            Math.abs(coordonnees[1]) <= 90
    );
}

function validerCollectionSites(collection) {
    if (
        !collection ||
        collection.type !== "FeatureCollection" ||
        !Array.isArray(collection.features)
    ) {
        throw new Error("Le GeoJSON des sites n'est pas une FeatureCollection.");
    }
    if (!collection.features.every(siteEstValide)) {
        throw new Error("Une fiche de site du GeoJSON est invalide.");
    }
}

function metres(valeur) {
    return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " m";
}

// Profondeur calculée par outils/profondeur_sites.py (Litto3D ou HOMONIM).
function ajouterProfondeur(contenu, profondeur) {
    let texte = "Profondeur : " + metres(profondeur.point_m) + " au point";
    if (Number.isFinite(profondeur.min_m) && Number.isFinite(profondeur.max_m)) {
        texte +=
            ", de " + metres(profondeur.min_m) + " à " + metres(profondeur.max_m) +
            " dans un rayon de " + profondeur.rayon_m + " m";
    }
    L.DomUtil.create("p", "", contenu).textContent = texte;
    L.DomUtil.create("p", "source-profondeur", contenu).textContent =
        "Source : " + profondeur.source + ", référence " + profondeur.reference +
        ". Valeurs indicatives.";
}

function creerPopupSite(proprietes) {
    const contenu = L.DomUtil.create("div", "popup-site-plongee");
    L.DomUtil.create("strong", "", contenu).textContent = proprietes.nom;
    L.DomUtil.create("p", "", contenu).textContent =
        "Ville : " + (proprietes.ville || "À préciser");
    if (proprietes.profondeur) {
        ajouterProfondeur(contenu, proprietes.profondeur);
    }
    if (proprietes.commentaire) {
        L.DomUtil.create("p", "", contenu).textContent =
            "Commentaire : " + proprietes.commentaire;
    }
    if (proprietes.photo) {
        // Un clic ouvre la photo en grand dans un nouvel onglet.
        const lien = L.DomUtil.create("a", "lien-photo-site", contenu);
        lien.href = proprietes.photo;
        lien.target = "_blank";
        lien.rel = "noopener";
        lien.title = "Agrandir la photo";
        const image = L.DomUtil.create("img", "photo-site-plongee", lien);
        image.src = proprietes.photo;
        image.alt = "Photo du site " + proprietes.nom;
        // Proportions connues d'avance (4:3) : la fiche garde sa taille
        // pendant le chargement de l'image et reste bien placée.
        image.width = 240;
        image.height = 180;
    }
    return contenu;
}

// Les sites sans ville passent en fin de liste.
function comparerSites(premier, second) {
    const villeA = premier.proprietes.ville.trim();
    const villeB = second.proprietes.ville.trim();
    if (!villeA !== !villeB) {
        return villeA ? -1 : 1;
    }
    return (
        comparateurSites.compare(villeA, villeB) ||
        comparateurSites.compare(premier.proprietes.nom, second.proprietes.nom)
    );
}

// Centre la carte sur un site, au zoom 17 au moins.
function zoomerSurSite(marqueur) {
    carte.setView(marqueur.getLatLng(), Math.max(carte.getZoom(), 17));
}

// Depuis l'annuaire : affiche la couche si besoin, zoome et ouvre la fiche.
function afficherSite(site) {
    if (!carte.hasLayer(coucheSitesPlongee)) {
        coucheSitesPlongee.addTo(carte);
    }
    zoomerSurSite(site.marqueur);
    site.marqueur.openPopup();
}

function creerGeosignet(site) {
    const { nom, ville } = site.proprietes;
    const bouton = L.DomUtil.create("button", "geosignet-site", listeGeosignets);
    bouton.type = "button";
    bouton.setAttribute(
        "aria-label",
        "Afficher " + nom + ", " + (ville || "ville à préciser") + " sur la carte"
    );
    const infos = L.DomUtil.create("span", "geosignet-infos", bouton);
    L.DomUtil.create("span", "geosignet-nom", infos).textContent = nom;
    L.DomUtil.create("span", "geosignet-ville", infos).textContent =
        ville || "Ville à préciser";
    L.DomEvent.on(bouton, "click", function () {
        afficherSite(site);
    });
}

function actualiserGeosignets() {
    listeGeosignets.replaceChildren();
    const mots = normaliserTexteRecherche(champRechercheSites.value)
        .split(" ")
        .filter(Boolean);
    const sitesTrouves = sitesPlongee.filter(function (site) {
        return mots.every(function (mot) {
            return site.texteRecherche.includes(mot);
        });
    });

    if (sitesTrouves.length === 0) {
        L.DomUtil.create("p", "", listeGeosignets).textContent =
            sitesPlongee.length === 0
                ? "Aucun site dans la couche."
                : "Aucun site ne correspond à la recherche.";
        return;
    }
    sitesTrouves.forEach(creerGeosignet);
}

function chargerSitesPlongee(collection) {
    validerCollectionSites(collection);
    sitesPlongee = collection.features
        .map(function (entite) {
            const [longitude, latitude] = entite.geometry.coordinates;
            const proprietes = entite.properties;
            return {
                proprietes: proprietes,
                texteRecherche: normaliserTexteRecherche(
                    proprietes.nom + " " + proprietes.ville
                ),
                // Un clic sur le marqueur ouvre la fiche et zoome sur le site.
                marqueur: L.marker([latitude, longitude], {
                    icon: iconeSitePlongee,
                    bubblingMouseEvents: false,
                })
                    .bindPopup(creerPopupSite(proprietes))
                    .on("click", function (evenement) {
                        zoomerSurSite(evenement.target);
                    })
                    .addTo(coucheSitesPlongee),
            };
        })
        .sort(comparerSites);
    actualiserGeosignets();
}

// Cadre la carte sur l'ensemble des sites de plongée.
function cadrerSurSites() {
    const emprise = coucheSitesPlongee.getBounds();
    if (emprise.isValid()) {
        carte.fitBounds(emprise, { padding: [40, 40], maxZoom: 15 });
    }
}

champRechercheSites.addEventListener("input", actualiserGeosignets);
