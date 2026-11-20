"use strict";

// Panneau des couches : fond de plan, couches thématiques, curseurs
// d'opacité, et mémorisation de ces choix dans le navigateur.

// Changer le numéro de version de la clé efface les choix enregistrés :
// tout le monde repart des couches par défaut ci-dessous.
const CLE_PREFERENCES_COUCHES = "coolapic.couches.v2";
const PREFIXE_MESSAGE_PREFERENCES = "Les préférences de couches";

// Couches affichées tant qu'aucun choix n'est enregistré dans le navigateur.
const COUCHES_PAR_DEFAUT = {
    fond: "plan-ign",
    couches: ["meteo-vent-vagues", "isobathes-donia", "sites-plongee"],
};

function definirGroupesCouches() {
    return [
        {
            titre: "Fond de plan",
            type: "radio",
            couches: [
                {
                    id: "carte-littorale",
                    nom: "Carte littorale (IGN / Shom)",
                    couche: fondCartesLittorales,
                },
                { id: "plan-ign", nom: "Plan IGN", couche: fondPlanIGNV2 },
                {
                    id: "photographies-aeriennes",
                    nom: "Photographies aériennes (IGN)",
                    couche: fondOrthophotographieHR,
                },
                {
                    id: "openstreetmap",
                    nom: "Plan OpenStreetMap",
                    couche: fondOpenStreetMap,
                },
            ],
        },
        {
            titre: "Météo",
            type: "checkbox",
            couches: [
                {
                    id: "meteo-vent-vagues",
                    nom: "Vent et vagues, prévisions 48 h (Météo-France)",
                    couche: coucheVent,
                },
                {
                    id: "meteo-temperature-eau",
                    nom: "Température de l'eau en surface, prévisions 48 h (Météo-France)",
                    couche: coucheTemperatureEau,
                },
            ],
        },
        {
            titre: "Bathymétrie",
            type: "checkbox",
            couches: [
                {
                    id: "isobathes-donia",
                    nom: "Isobathes (MEDTRIX, DONIA)",
                    couche: coucheIsobathesDonia,
                },
                {
                    id: "isobathes-gebco",
                    nom: "Isobathes (GEBCO)",
                    couche: coucheIsobathesGebco,
                    opacite: {
                        defaut: 0.8,
                        appliquer: function (valeur) {
                            coucheIsobathesGebco.setOpacity(valeur);
                        },
                    },
                },
            ],
        },
        {
            titre: "Biodiversité",
            type: "checkbox",
            couches: [
                {
                    id: "habitats-calanques-port-cros",
                    nom: "Habitats marins (OFB), Calanques et Rade d'Hyères (Port-Cros)",
                    couche: coucheZonesOFB,
                    // Opacité du pane entier : pas de cumul de transparence
                    // là où des polygones se chevauchent.
                    opacite: {
                        defaut: 0.9,
                        appliquer: function (valeur) {
                            carte.getPane("habitatsOFB").style.opacity =
                                String(valeur);
                        },
                    },
                },
                {
                    id: "observations-golfe-du-lion",
                    nom: "Observations faune/flore (OFB), Golfe du Lion",
                    couche: coucheObservationsGolfeDuLion,
                },
            ],
        },
        {
            titre: "Sites",
            type: "checkbox",
            couches: [
                {
                    id: "sites-plongee",
                    nom: "Sites de plongée",
                    couche: coucheSitesPlongee,
                },
            ],
        },
    ];
}

function signalerErreurPreferences(operation, erreur) {
    console.error("Préférences de couches (" + operation + ") :", erreur);
    afficherMessage(
        PREFIXE_MESSAGE_PREFERENCES +
            " n'ont pas pu être " +
            (operation === "lecture" ? "restaurées." : "enregistrées."),
        true
    );
}

function lirePreferencesCouches() {
    let preferences;
    try {
        const contenu = window.localStorage.getItem(CLE_PREFERENCES_COUCHES);
        if (contenu === null) {
            return null;
        }
        preferences = JSON.parse(contenu);
    } catch (erreur) {
        signalerErreurPreferences("lecture", erreur);
        return null;
    }
    if (
        !preferences ||
        typeof preferences.fond !== "string" ||
        !Array.isArray(preferences.couches)
    ) {
        signalerErreurPreferences(
            "lecture",
            new Error("Format des préférences invalide.")
        );
        return null;
    }
    return preferences;
}

function afficherCouche(couche, visible) {
    if (visible && !carte.hasLayer(couche)) {
        carte.addLayer(couche);
    } else if (!visible && carte.hasLayer(couche)) {
        carte.removeLayer(couche);
    }
}

