# cardScanner
A page crawler to download and categorize card images.

## First Light
You should be able to run the app with these commands:

    $ npm install
    $ node fetch-card-images.js

A full run would take many, many hours. If this is your first time to run it, then that's probably not what you want to do. Instead, let it run for a few minutes, long enough to download a few directories worth of image files. Then you can browse the structure of the card-images directory tree. This directory is .git-ignored, btw.


## To Add a Gopher
Look at pkmncardsGopher.js and cardmavinGopher.js for examples of getting and parsing HTML, then downloading images. Be sure to understand directoryRemap.js too. Then pick one of the data sources listed in fetch-card-images.js and put a note here in this README that you are working on it. This will help avoid duplication of effort.

## Dev Notes
As development progresses, we should look for ways to refactor and reuse common code. Some of this is already done, but there will be more opportunities.

Please make sure your new gopher downloads images as unique file names and that it skips downloading images that already exist in the local file store. See the existing gophers for examples.

The program occasionally crashes with an "unhandled stream error in pipe". It looks like the low-level C code is not passing this error up to the javascript layer. 
