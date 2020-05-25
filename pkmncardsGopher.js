
const chain     = require("./chain").chain;
const cheerio   = require('cheerio');
const downloads = require('./downloads');
const fs        = require('fs');
const process   = require('process');
const request   = require('request');


const downloadFile = downloads.downloadFile;
const downloadTask = downloads.downloadTask;



function chainFetchSetPage( data, next ) {

    let DEBUG = false;

    let req = {
        method: "get",
        url: "https://pkmncards.com/?s=set%3A"+data.setName,
        timeout: 7500,
        // headers: {
        //     token: this._token,
        //     fwrev: this._fwrev
        // }
    };

    if(DEBUG) console.log("DEBUG: HTTP request",req.method,req.url);

    request( req, (error, response, body) => {
        if(DEBUG) console.log("   error",error);
        if(DEBUG) console.log("   response",error);
        if(DEBUG) console.log("   body",body);
        if(error) {
            next(error);
        }
        else if( response && Math.floor(response.statusCode/100) !== 2) {
            next(response);
        }
        else {
            data.html = body;
            next(null,data);
        }
    });

}

let CARDNUM_OVERFLOW = 12345;

function chainParseSetPageHTML( data, next ) {

    let $ = cheerio.load(data.html);

    console.log( "chainParseSetPageHTML: "+data.seriesName+", "+data.setName );

    function cheerioElementzToText( elementz ) {
        let text; // undefined
        if( elementz.length === 1 ) {
            text = elementz.text();
        }
        if( elementz.length > 1 ) {
            let items = [];
            elementz.each( (i, elem) => {
                items.push( $(elem).text() );
            });
            text = items.join('/');
        }
        return( text );
    }

    let downloadList = [ ];
    $("div.entry-content").each( (index,entryContent)=>{
        let cardData = { };
        cardData.title    = cheerioElementzToText($(entryContent).find("a.card-title-link"));
        cardData.name     = cheerioElementzToText($(entryContent).find("a.name"));
        cardData.type     = cheerioElementzToText($(entryContent).find("a.type")) || "Pokémon";
        cardData.color    = cheerioElementzToText($(entryContent).find("a.color"));
        cardData.stage    = cheerioElementzToText($(entryContent).find("a.stage"));
        cardData.series   = data.seriesName;
        cardData.set      = cheerioElementzToText($(entryContent).find("a.set"));
        cardData.number   = cheerioElementzToText($(entryContent).find("a.number"));
        cardData.rarity   = cheerioElementzToText($(entryContent).find("a.rarity"));
        cardData.midPrice = cheerioElementzToText($(entryContent).find("a[title='Mid Price']"));
        cardData.imgSrc   = $(entryContent).find("a.card-image-link")
                                            .find("img.wp-post-image")
                                            .attr("src");
        if( !cardData.number ) {
            if( cardData.type === "Energy/Basic Energy" ) {
                cardData.number = cardData.name.replace(/ /g,'');
            }
            else {
                console.log("NO CARD NUMBER:");
                console.log(JSON.stringify(cardData,null,4));
                cardData.number = ++CARDNUM_OVERFLOW;
            }
        }

        let cardDirName = cardData.number;
        while( cardDirName.length < 3 ) {
            cardDirName = "0" + cardDirName;
        }
        let cardPath = "./card-images/"+data.seriesName+"/"+data.setName+"/"+cardDirName+"/";
        fs.mkdir( cardPath, { recursive: true }, () => {
            fs.writeFile(cardPath+"pkmncards.json",JSON.stringify(cardData,null,4),()=>{});
        });

        if( typeof(cardData.imgSrc) !== "string" ) {
            console.log("NO CARD IMAGE:");
            console.log(JSON.stringify(cardData,null,4));
        }
        else {
            // first remove any URL query parameters
            let urlOfFile = cardData.imgSrc.split('?').shift();
            // next get the file extension *with* the period
            let extension = urlOfFile.substr((urlOfFile.lastIndexOf('.')));
            downloadList.push({uri:cardData.imgSrc,filename:cardPath+"pkmncards"+extension});
        }
    });

    const numTasks = 2;
    let completed  = 0;
    const options  = { verbose: true, loopDelay: 50 };
    for( let t=0; t<numTasks; ++t ) {
        setTimeout( () => { downloadTask( downloadList, onComplete, options ); }, 25*t );
    }

    function onComplete() {
        if( ++completed == numTasks ) {
            next(null,data);
        }
    }

}

function fetchCardSet( index, seriesSetList, done ) {
    chain(seriesSetList[index])
        .chain(chainFetchSetPage)
        .chain(chainParseSetPageHTML)
        .coda( err => {
            if(err) {
                let item = { seriesName: seriesSetList[index].seriesName, setName: seriesSetList[index].setName };

                console.log("ERROR: failure fetching",seriesSetList[index]);
                console.log("error info:",err);
            }
            if( ++index === seriesSetList.length ) {
                console.log("done");
                done();
            }
            else {
                setTimeout( () => { fetchCardSet( index, seriesSetList, done ); } )
            }
        });
}

function pkmncardsGopher( seriesData, seriesSetList, done ) {
    console.log("_____________________________");
    console.log("function pkmncardsGopher");
    fetchCardSet( 0, seriesSetList, done );
}

// the export function
exports.autoRegister = function autoRegister( herder ) {
    console.log("pkmncardsRegister = function autoRegister");
    herder.register( pkmncardsGopher );
}
