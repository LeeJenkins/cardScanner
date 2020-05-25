
exports.chain = function chain(data,f) {

    let DEBUG=false;

    if(DEBUG) console.log("      chain.ctor data: %s",JSON.stringify(data));

    f = f || function( data, next ) { next(null,data); };

    // function next(err,data,isResolved)
    //     err and data are trated as opaque, with one exception: if err
    //     exists then an error is assumed to have occured. isResolved is
    //     an optional parameter that causes the chain to run coda(), or
    //     simply to terminate, without an error condition.
    f.next = function(err,data,isResolved) {
        DEBUG = false;
        if(DEBUG) console.log("      chain.next err: %s",JSON.stringify(err));
        if(DEBUG) console.log("      chain.next data: %s",JSON.stringify(data));
        if(DEBUG) prettyDump("chain.next data",data);
        if(err) {
            if(DEBUG) console.log("chain execution has failed; searching from %s for coda function...",f.name);
            for( let f2 = f; f2; f2=f2.chainedFunction ) {
                if(DEBUG) console.log("check %s for coda function...",f2.name);
                if( f2.codaFunction ) {
                    f2.codaFunction(err,data,f2.codaFunction.next);
                    break;
                }
            }
        }
        else if( f.chainedFunction && !isResolved ) {
            if(DEBUG) console.log("chain execution has succeeded; running next chained function...");
            f.chainedFunction(data,f.chainedFunction.next);
        }
        else if( f.codaFunction ) {
            if(DEBUG) console.log("chain execution is nearly complete; running coda function...");
            f.codaFunction(err,data,f.codaFunction.next);
        }
        else {
            if(DEBUG) console.log("chain execution found no more functions to execute");
        }
    }
    f.chain = function(f2) {
        f.chainedFunction = f2;
        if(DEBUG) console.log("      chain.chain");
        return chain(null,f2);
    }
    f.coda = function(f2) {
        f.codaFunction = f2;
        chain(null,f2);
        f2.chain = null; // don't allow coda functions to .chain()
        return f2;
    }
    if( data ) {
        if(DEBUG) console.log("      chain.init data: %s",JSON.stringify(data));
        setTimeout( () => { f(data,f.next); } );
    }
    return f;
}

