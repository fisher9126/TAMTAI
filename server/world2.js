'use strict';
/* Aetherfall step 11 (server plugin of zones.js): monsters of the two new regions. Sa Mạc Huyết Thạch (desert, level 20-27) and Vực Thẳm Hư Không
   (abyss, level 28-35) are drawn by public/js/world2.js; their monsters, materials and drops are defined in public/js/rules.js.
   The desert keeps its centre free (the free-PvP ring, see server/pvp.js): monsters stand 14-19 m from the centre. */
const rules = require('../public/js/rules.js');
const W = rules.WORLD;

function layout(spawnAt, ring) {
  ring(W.DESERT, 9, 14, 19, 'scorpio');
  ring(W.DESERT, 7, 14, 19, 'mummia');
  spawnAt('sethra', W.DESERT.x - 14, W.DESERT.z + 14); // the pharaoh waits on the village side of the desert
  ring(W.ABYSS, 8, 4, 15, 'demone');
  ring(W.ABYSS, 6, 5, 15, 'drago');
  spawnAt('vuoto', W.ABYSS.x, W.ABYSS.z);
}

module.exports = { layout };
