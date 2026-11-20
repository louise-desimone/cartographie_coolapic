"use strict";

// Démarrage : panneau des couches (qui restaure les choix enregistrés), puis
// chargement des sites de plongée et cadrage de la carte sur ces sites.

creerControleCouches().addTo(carte);

lireGeoJSON("geojson/sites_de_plongee.geojson")
    .then(function (collection) {
        chargerSitesPlongee(collection);
        cadrerSurSites();
        masquerMessage("Chargement de la carte");
    })
    .catch(afficherErreur);
