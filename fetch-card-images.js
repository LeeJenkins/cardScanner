
const chain     = require("./chain").chain;
const cheerio   = require('cheerio');
const fs        = require('fs');
const process   = require('process');
const request   = require('request');

/*
** image data sources:
**
   https://pkmncards.com/                                                          (PRIMARY SOURCE -- ALL CARDS, HIGH RES)
   https://www.fullgripgames.com/catalog/pokemon_singles/226                       (ALL CARDS, MED RES, HOLO, NAV R&D)
        NOTE: scroll down to see the set links; 504x700 images available
   https://www.pokellector.com/sets                                                (ALL CARDS, HIGH RES / MIXED QUALITY, NAV R&D)
   https://cardmavin.com/category/pokemon/sword-shield                             (MOST CARDS, HOLO, NAV R&D)
       NOTES: literal gold mine of photos by sellers
              see menu on right: POKEMON CARD SETS
   https://www.tcgcollector.com/cards                                              (ALL CARDS, EZ NAV, MED RES)
   https://serebii.net/card/english.shtml                                          (ALL CARDS, HIGH RES, EZ NAV)
   https://www.chaoscards.co.uk/pokemon-c11/singles-pokemon-c552                   (HIGH RES, NAV R&D)
   https://www.renecards.nl/c-2553575/pokemon/                                     (ALL CARDS, MED RES, NAV R&D)
   https://collectorscache.crystalcommerce.com/catalog/hidden_fates/226            (MANY CARDS, LOW RES, NAV R&D, HOLO)
        SEE ALSO: https://www.collectorscache.com/catalog/hidden_fates/226
   https://toywiz.com/pokemon/single-cards/                                        (HIGH RES, NAV R&D)
      + https://cdn11.bigcommerce.com/s-0kvv9/images/stencil/1280x1280/products/316427/453203/pokemonhiddenfates9__72361.1576031644.jpg
   https://bulbapedia.bulbagarden.net/wiki/Category:Pok%C3%A9mon_cards_by_name     (MANY CARDS, NAV R&Dx4, MIXED RES, ENG/JAP, HOLO)
   https://www.trollandtoad.com/pokemon/xy-ancient-origins-singles/9758            (ALL CARDS? NAV R&D)
   https://pokemoncards.com.au/pokemon-singles/                                    (SOME CARDS, NAV R&D)
   https://www.pokegoldfish.com/prices/paper/expanded  <--\__________________/-->  (SAME SITE, TWO URLS, SEE NEXT LINE...)
   https://www.pokegoldfish.com/prices/paper/standard  <--/                  \-->  (MANY CARDS, EASY NAV, LOW RES, VERY-OLD-CARDS-404)
   https://overthetoptcg.com/collections/singles                                   (SOME CARDS, NAV R&Dx4, HIGH-RES, HOLO)
   http://pokemoncardvalue.com/browse-all-pokemon-card-sets                        (ALL CARDS, LOW RES, NAV R&D)
   https://www.coleka.com/en/trading-cards/pokemon-cards_r9378                     (MANY CARDS, MIXED RES, NAV R&D, HOLO)
   http://archerongames.com/pokemon/                                               (MANY CARDS, HIGH RES, NAV R&Dx3, HOLO, OC/CROP)
   https://unicorncards.co.uk/pokemon-single-cards                                 (SOME CARDS, NAV R&D, HOLO)
        NOTE: image URLS from main page look like this:
                https://unicorncards.co.uk/images/thumbs/0027461_cinderace-v-swsh015-black-star-promo-holo-mint-pokemon-card_415.jpeg
            notice a resolution value appears at the end of the name; the value can be removed  ----------------------------^^^^ see below:
                https://unicorncards.co.uk/images/thumbs/0027461_cinderace-v-swsh015-black-star-promo-holo-mint-pokemon-card.jpeg
   https://www.cardcaverntradingcards.com/collections/all/card-type_pokemon+set_burning-shadows      (SOME CARDS, NAV R&D, HOLO)
        NOTE: images served from https://cdn.shopify.com with a URL like this:
                https://cdn.shopify.com/s/files/1/1715/6019/products/FCO0464_500x.jpg
            the resolution can be specified here ----------------------------^^^
            the number is the width of the image; 900 is more than sufficient
   https://colnect.com/en/trading_card_games/sets/game/22280-Pok%C3%A9mon_TCG/language/0-English     (SOME CARDS, LOW-RES, NAV R&Dx2)
**

** DO NOT USE:
** http://pokemonprices.com/      many images are mislabeled
*/


