// LE CALCUL, À PART DE LA PAGE (Web Worker). Le cœur WebAssembly rejoue le script ici : un calcul long ne fige
// jamais la page, et un calcul qui ne rend pas la main (ou un module qui plante) se tue d'un coup — la page en
// relance un neuf (configurateur.js). Messages : { id, quoi: 'variables' | 'rejouer', source, valeurs }
// → { id, resultat } ou { id, erreur }.
'use strict';

importScripts('verdiercam-coeur.js');

let coeur = null;
const enAttente = [];

function traiter(m) {
    try {
        const resultat = m.quoi === 'variables' ? coeur.variables(m.source) : coeur.rejouer(m.source, m.valeurs);
        postMessage({ id: m.id, resultat });
    } catch (e) {
        // Un piège du module (mémoire épuisée, abort) : l'instance n'est plus sûre, la page en relancera une.
        postMessage({ id: m.id, erreur: String((e && e.message) || e), perdu: true });
    }
}

CoeurVerdierCAM().then((m) => {
    coeur = m;
    postMessage({ pret: true });
    enAttente.splice(0).forEach(traiter);
}, (e) => postMessage({ echecChargement: String((e && e.message) || e) }));

onmessage = (e) => {
    if (coeur) traiter(e.data);
    else enAttente.push(e.data);
};