function creerControleCouches() {
    const groupes = definirGroupesCouches();
    const fonds = groupes[0].couches;
    const superposables = groupes.slice(1).flatMap(function (groupe) {
        return groupe.couches;
    });
    const reglables = superposables.filter(function (definition) {
        return Boolean(definition.opacite);
    });
    // Opacité courante (0 à 1) des couches réglables, par identifiant.
    const opacites = {};
    reglables.forEach(function (definition) {
        opacites[definition.id] = definition.opacite.defaut;
        definition.opacite.appliquer(definition.opacite.defaut);
    });

    function sauvegarderPreferences() {
        const fondActif = fonds.find(function (definition) {
            return carte.hasLayer(definition.couche);
        });
        // Pendant un changement de fond, l'ancien est retiré après l'ajout
        // du nouveau : il y a toujours un fond, sauf erreur.
        if (!fondActif) {
            return;
        }
        const preferences = {
            fond: fondActif.id,
            couches: superposables
                .filter(function (definition) {
                    return carte.hasLayer(definition.couche);
                })
                .map(function (definition) {
                    return definition.id;
                }),
            opacites: opacites,
        };
        try {
            window.localStorage.setItem(
                CLE_PREFERENCES_COUCHES,
                JSON.stringify(preferences)
            );
        } catch (erreur) {
            signalerErreurPreferences("sauvegarde", erreur);
            return;
        }
        masquerMessage(PREFIXE_MESSAGE_PREFERENCES);
    }

    function restaurerPreferences() {
        const preferences = lirePreferencesCouches() || COUCHES_PAR_DEFAUT;
        const fondChoisi = fonds.find(function (definition) {
            return definition.id === preferences.fond;
        });
        if (fondChoisi) {
            afficherCouche(fondChoisi.couche, true);
            fonds.forEach(function (definition) {
                if (definition !== fondChoisi) {
                    afficherCouche(definition.couche, false);
                }
            });
        }
        // Les identifiants de couches retirées depuis sont ignorés.
        const actives = new Set(preferences.couches);
        superposables.forEach(function (definition) {
            afficherCouche(definition.couche, actives.has(definition.id));
        });
        // Champ absent des préférences enregistrées avant les curseurs.
        const opacitesEnregistrees = preferences.opacites || {};
        reglables.forEach(function (definition) {
            const valeur = Number(opacitesEnregistrees[definition.id]);
            if (Number.isFinite(valeur) && valeur >= 0 && valeur <= 1) {
                opacites[definition.id] = valeur;
                definition.opacite.appliquer(valeur);
            }
        });
    }

    // Curseur d'opacité affiché sous la case d'une couche réglable.
    function creerReglageOpacite(definition, parent) {
        const reglage = L.DomUtil.create("div", "reglage-opacite", parent);
        const idCurseur = "opacite-" + definition.id;
        const etiquette = L.DomUtil.create("label", "", reglage);
        etiquette.htmlFor = idCurseur;
        etiquette.textContent = "Opacité";
        const curseur = L.DomUtil.create("input", "", reglage);
        curseur.type = "range";
        curseur.id = idCurseur;
        curseur.min = "0";
        curseur.max = "100";
        curseur.step = "5";
        curseur.value = String(Math.round(opacites[definition.id] * 100));
        curseur.setAttribute("aria-label", "Opacité de la couche " + definition.nom);
        const valeurAffichee = L.DomUtil.create("output", "", reglage);
        valeurAffichee.htmlFor = idCurseur;
        valeurAffichee.textContent = curseur.value + " %";

        L.DomEvent.on(curseur, "input", function () {
            const valeur = Number(curseur.value) / 100;
            opacites[definition.id] = valeur;
            definition.opacite.appliquer(valeur);
            valeurAffichee.textContent = curseur.value + " %";
        });
        // Une seule sauvegarde, quand le curseur est relâché.
        L.DomEvent.on(curseur, "change", sauvegarderPreferences);
        return reglage;
    }

    // Une ligne (case + nom, et curseur éventuel) par couche. La case suit la
    // couche : elle se met à jour quelle que soit l'origine du changement
    // (case, clic dans l'annuaire des sites…).
    function creerLigneCouche(groupe, definition, section) {
        const ligne = L.DomUtil.create("label", "option-couche", section);
        const caseCouche = L.DomUtil.create("input", "", ligne);
        caseCouche.type = groupe.type;
        if (groupe.type === "radio") {
            caseCouche.name = "fond-carte-coolapic";
        }
        L.DomUtil.create("span", "", ligne).textContent = definition.nom;
        const reglage = definition.opacite
            ? creerReglageOpacite(definition, section)
            : null;

        function suivreCouche() {
            const visible = carte.hasLayer(definition.couche);
            caseCouche.checked = visible;
            if (reglage) {
                reglage.hidden = !visible;
            }
        }
        suivreCouche();
        definition.couche.on("add remove", function () {
            suivreCouche();
            sauvegarderPreferences();
        });

        L.DomEvent.on(caseCouche, "change", function () {
            if (groupe.type !== "radio") {
                afficherCouche(definition.couche, caseCouche.checked);
                return;
            }
            // Le nouveau fond d'abord, puis le retrait des autres.
            afficherCouche(definition.couche, true);
            groupe.couches.forEach(function (autre) {
                if (autre !== definition) {
                    afficherCouche(autre.couche, false);
                }
            });
        });
    }

    const controle = L.control({ position: "topright" });
    controle.onAdd = function () {
        const conteneur = L.DomUtil.create("div", "controle-couches-thematiques");
        const bouton = creerBoutonBarre(
            conteneur,
            "bouton-couches",
            "couches",
            "Fond de plan et couches thématiques"
        );
        const panneau = L.DomUtil.create("div", "contenu-couches-thematiques");
        creerBoutonFermer(panneau, "Fermer les couches");
        const liste = L.DomUtil.create("div", "liste-groupes-couches", panneau);

        restaurerPreferences();
        groupes.forEach(function (groupe) {
            const section = L.DomUtil.create("section", "groupe-couches", liste);
            L.DomUtil.create("h3", "titre-groupe-couches", section).textContent =
                groupe.titre;
            groupe.couches.forEach(function (definition) {
                creerLigneCouche(groupe, definition, section);
            });
        });

        relierPanneauSousBarre(bouton, panneau);
        L.DomEvent.disableClickPropagation(conteneur);
        return conteneur;
    };
    return controle;
}
