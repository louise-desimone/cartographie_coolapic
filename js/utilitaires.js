"use strict";

// Fonctions communes à tous les modules.

const message = document.getElementById("message-carte");

// Affiche un message en bas à gauche de la carte.
function afficherMessage(texte, estErreur) {
    message.textContent = texte;
    message.classList.toggle("erreur", Boolean(estErreur));
    message.hidden = false;
}

// Masque le message, seulement s'il commence par ce préfixe : un module ne
// masque ainsi que ses propres messages.
function masquerMessage(prefixe) {
    if (message.textContent.trim().indexOf(prefixe) === 0) {
        message.hidden = true;
        message.classList.remove("erreur");
    }
}

function afficherErreur(erreur) {
    console.error("Erreur pendant le chargement de la carte :", erreur);
    afficherMessage(
        "La carte n'a pas pu charger ses données. Vérifiez que le dossier " +
            "« geojson » contient les fichiers attendus.",
        true
    );
}

// Lit un fichier GeoJSON du site. « no-cache » le fait revalider à chaque
// chargement : un site ajouté apparaît sans servir une ancienne copie.
async function lireGeoJSON(nomFichier) {
    const reponse = await fetch(nomFichier, { cache: "no-cache" });
    if (!reponse.ok) {
        throw new Error("Fichier inaccessible : " + nomFichier);
    }
    return reponse.json();
}

// Empêche qu'un texte issu des données soit interprété comme du HTML.
function protegerTexte(texte) {
    const caracteres = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return String(texte).replace(/[&<>"']/g, function (caractere) {
        return caracteres[caractere];
    });
}

// Minuscules sans accents, pour comparer des textes.
function sansAccents(texte) {
    return String(texte || "")
        .toLocaleLowerCase("fr")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}
