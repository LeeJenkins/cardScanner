
const chain     = require("./chain").chain;
const cheerio   = require('cheerio');
const dirRemap  = require('./directoryRemap');
const downloads = require('./downloads');
const fs        = require('fs');
const process   = require('process');
const request   = require('request');


const downloadFile = downloads.downloadFile;
const downloadTask = downloads.downloadTask;

const hrefmap = require('./cardmavin_hrefmap.json');

/*
*/

function fetchPage( url, done ) {

    let DEBUG = false;

    let req = {
        method: "get",
        url: url,
        timeout: 7500,
    };

    if(DEBUG) console.log("DEBUG: HTTP request",req.method,req.url);

    request( req, (error, response, body) => {
        if(DEBUG) console.log("   error",error);
        if(DEBUG) console.log("   response",error);
        if(DEBUG) console.log("   body",body);
        if(error) {
            done(error);
        }
        else if( response && Math.floor(response.statusCode/100) !== 2) {
            done(response);
        }
        else {
            done(null,body);
        }
    });

}


function chainFetchSetPage( data, next ) {

console.log("fetch page",data.href);

    fetchPage( data.href, function onComplete(err,html) {
        data.html = html;
        next(err,data);
    });
}



// let CARDNUM_OVERFLOW = 12345;

function chainParseSetPageHTML( data, next ) {

    let $ = cheerio.load(data.html);

    console.log( "chainParseSetPageHTML: "+data.seriesName+", "+data.setName );

//console.log(data.html);

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

    data.cardPageList = [ ];
    $("tbody.row-hover").find("tr").each( (index,rowContent)=> {
        let cardData = { };
        cardData.seriesName  = data.seriesName;
        cardData.setName     = data.setName;
        cardData.number      = cheerioElementzToText($(rowContent).find("td.column-1"));
        cardData.name        = cheerioElementzToText($(rowContent).find("td.column-4"));
        cardData.baseHRef    = $(rowContent).find("a[target='_blank']").attr("href");

// console.log("cardData number",cardData.number,"name",cardData.name,"href",cardData.baseHRef);

        if( !cardData.baseHRef ) {
            console.log("ALERT: cannot find base href for row");
            console.log(JSON.stringify(rowContent));
        }
        else if( !cardData.number ) {
            console.log("ALERT: cannot find card number for row");
            console.log(JSON.stringify(rowContent));
        }
        else {
            data.cardPageList.push(cardData);
        }
    });

console.log("data.cardPageList.length",data.cardPageList.length);

    next(null,data);
}


function hashCode(s){
    let n = s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    let h = Math.abs(n).toString(16).padStart(8,'0');
    return h;
}




function parseFileExtensionFromURL(url) {
    // first remove any URL query parameters
    let deQueriedURL = url.split('?').shift();
    // next get the file extension *with* the period
    return deQueriedURL.substr((deQueriedURL.lastIndexOf('.')));
}


function chainFetchCardPages( data, next ) {

    const hrefSuffixes = [ "&bt=sold", "&bt=forSale" ];
    data.downloadList = [ ];
    let seriesName = "<none>";
    let setName = "<none>";
    let cardNum = "<none>";

    fetchPagesForSingleCard( data.cardPageList, 0 );

    function fetchPagesForSingleCard( cardPageList, index ) {
        if( index === cardPageList.length ) {
            console.log("series",seriesName,
                        "set",setName,
                        "card num",cardNum,
                        "cardPageList.length",cardPageList.length,);
            return next(null,data);
        }
        let cardData = cardPageList[index];
        seriesName = cardData.seriesName;
        setName = cardData.setName;
        cardNum = cardData.number.padStart(3,'0');
        let pageReadCount = 0;
        hrefSuffixes.forEach( (suffix) => {
            let href = cardData.baseHRef + suffix;
            fetchPage( href, function parseCardListPage( err, html ) {
                if( html ) {
                    let $ = cheerio.load(html);
                    let rowCount = 0;
                    let imgCount = 0;
                    $("div.row.result").each( (index,rowContent)=> {
                        ++rowCount;
                        let imgSrc = $(rowContent).find("img.itemImage")
                        // the <img> src= is the url for the thumbnail
                        // the <img> name= is the url for the full image
                                                  .attr("name");
                        if( imgSrc ) {
                            let sscnPath  = cardData.seriesName+"/"+cardData.setName+"/"+cardData.number.padStart(3,'0');
                            let cardPath  = "./card-images/"+dirRemap.remap(sscnPath)+"/";
                            let hashSeed  = cardData.name + cardPath + imgSrc;
                            let baseName  = "cardmavin" + hashCode(hashSeed);
                            let extension = parseFileExtensionFromURL(imgSrc);
// console.log("uri:",imgSrc,"filename:",cardPath+baseName+extension);
                            data.downloadList.push({uri:imgSrc,filename:cardPath+baseName+extension});
                            // we may have new card info not previously saved
                            fs.mkdir(cardPath,{recursive:true},()=>{});
                            ++imgCount;
                        }
                    });

// console.log("rowCount",rowCount);
// console.log("imgCount",imgCount);

                }
                if( ++pageReadCount === hrefSuffixes.length ) {
                    fetchPagesForSingleCard( cardPageList, index+1 );
                }
            });
        });
    }
}



function chainParseCardPages( data, next ) {

    const numTasks = 4;
    let completed  = 0;
    const options  = { verbose: true, loopDelay: 50 };
    options.sizeMask = [ 25401, 25572, 38133 ]; // images of card backs

    for( let t=0; t<numTasks; ++t ) {
        setTimeout( () => { downloadTask( data.downloadList, onComplete, options ); }, 25*t );
    }

    function onComplete() {
        if( ++completed == numTasks ) {
            next(null,data);
        }
    }

}

function fetchCardSet( index, seriesSetList, done ) {
    // we need a proper "master list" that we can map to our site URLs.
    // for now this will have to do.
    let setInfo = seriesSetList[index];
    let data    = { };
    hrefmap.every( (map) => {
        if( map.set === setInfo.setName ) {
            data = JSON.parse(JSON.stringify(setInfo));
            data.href = map.href;
            return false;
        }
        return true;
    });

    chain(data)
        .chain(chainFetchSetPage)
        .chain(chainParseSetPageHTML)
        .chain(chainFetchCardPages)
        .chain(chainParseCardPages)
        .coda( err => {
            if(err) {
                let item = { seriesName: setInfo.seriesName, setName: setInfo.setName };

                console.log("ERROR: failure fetching cards for",setInfo);
                console.log("error info:",err);
            }
            if( ++index === seriesSetList.length ) {
                console.log("done");
                done(err);
            }
            else {
                setTimeout( () => { fetchCardSet( index, seriesSetList ); } )
            }
        });
}

function cardmavinGopher( seriesData, seriesSetList, done ) {
    console.log("_____________________________");
    console.log("function cardmavinGopher");
    fetchCardSet( 0, seriesSetList, done );
}

// the export function
exports.autoRegister = function autoRegister( herder ) {
    herder.register( cardmavinGopher );
}