/* the seriesData was pulled from https://pkmncards.com/ */
seriesData = {
    "SwordShieldSeries": [ "rebel-clash", "sword-shield", "sword-shield-energy", "sword-shield-promos" ],
    "SunMoonSeries": [ "cosmic-eclipse", "mcdonalds-collection-2019", "hidden-fates", "unified-minds", "unbroken-bonds", "detective-pikachu", "team-up",
                       "lost-thunder", "dragon-majesty", "celestial-storm", "forbidden-light", "ultra-prism", "crimson-invasion", "shining-legends",
                       "burning-shadows", "guardians-rising", "sun-moon-trainer-kit-lycanroc", "sun-moon-trainer-kit-alolan-raichu", "sun-moon",
                       "sun-moon-energy", "sun-moon-energy-team-up", "sun-moon-promos" ],
    "XYSeries": [ "evolutions", "mcdonalds-collection-2016", "steam-siege", "fates-collide", "xy-trainer-kit-suicune", "xy-trainer-kit-pikachu-libre", "generations", "breakpoint", "breakthrough", "ancient-origins", "roaring-skies", "xy-trainer-kit-latios", "xy-trainer-kit-latias", "double-crisis", "primal-clash", "phantom-forces", "furious-fists", "flashfire", "xy-trainer-kit-sylveon", "xy-trainer-kit-noivern", "xy", "kalos-starter-set", "xy-promos" ],
    "BlackWhiteSeries": [ "legendary-treasures", "plasma-blast", "plasma-freeze", "plasma-storm", "boundaries-crossed", "dragon-vault", "dragons-exalted", "mcdonalds-collection-2012", "dark-explorers", "next-destinies", "noble-victories", "black-white-trainer-kit-zoroark", "black-white-trainer-kit-excadrill", "emerging-powers", "mcdonalds-collection-2011", "black-white", "black-white-promos" ],
    "HeartGoldSoulSilverSeries": [ "call-of-legends", "triumphant", "undaunted", "unleashed", "hs-trainer-kit-raichu", "hs-trainer-kit-gyarados", "heartgold-soulsilver", "heartgold-soulsilver-promos" ],
    "PlatinumSeries": [ "rumble", "arceus", "supreme-victors", "rising-rivals", "pop-series-9", "platinum" ],
    "DiamondPearlSeries": [ "stormfront", "pop-series-8", "legends-awakened", "majestic-dawn", "pop-series-7", "great-encounters", "secret-wonders", "diamond-pearl-trainer-kit-manaphy", "diamond-pearl-trainer-kit-lucario", "pop-series-6", "mysterious-treasures", "diamond-pearl", "diamond-pearl-promos" ],
    "EXSeries": [ "pop-series-5", "power-keepers", "dragon-frontiers", "crystal-guardians", "pop-series-4", "holon-phantoms", "pop-series-3", "ex-trainer-kit-plusle", "ex-trainer-kit-minun", "legend-maker", "delta-species", "unseen-forces", "pop-series-2", "emerald", "deoxys", "team-rocket-returns", "pop-series-1", "firered-leafgreen", "hidden-legends", "ex-trainer-kit-latios", "ex-trainer-kit-latias", "team-magma-vs-team-aqua", "dragon", "sandstorm", "ruby-sapphire", "nintendo-black-star-promos" ],
    "E-CardSeries": [ "skyridge", "aquapolis", "expedition" ],
    "NeoSeries": [ "neo-destiny", "neo-revelation", "neo-discovery", "neo-genesis" ],
    "GymSeries": [ "gym-challenge", "gym-heroes" ],
    "ClassicSeries": [ "team-rocket", "base-set-2", "fossil", "jungle", "base-set" ],
    "PromosSeries": [ "wizards-black-star-promos" ],
    "OtherSeries": [ "world-collection", "box-topper", "legendary-collection", "southern-islands", "best-of-game", "victory-medals" ],
};

class GopherHerder {
    constructor() {
        this.gopherList = [ ];
    }
    register( gopher ) {
        this.gopherList.push(gopher);
    }
    crawlSync( seriesData, seriesSetList ) {
        this.gopherList.forEach( gopher => {
            gopher( seriesData, seriesSetList )
        });
    }
}

function makeDirs( data ) {
    let dirLevel1 = "./card-images/" + data.seriesName;
    fs.mkdirSync( dirLevel1, { recursive: true } );
    let dirLevel2 = dirLevel1 + "/" + data.setName;
    fs.mkdirSync( dirLevel2, { recursive: true } );
}


function main() {

    let seriesSetList = [ ];
    for( let series in seriesData ) {
        // console.log("series",series);
        seriesData[series].forEach( set => {
            // console.log("    set",set);
            let data = { seriesName: series, setName: set };
            seriesSetList.push(data);
            makeDirs(data);
        });
    }

    let gopherHerder = new GopherHerder();
    // TODO: here we should use the fs to require ./*Gopher.js
    let moduleNames = [
        // "pkmncardsGopher",
        "cardmavinGopher"
    ];
    moduleNames.forEach( (moduleName) => {
        let moduleObject = require("./"+moduleName);
        moduleObject.autoRegister( gopherHerder );
    });

    // let's do this
    gopherHerder.crawlSync( seriesData, seriesSetList );
}

main();
