
const fs        = require('fs');
const request   = require('request');


function no_op() { }

function downloadFile( uri, filename, options, callback, attempts ) {
    options = options || { };
    options.retries   = options.retries || 2;
    attempts = attempts || 0;

    let isComplete = false;

    function callbackOnce(err) {
        if( !isComplete ) {
            isComplete = true;
            if( err && attempts < options.retries ) {
                if( options.verbose ) console.log("#RETRY# download",uri,"to",filename);
                downloadFile( uri, filename, options, callback, attempts+1 );
            }
            else {
                callback(err);
            }
        }
    }

    function reportError(context,err) {
        console.log("ERROR:",context,uri,"to file",filename);
        if( typeof(err) === "object" ) {
            err = JSON.stringify(err,null,4);
        }
        console.log(err);
        callbackOnce(err);
    }

    request.head(uri, function(err, res, body){
        if(err) {
            reportError("cannot download",err);
        }
        else {
            if( options.verbose ) console.log("downloadFile now streaming",uri,"to",filename);
            let filestream = fs.createWriteStream(filename);
            filestream.on('error',(err) => {
                reportError("attempting to save",err);
            });
            request(uri).pipe(filestream)
                        .on('close', callbackOnce)
                        .on('error', (err) => {
                            reportError("piping data from",err);
                        });
        }
    });
};

/*
    function downloadTask

    downloads an array of items from urls to files. the list is
    destroyed during download process. this allows multiple copies
    of function downloadTask to execute in parallel.

    downloadList - an array of { uri: string, filename: string }
    done - function (no args) to call when list is empty
    options - {
                overwrite: bool (default false)   overwrite existing files
                loopDelay: int/ms (default 0)     delay before looping
                verbose:   bool (default false)   print exec trace info
                retries:   int  (default 2)       number of times to retry on error
                sizeMask:  [int,..] (default [])  if file is sizeMask bytes, delete it
              }
*/
function downloadTask( downloadList, done, options ) {

    options = options || { };
    options.loopDelay = options.loopDelay || 0;
    options.retries   = options.retries   || 2;

    if( typeof(options.sizeMask) === "number" ) 
        options.sizeMask = [ options.sizeMask ];
    if( !options.sizeMask ) 
        options.sizeMask = [ ];

    downloadNextItem();

    function downloadNextItem() {
        if( downloadList.length ) {
            let item = downloadList.shift();
            if( !options.overwrite && fs.existsSync(item.filename) ){
                if( options.verbose ) console.log("file already exists",item.uri,item.filename);
                // do not delay here because no download occurred
                setTimeout( downloadNextItem );
            }
            else {
                if( options.verbose ) console.log("download from",item.uri,"to",item.filename);
                downloadFile( item.uri, item.filename, options, () => {
                    setTimeout( downloadNextItem, options.loopDelay );
                    if( options.sizeMask.length ) {
                        fs.stat( item.filename, (err, stat) => {
                            if( !err && stat ) {
                                options.sizeMask.forEach( (size) => {
                                    if( stat.size === size ) {
console.log("delete file",item.filename,"because its size is",size,"bytes");
                                        fs.unlink(item.filename,()=>{});
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
        else {
            done();
        }
    }
}

// export the functions
exports.downloadFile = downloadFile;
exports.downloadTask = downloadTask;
