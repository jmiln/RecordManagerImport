const fetch = require("node-fetch");
const fs = require("fs");
const { inspect } = require("util");
const { exec } = require("child_process");

const readline = require("readline");

const helpArr   = require(__dirname + "/data/helpOut.js");
const kwMap     = require(__dirname + "/data/keywordMap.js");
const locMap    = require(__dirname + "/data/locations.js");
const pubMap    = require(__dirname + "/data/pubMap.json");
const bookLog   = require(__dirname + "/data/bookLog.json");

const chooseOtherStr = "\n[O] Choose other";
const cancelStr      = "\n[C] Cancel";
const saveStr        = "\n[S] Save as is";

const cancelVals = ["c", "cancel"];
const noVals     = ["n", "no"];
const otherVals  = ["o", "other"];
const saveVals   = ["s", "save"];
const useVals    = ["u", "use"];
const yesVals    = ["y", "yes"];

// The max length of a single full size row/ field in record manager
const MAX_LEN = 64;

// The readline to allow user input from the commandline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const argv = require("minimist")(process.argv.slice(2), {
    alias: {
        i:     "isbn",        // ISBN (Alternative to the one that brings up the info)
        d:     "dj",          // Dust Jacket

        // Bindings
        h:     "hc",          // Hardcover
        p:     "pb",          // Paperback
        sp:    "sp",          // Spiral Binding
        fr:    "french",      // French Wraps

        // Editions
        bc:    "bc",          // Book Club
        lp:    "lp",          // Large Print

        f:     "first",       // 1st Printing
        l:     "later",       // Later Printing

        // Pages
        pg:    "pages",       // Specify the page count
        u:     "unpaginated", // Set the pages as unpaginated

        // Other
        cond:  "condition",   // Flag for condition strings
        debug: "debug",       // Don't actually run the ahk script, just print the output
        fill:  "fill",        // Fill in the extra keyword slots with previous entries (ctrl+f) if available
        help:  "help",        // Print out the help info, don't do anything else
        ill:   "illustrated", // If it has illustrations, pop up the menu to ask what kind
        kw:    "keywords",    // Stick some keywords into the keyword slots
        loc:   "location",    // Specify a location for it to use
        n:     "novel",       // Tack `: a novel` onto the title
        pr:    "price",       // Set the price
        pub:   "publisher",   // Give it a publisher to prioritize looking for
        rem:   "remainder",   // Mark that it has a remainder mark
        sub:   "subtitle",    // Stick in a subtitle manually
    }
});


if (argv.help) {
    return console.log(helpArr.join("\n"));
}
debugLog("argV: ", argv);

let isbn = process.argv[2];
let globalKWLen = null;

if (!isbn) {
    rl.close();
    return console.log("Missing ISBN.");
} else if (isbn.length !== 10 && isbn.length !== 13) {
    rl.close();
    return console.log(`"${isbn}" is not a valid ISBN. (Invalid isbn length)`);
} else {
    isbn = isbn.toString().toUpperCase();
}

const API_URL = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn.toString().toUpperCase()}&jscmd=data&format=json`;

let boardStr = "VG IN X.";

argv.conditions = argv.condition.split(",").map(c => c.toLowerCase());
if (argv.conditions.includes("bc")) {
    argv.bc = true;
}
if (argv.conditions.includes("lp")) {
    argv.lp = true;
}

let jsonOut = null;
async function init() {
    // If it's a hardcover book with no DJ, this will ask about special boards and such as needed.
    if (argv.hc && !argv.dj) {
        // Check if the X should be swapped out
        const boardTypes = [
            "cloth boards",
            "leatherette binding",
            "padded brown leatherette with gilt lettering",     // Pretty much for the louis l'amour leatherettes
            "pictorial boards",
            "spiral binding",
        ];
        const resOptions = (arrRange(boardTypes.length)).concat(otherVals, cancelVals);
        const boardRes = await askQuestionV2(`The book is HC without a DJ. Which, if any of the following should I use?\n\n${boardTypes.map((b, ix) => `[${ix}] ${b}`).join("\n")}\n${chooseOtherStr}${cancelStr}`, resOptions);
        if (boardTypes[boardRes]) {
            boardStr = boardStr.replace("X", boardTypes[boardRes]);
        } else if (otherVals.includes(boardRes)) {
            const newBoardRes = await askQuestion("What would you like to replace the X in `VG IN X` with?");
            if (newBoardRes?.length) {
                if ((newBoardRes.length + boardStr.length - 1) > MAX_LEN) {
                    console.log(`Invalid string, your board condition can only be a max of ${MAX_LEN} long, including the base of "VG IN ."`);
                } else {
                    boardStr = boardStr.replace("X", newBoardRes);
                }
            }
        }
    }

    const bookInfoArr = processArgv();

    const oldJsonOut = bookLog.find(ob => ob.isbn == isbn);
    if (oldJsonOut) {
        debugLog(`Found older data for ${isbn}, using that.`);
        jsonOut = {};

        // Stick it as an object with the isbn as it's key so it matches the api response
        jsonOut["ISBN:" + oldJsonOut.isbn] = oldJsonOut;
        debugLog("Old data:", jsonOut);
    } else {
        debugLog(`No old data found for ${isbn}, trying to fetch new.`);
        await fetch(API_URL)
            .then((res) => res.json())
            .then((json) => jsonOut = json)
            .catch((err) => console.log(err));
    }

    // If it couldn't find a match for the isbn, ask for the main fields to be filled in
    // Normally, when an isbn isn't found, it will just need title/ subtitle, author(s), date, and publisher/ location
    if (!jsonOut || !Object.keys(jsonOut).length) {
        const newJson = await findInfo();

        // Stick it as an object with the isbn as it's key so it matches the api response
        jsonOut = {};
        jsonOut["ISBN:" + isbn] = newJson;
        if (argv.debug) {
            rl.close();
            return debugLog("Finding data for new book: ", jsonOut);
        }
    }

    // Once it's done what it can to get all the info, run it through all the checkers and such
    if (jsonOut && Object.keys(jsonOut).length) {
        if (Object.keys(jsonOut).length === 1) {
            jsonOut = jsonOut[Object.keys(jsonOut)[0]];
        } else {
            return console.log("The api somehow returned more than one result for the given isbn.");
        }

        // Work out the title & subtitle
        let titleOut, subtitle, rawTitle = null;
        if (jsonOut.title) {
            // If there are subtitles from both us entering one in with the --subtitle flag, and from the api/ booklog
            // Ask which one we want to use
            if (jsonOut.subtitle && argv.subtitle && jsonOut.subtitle.toLowerCase() !== argv.subtitle.toLowerCase()) {
                const subRes = await askQuestionV2(`Two subtitle options were found, which of these do you want to use?\n[0] ${jsonOut.subtitle}\n[1] ${argv.subtitle}\n\n[C] Cancel / Neither`, [0,1].concat(cancelVals));
                if (parseInt(subRes, 10) === 1) {
                    jsonOut.subtitle = argv.subtitle;
                }
            }
            [titleOut, subtitle, rawTitle] = parseTitle(jsonOut.title, jsonOut.subtitle, argv.bc, argv.lp, argv.subtitle);
            if (subtitle?.length) {
                bookInfoArr.push(`SUB=${subtitle}`);
            }
            bookInfoArr.push(`RAWTITLE=${rawTitle}`);
            bookInfoArr.push(`TITLE=${titleOut}`);
        }

        // Work out the authors as needed
        // TODO Figure out the contributions (edited by, illustrated by, etc)
        // TODO Not sure how this would be entered automatically, but would help out
        // TODO when putting a book in after the 1st time/ when it pulls from the bookLog
        if (jsonOut?.authors?.length) {
            let authStr = "";

            // Make sure that there are no duplicate authors
            const authSet = new Set(jsonOut.authors.map(a => a.name));
            const authArr = [...authSet];

            for (const auth of authArr) {
                const name = auth.split(" ");
                authStr += `${authStr.length ? "; " : ""}${name[name.length-1]}, ${name.slice(0, name.length-1).join(" ")}`;
            }

            // This solution via https://stackoverflow.com/a/37511463
            // Replace accented letters with normal ones
            authStr = authStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            bookInfoArr.push(`AUTHOR=${authStr}`);

            // If there are spaces that can be filled up in the keywords, check the booklog for more titiles by the author to fill in with
            if (5 - globalKWLen > 0) {
                const kwTitles = await getFromAuthMap(authArr[0], jsonOut.title);
                debugLog("KW titles to fill with: ", kwTitles);
                if (kwTitles?.length) {
                    const resOptions = yesVals.concat(noVals);
                    const res = await askQuestionV2(`I found ${kwTitles.length} titles to use as keywords.\n${kwTitles.map(t => toProperCase(t)).join(", ")}\nShould I use them? (Y)es / (N)o`,  resOptions);
                    if (["y", "yes"].includes(res.toLowerCase())) {
                        for (const title of kwTitles) {
                            globalKWLen++;
                            bookInfoArr.push(`kw${globalKWLen}=${title}`);
                        }
                    }
                    if (argv.fill) {
                        while (globalKWLen <= 5) {
                            bookInfoArr.push(`KW${globalKWLen}=^f`);
                            globalKWLen += 1;
                        }
                    }
                }
            }
        }

        let pubOut = null;
        if (argv.publisher?.length) {
            // If there's a manually given publisher, look for that
            pubOut = await getPub(argv.publisher);
        } else if (jsonOut.publishers?.length) {
            // If there's a publisher supplied from the api response, look for a match for that
            const pubName = jsonOut.publishers.map(p => p.name).join(" ");
            let inLocs = null;
            if (jsonOut.publish_places?.length) {
                debugLog("jsonOut", jsonOut);
                // debugLog("jsonOut.pubLocs", jsonOut.publish_places);
                inLocs = jsonOut.publish_places.map(loc => {
                    if (Array.isArray(loc))      loc      = loc[0];
                    if (Array.isArray(loc.name)) loc.name = loc.name[0];
                    return loc.name;
                });
            }

            pubOut = await getPub(pubName, inLocs);
        } else {
            // There's no pub given/ found, so ask
            pubOut = await getEmptyPub();
        }

        debugLog("[INIT] PubOut: ", pubOut);
        if (pubOut.locs && pubOut.pub && pubOut.new) {
            // Stick the new publisher in with the old saved ones
            debugLog("Got back from getPub, new pub is: ", pubOut);
            await mergePubs(pubOut, pubMap);
        }

        const chosenPub = pubOut.pub ? pubOut.pub : null;
        let pubLoc = pubOut.locs ? pubOut.locs : null;
        if (chosenPub) {
            bookInfoArr.push(`PUB=${chosenPub}`);
            if (pubLoc) {
                bookInfoArr.push(`LOC=${pubLoc}`);
            }
        }

        // If the api gives a date, grab the year from that
        let date = null;
        if (jsonOut.publish_date) {
            date = new Date(jsonOut.publish_date.toString()).getUTCFullYear();
            bookInfoArr.push(`PUBDATE=${date}`);
        }

        // If the illustrations flag is given, ask which one it should put, based on the options in data/illustrations.js
        if (argv.illustrated) {
            const illusOptions = require("./data/illustrations.js");
            const resOptions = (arrRange(illusOptions.length)).concat(cancelVals);
            const illRes = await askQuestionV2(`What sort of illustrations are they?\n\n${illusOptions.map((ill, ix) => `[${ix}] ${ill}`).join("\n")}`, resOptions);
            if (Number.isInteger(parseInt(illRes)) && illusOptions[illRes]) {
                bookInfoArr.push(`ILLUS=${illusOptions[illRes]}`);
            }
        }

        // Work out whatever isbn stuff for the output file
        if (argv.isbn) {
            argv.isbn = argv.isbn.toString();
            if (argv.isbn.length === 10 || argv.isbn.length === 13) {
                isbn = argv.isbn.toString();
            }
        }

        // Stick the ISBN into the output arr, based on which one ie is
        if (isbn && (isbn.length === 10 || isbn.length === 13)) {
            bookInfoArr.push(`ISBN${isbn.length}=${isbn}`);
        }

        // Format the jsonOut data to only keep the bits that matter
        // TODO check if there are any differences, and if so, overwrite?
        // if (!bookLog.find(ob => ob.isbn == isbn) || argv.debug) {
        const oldBook = bookLog.find(ob => ob.isbn == isbn);
        const authOut = [...new Set(jsonOut.authors.map(a => toProperCase(a.name.trim())))];
        const jsonToSave = {
            isbn: isbn,
            title: toProperCase(rawTitle),
            subtitle: subtitle ? toProperCase(subtitle.replace(/^[-:]/, "").replace(/[:-] book club edition/i, "").trim()) : "",
            authors: authOut.map(auth => { return {name: auth}; }),
            publish_date: date?.toString()
        };
        if (chosenPub) {
            jsonToSave.publishers = [{name: toProperCase(chosenPub)}];
        }
        if (pubLoc) {
            if (Array.isArray(pubLoc)) pubLoc = pubLoc[0];
            jsonToSave.publish_places = [{name: toProperCase(pubLoc)}];
        }

        if (oldBook) {
            // There's an older version of the book in there
            // Check if they're the same, then ask if it should replace the old one?
            const jsonToSaveString = JSON.stringify(jsonToSave, null, 4);
            const oldBookString    = JSON.stringify(oldBook, null, 4);
            if (jsonToSaveString !== oldBookString) {
                console.log("\nThis is different than a previously saved bookLog entry\n");
                const repRes = await askQuestionV2(`Which of the following should be saved?\n\n[0]\n${jsonToSaveString}\n\n[1]\n${oldBookString}`, [0, 1]);
                if (parseInt(repRes, 10) === 0) {
                    // The new one was chosen, so get rid of the old one
                    bookLog.splice(bookLog.findIndex(b => b.isbn == isbn), 1);
                    // Stick the new one it
                    bookLog.push(jsonToSave);

                    // Then go ahead and save it as needed
                    const booksToSave = JSON.stringify(bookLog, null, 4);
                    debugLog("JSON to save: ", jsonToSave);
                    await saveBooks(booksToSave);
                } else {
                    // Just move along and ignore it
                }
            }
        } else {
            // There's no older version to check against, so just save it
            bookLog.push(jsonToSave);
            const booksToSave = JSON.stringify(bookLog, null, 4);
            debugLog("JSON to save: ", jsonToSave);
            await saveBooks(booksToSave);
        }

        // if I have it set to debug, just return and print out what would go through
        if (argv.debug) {
            rl.close();
            return console.log(bookInfoArr);
        }

        // If it's not set to debug, go ahead and save the bookInfoArr to the file, and start up the ahk script
        await saveAndRun(bookInfoArr);
    }
}
init();


// Process any flags/ arguments that were used to add extra data
function processArgv() {
    const outArr = [];

    // Anything to be put in the edition field
    if (argv.bc) {
        // It's a book club book, so need to put that in the edition slot
        outArr.push("EDITION=BOOK CLUB");
    } else if (argv.later) {
        // It's a later printing, so put that in the edition slot
        outArr.push("EDITION=Later Printing");
    } else if (!argv.bc && argv.first) {
        // It's a first printing
        let printing = "1st";
        if (Number.isInteger(parseInt(argv.first))) {
            argv.first = parseInt(argv.first);
            if (argv.first === 1) {
                printing = "1st";
            } else if (argv.first === 2) {
                printing = "2nd";
            } else if (argv.first === 3) {
                printing = "3rd";
            } else if ([4,5,6,7,8,9,10].indexOf(argv.first) > -1) {
                printing = `${argv.first}th`;
            }
            // Anything past this (past 5th normally) should be later printing
        }
        outArr.push(`EDITION=${printing} printing`);
    }

    // If the page count orlack thereof is given
    if (argv.pages) {
        const pg = parseInt(argv.pages, 10);
        if (Number.isInteger(pg)) {
            outArr.push(`PAGES=${pg}${argv.pages.toString().endsWith("+") ? "+" : ""}`);
        } else if (argv.pages.toString().toLowerCase() === "u") {
            outArr.push("PAGES=unpaginated");
        }
    } else if (argv.unpaginated) {
        outArr.push("PAGES=unpaginated");
    }

    // Set for hardcover, paperback, or spiral
    if (argv.hc) {
        outArr.push("BD=HC.");
    } else if (argv.pb) {
        outArr.push("BD=PB.");
    } else if (argv.sp) {
        outArr.push("BD=SPIRAL.");
    }

    // If it's got a DJ
    if (argv.dj) {
        outArr.push("DJ=DJ.");
    }

    // If the price is given
    const priceReg = /^\d{1,3}\.*\d{0,2}$/;
    if (argv.price?.toString().match(priceReg)) {
        outArr.push("PRICE=" + argv.price);
    }

    const frenchStr = argv.french ? "FRENCH " : "";
    if (argv.condition) {
        let startStr = "";
        const endStr = "Pages Clean & Tight.";
        const condMap = require("./data/condStrings.js");
        const conds = [];

        if (argv.pb) {
            // Default condition to start with for pb books
            startStr = `VG IN ${frenchStr}WRAPS.`;
        } else if (argv.hc && argv.dj) {
            // Default condition to start with for hc books with a dj
            startStr = "VG/VG";
        } else if (argv.hc) {
            // Default condition to start with for hc books without a dj
            //  - This will be vg in pictorial boards, cloth, etc
            //  - This is set back at the begining when it asks about board types
            startStr = boardStr;
        }
        if (startStr?.length) {
            conds.push(startStr);
        }

        if (argv.conditions?.length) {
            // Go through the condition map and check for matches, so it can keep the
            // conditions in the order specified there
            for (const condition of Object.keys(condMap)) {
                if (argv.conditions.includes(condition)) {
                    conds.push(condMap[condition]);
                }
            }
        }
        conds.push(endStr);

        // See how many of the condition strings can fit into the fields
        const condOut = {1: "", 2: ""};
        let maxFirst = false; // If it needs to go into the 2nd, don't keep putting stuff into the first
        for (const cond of conds) {
            if ((condOut[1].length + cond.length + 2) < MAX_LEN && !maxFirst) {
                // Stick the condition into the main condition area
                condOut[1] += condOut[1].length ? "  " + cond : cond;
            } else if (condOut[2].length + cond.length < MAX_LEN*2) {
                // Stick the condition into the 2nd condition area
                condOut[2] += condOut[2].length ? "  " + cond : cond;
                maxFirst = true;
            } else {
                // It's gotten too big so back out
                console.log("The condition lines were too long to fit everything.");
                break;
            }
        }
        if (condOut[1].length) {
            outArr.push(`COND=${condOut[1]}`);
        }
        if (condOut[2].length) {
            outArr.push(`COND2=${condOut[2]}`);
        }

    } else {
        const remStr = argv.remainder ? "REMAINDER MARK.  " : "";

        // Work out some default conditions
        if (argv.pb) {
            // Default condition to start with for pb books
            outArr.push(`COND=VG IN ${frenchStr}WRAPS.  ${remStr}PAGES CLEAN & TIGHT.`);
        } else if (argv.hc && argv.dj) {
            // Default condition to start with for hc books with a dj
            outArr.push(`COND=VG/VG  ${remStr}PAGES CLEAN & TIGHT.`);
        } else if (argv.hc) {
            // Default condition to start with for hc books without a dj
            //  - This will be vg in pictorial boards, cloth, etc
            outArr.push(`COND=VG IN X BOARDS.  ${remStr}PAGES CLEAN & TIGHT.`);
        }
    }

    if (argv.keywords) {
        let ix = 1;
        if (typeof argv.keywords === "string") {
            const keywords = argv.keywords.split(",");
            if (keywords.lengh > 5) return console.log("You can only have 5 keywords MAX.");

            for (const kw of keywords.map(k => k.toLowerCase())) {
                // Check against a list of em from data/keywordMap.js
                if (Object.keys(kwMap).indexOf(kw) > -1) {
                    outArr.push(`KW${ix}=${kwMap[kw]}`);
                    ix += 1;
                } else if (kw.length > 3) {
                    // If it's not in the keyword map, and it's larger than the 3 characters that the actual keywords are, assume it's a keyword itself?
                    outArr.push(`KW${ix}=${kw}`);
                    ix += 1;
                }
            }
        }

        globalKWLen = ix-1;
    }

    return outArr;
}

// Go through and see if there is a matching publisher available
async function getPub(pubName, inLocs) {
    debugLog("[getPub input]", {pubName, inLocs});
    let out = {};
    if (!inLocs) {
        inLocs = [];
    }
    if (!Array.isArray(inLocs)) {
        inLocs = [inLocs];
    }
    if (!pubName?.length) {
        return new Error("Missing pubName to search for.");
    }
    pubName = pubName.toLowerCase();

    // Filter down the list to only include ones that have matching names
    let possiblePubs = pubMap.filter(pub => {
        let valid = false;
        if (Array.isArray(pub.name)) {
            valid = pub.name.find(n => n.toLowerCase().includes(pubName));
        } else {
            if (!pub.name && pub.pub) pub.name = pub.pub;
            valid = pub.name.toLowerCase().includes(pubName);
        }
        return valid;
    });

    // Then if somehow, it cannot find a match in the names, check the aliases
    if (!possiblePubs.length) {
        possiblePubs = pubMap.filter(pub => {
            if (!pub?.aliases) {
                debugLog("No aliases", pub);
                return false;
            }
            const foundPub = pub.aliases.find(a => {
                return pubName.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(pubName.toLowerCase());
            });
            if (foundPub) return true;
        });
    }

    // Then, if it still cannot find a match, check through the bookLog file, to see if any previous book has had one that matches
    if (!possiblePubs.length) {
        const pubMatch = bookLog.filter(book => {
            if (Array.isArray(book.publishers) && book.publishers?.length) {
                return book.publishers.filter(b => b.name.toLowerCase().includes(pubName)).length ? true : false;
            }
            return false;
        });
        if (pubMatch.length) {
            possiblePubs = pubMatch.map(book => {
                return {
                    name: book.publishers.map(b => b.name),
                    locations: book?.publish_places?.map(b => b.name),
                    new: true
                };
            });
        }
    }

    let pubChoices = [];  // Fill it with objects with name/loc each

    // Go through the matched publishers, and stick them into pubChoices with their possible locations
    debugLog("Possible found pubs: ", possiblePubs);
    for (const pub of possiblePubs) {
        if (Array.isArray(pub.name)) {
            for (const name of pub.name) {
                pubChoices.push({
                    name: name,
                    locations: pub.locations,
                    new: pub.new ? true : false
                });
            }
        } else {
            pubChoices.push({
                name: pub.name,
                locations: pub.locations,
                new: pub.new ? true : false
            });
        }
    }

    pubChoices = pubChoices.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);

    // Add in the original pub that it was searching for just in case that's what we actually wanted
    let newNum = null;
    const newPubName = Array.isArray(pubName) ? pubName[0] : pubName;
    if (!pubChoices.find(p => p.name.toLowerCase() === newPubName.toLowerCase())) {
        newNum = pubChoices.length;
        pubChoices.push({
            name: newPubName,
            locations: inLocs,
            new: true
        });
    }
    debugLog("Pubchoices: ", pubChoices);

    // If there were matches, work through those and spit out the choices
    if (pubChoices?.length > 1) {
        // We found more than one result, lets choose one
        const resOptions = (arrRange(pubChoices.length)).concat(otherVals, cancelVals);
        const pubRes = await askQuestionV2(`I found the following publishers, which should I use?\n\n${pubChoices.map((p, ix) => `[${ix}] ${p.name}`).join("\n")}\n${chooseOtherStr}${cancelStr}`, resOptions);
        if (pubChoices[pubRes]) {
            out.pub = pubChoices[pubRes].name;
            inLocs.push(...pubChoices[pubRes].locations);
            if (pubChoices && parseInt(pubRes, 10) === newNum) {
                out.new = true;
            }
        } else if (pubRes.toLowerCase() === "o") {
            // Query for a new name to look for
            const newPub = await askQuestion("What publisher should I search for?");
            out = await getPub(newPub);
            if (!out.locs && !out.pub) {
                return out;
            }
            if (out.locs) {
                inLocs.push(...out.locs);
            }
        } else if (pubRes.toLowerCase() === "c") {
            // Just stop looking for anything
            out.pub = null;
            out.locs = null;
            return out;
        }
    } else if (pubChoices.length == 1) {
        // Only one result was found. Use it?
        const pub = pubChoices[0];
        const resOptions = yesVals.concat(noVals, cancelVals);
        let question = null;
        if (pub.new) {
            question = `I did not find this publisher: ${pub.name}\nWould you like to use it anyways? (Y)es / (N)o / (C)ancel`;
        } else {
            question = `I found the publisher: ${pub.name}\nWould you like to use this? (Y)es / (N)o / (C)ancel`;
        }
        const res = await askQuestionV2(question, resOptions);
        if (["y", "yes"].includes(res.toLowerCase())) {
            // If it has the correct publisher, go ahead and use it
            out.pub = pub.name;
            out.new = pub.new;
            if (pub?.locations?.length) {
                inLocs.push(...pub.locations);
            }
        } else if (["c", "cancel"].includes(res.toLowerCase())) {
            // If it's not, or you want to stop looking, this will break out and it'll just ignore the publishers
            out.pub = null;
            out.locs = null;
            return out;
        } else {
            // If that's not what it should be, ask what should be there, then run the search again...
            const newPub = await askQuestion("What publisher should I search for?");
            out = await getPub(newPub);
            if (!out.locs && !out.pub) {
                return out;
            }
            if (out.locs?.length) {
                if (out.locs.length === 1) {
                    debugLog("Returning just out", out);
                    return out;
                } else {
                    inLocs.push(...out.locs);
                }
            }
        }
    }

    // If there were any locations found for whatever publisher, format em and see which is correct
    const newLoc = await getLoc(inLocs);
    if (!newLoc) {
        out.locs = null;
    } else {
        out.locs = [newLoc];
    }

    debugLog("Returning out of getPub, out: ", out);
    return out;
}

// Given however many locations,
//  * If more than one, ask which one
//  * If none, ask to find one, and match against the location file
//  * If only one, go ahead and accept it
async function getLoc(inLocs=[]) { // eslint-disable-line no-unused-vars
    if (!Array.isArray(inLocs)) {
        inLocs = [inLocs];
    }
    if (argv.location?.length) {
        // If the user supplied a location, try and match it against one of the ones in the list
        let possibleLocs = locMap.filter(loc => loc.toLowerCase().indexOf(argv.location.toLowerCase()) > -1);
        if (!possibleLocs.length) {
            // if it didn't find any, try checking against the bookLog
            possibleLocs = bookLog.filter(book => {
                if (Array.isArray(book.publish_places) && book.publish_places.length) {
                    return book.publish_places.filter(b => b.name.toLowerCase().includes(argv.location.toLowerCase())).length ? true : false;
                }
                return false;
            });
            if (possibleLocs.length) {
                possibleLocs = possibleLocs.map(book => {
                    return book.publish_places.map(b => b.name);
                }).flat();
            }
        }
        if (possibleLocs.length) {
            inLocs.push(...possibleLocs);
        } else {
            inLocs.push(argv.location);
        }
    }

    debugLog("In getLoc, given locations are: ", inLocs);

    const stateRegex = /, [a-z]{2}$/i;
    const longStateRegex = /, [a-z]{3,4}\.*$/i;
    let outLoc = null;

    if (inLocs.length) {
        inLocs = inLocs.map(loc => {
            if (!loc) return;
            loc = loc.toLowerCase();
            if (loc.indexOf("new york") > -1) {
                loc = "new york";
            }
            if (loc.match(stateRegex)) {
                // Put a period at the end of a state abbreviation if it doesn't have one
                loc += ".";
            } else if (loc.match(longStateRegex)) {
                // If it's here, they have the state as a 3 letter abbreviation
                const locArr = loc.split(",");

                // Get the state down to a 2 letter abbreviation and stick a period after it
                const formattedState = locArr[locArr.length-1].split("").slice(0,3).join("") + ".";

                // Then put them all back together
                loc = locArr.slice(0, locArr.length-1).concat(formattedState).join(",");
            }
            return loc;
        });
        inLocs = [...new Set(inLocs)];

        // If there is more than one location, let em choose
        if (inLocs?.length > 1) {
            const locResOptions = (arrRange(inLocs.length)).concat(otherVals, cancelVals);
            const locRes = await askQuestionV2(`I found these location(s), which one should I use?\n\n${inLocs.map((loc, ix) => `[${ix}] ${loc}`).join("\n")}\n${chooseOtherStr}${cancelStr}`, locResOptions);
            if (Number.isInteger(parseInt(locRes)) && inLocs[locRes]) {
                return inLocs[locRes];
            } else if (locRes.toUpperCase() === "O") {
                // Ask for something to search by, and run it through this again with the results from that
                const targetLoc = await askQuestion("Which location are you looking for?");
                let possibleLocs = locMap.filter(loc => loc.toLowerCase().indexOf(targetLoc) > -1);
                if (!possibleLocs.length) {
                    // if it didn't find any, try checking against the bookLog
                    possibleLocs = bookLog.filter(book => {
                        if (Array.isArray(book.publish_places) && book.publish_places.length) {
                            return book.publish_places.filter(b => b.name.toLowerCase().includes(targetLoc.toLowerCase())).length ? true : false;
                        }
                        return false;
                    });
                    if (possibleLocs.length) {
                        possibleLocs = possibleLocs.map(book => {
                            return book.publish_places.map(b => b.name);
                        }).flat();
                    }
                }
                if (possibleLocs.length) {
                    outLoc = getLoc(possibleLocs);
                    if (!outLoc) {
                        return null;
                    } else {
                        return outLoc;
                    }
                }
            } else if (locRes.toUpperCase() == "C") {
                // Cancel it/ send back nothing so it'll be left blank
                return null;
            }
        } else if (inLocs?.length === 1) {
            return inLocs[0];
        } else {
            // There were no matching locations, so see if they want to find one
            const locResOptions = yesVals.concat(noVals);
            const locRes = await askQuestionV2("I did not find any matching locations, would you like to find one? (Y)es / (N)o", locResOptions);
            if (["y", "yes"].includes(locRes.toLowerCase())) {
                const targetLoc = await getNewLoc();
                return targetLoc;
            } else {
                return null;
            }
        }
    } else {
        // There were no locations provided, so see if they want to find one
        const locResOptions = yesVals.concat(noVals);
        const locRes = await askQuestionV2("There are no provided locations, would you like to find one? (Y)es / (N)o", locResOptions);
        if (["y", "yes"].includes(locRes.toLowerCase())) {
            const targetLoc = await getNewLoc();
            return targetLoc;
        } else {
            return null;
        }
    }
    return outLoc;
}

// If we don't have a location to go off of, ask for a new location and do what we can to find it
async function getNewLoc() {
    let newLoc = null;
    const newLocRes = await askQuestion("What location would you like to look for?");
    let possibleLocs = locMap.filter(loc => loc.toLowerCase().indexOf(newLocRes) > -1);

    if (!possibleLocs.length) {
        // if it didn't find any, try checking against the bookLog
        possibleLocs = bookLog.filter(book => {
            if (Array.isArray(book.publish_places) && book.publish_places.length) {
                return book.publish_places.filter(b => b.name.toLowerCase().includes(newLocRes.toLowerCase())).length ? true : false;
            }
            return false;
        });
        if (possibleLocs.length) {
            possibleLocs = possibleLocs.map(book => {
                return book.publish_places.map(b => b.name);
            }).flat();
        }
        debugLog("Possible booklog locs: ", possibleLocs);
    }

    if (!possibleLocs?.length) {
        // If there are no matches, ask to use what was entered
        const locResOptions = yesVals.concat(noVals, useVals);
        const noLocRes = await askQuestionV2(`I did not find any matches for ${newLocRes}, would you like to try again? (Y)es / (N)o / (U)se`, locResOptions);
        if (["y", "yes"].includes(noLocRes.toLowerCase())) {
            newLoc = getNewLoc();
        } else if (["u", "use"].includes(noLocRes.toLowerCase())) {
            return newLocRes;
        }
    } else if (possibleLocs.length > 1) {
        // If matched with more than one location
        const locResOptions = (arrRange(possibleLocs.length)).concat(cancelVals);
        const locChoiceRes = await askQuestionV2(`I found the following locations, which should I use?\n\n${possibleLocs.map((p, ix) => `[${ix}] ${p}`).join("\n")}\n${cancelStr}`, locResOptions);
        if (possibleLocs[locChoiceRes]) {
            debugLog("Setting newLoc to ", possibleLocs[locChoiceRes]);
            newLoc = possibleLocs[locChoiceRes];
        }
    } else {
        // There's only one match, so check if it's viable
        const locResOptions = yesVals.concat(noVals);
        const oneLocRes = await askQuestionV2(`I found one match (${possibleLocs[0]}), would you like to use it? (Y)es / (N)o`, locResOptions);
        if (["y", "yes"].includes(oneLocRes.toLowerCase())) {
            newLoc = possibleLocs[0];
        }
    }
    return newLoc;
}

// If there's no pub given, ask if it's wanted
async function getEmptyPub() {
    let out = {};
    const noResOptions = yesVals.concat(noVals);
    const noRes = await askQuestionV2("I did not find any publisher, would you like to find one? (Y)es / (N)o", noResOptions);
    if (["y", "yes"].includes(noRes.toLowerCase())) {
        const newPub = await askQuestion("What publisher should I search for?");
        out = await getPub(newPub);
        debugLog("Empty pub out: ", out);
        if (!out.locs && !out.pub) {
            return out;
        }
    } else {
        out.pub  = null;
        out.locs = null;
    }
    return out;
}

// Ask a question/ prompt and wait for the reply
async function askQuestion(query) {
    debugLog("[askQuestion] Q: " + query);
    const prompt = "\n\n> ";
    return new Promise(resolve => rl.question("\n" + query + prompt, ans => {
        resolve(ans);
    }));
}

// Ask a question, with set answers that are expected
async function askQuestionV2(question, answers) {
    debugLog("[askQuestionV2] Q: ", question);
    debugLog("[askQuestionV2] A: ", answers);
    answers = answers.map(a => a.toString().toLowerCase());

    const prompt = "\n\n> ";

    return new Promise((resolve) => {
        rl.question("\n" + question + prompt, (line) => {
            if (answers.indexOf(line.toLowerCase()) > -1) {
                resolve(line.toLowerCase());
            } else {
                console.log(line + " is not a valid answer.\nChoose from the following: " + answers.join(", "));
                resolve(askQuestionV2(question, answers));
            }
        });
    });
}

// Merge a new publisher into an existing one
async function mergePubs(newPub) {
    // - Check if it's already in there
    const foundPubMatch = pubMap.find(pub => {
        const nameToFind = newPub.pub.toLowerCase();
        if (Array.isArray(pub.name)) {
            return pub.name.find(n => n.toLowerCase() === nameToFind);
        } else {
            return pub.name.toLowerCase() === nameToFind;
        }
    });
    if (foundPubMatch) {
        // Just return, because it's already there.
        // This should not happen, since it should have just found the pub earlier, but just in case
        return debugLog("foundPubMatch: ", foundPubMatch);
    }

    // - Check if it should be matched with another publisher
    //    * Via similar names, or by asking and matching the requested one in
    const namesToFind = newPub.pub.toLowerCase().split(" ")
        .filter(p => !["book", "books", "press"].includes(p))
        .filter(p => p.replace(/[^a-zA-Z]/g, "").length);
    debugLog("[MergePub] namesToFind: ", namesToFind);
    const foundPubs = pubMap.filter(pub => {
        // Split up the name, to check each part on it's own
        // ex: harper voyager would get checked as "harper" and "voyager", rather than as a whole
        if (Array.isArray(pub.name)) {
            return pub.name.filter(n => namesToFind.some(ntf => n.toLowerCase().includes(ntf))).length;
        } else {
            return namesToFind.some(ntf => pub.name.toLowerCase().includes(ntf));
        }
    });

    debugLog("foundPubs:", foundPubs);
    if (foundPubs?.length) {
        // If it found a list of similar publishers, ask which of them it should go in with

        // Get a list of the numbers for the answers, then tack on the options for other or cancel
        const answers = arrRange(foundPubs.length).concat(cancelVals, saveVals);
        const pubList = foundPubs.map((p, ix) => `[${ix}] ${p.name.map((name, jx) => jx > 0 ? " ".repeat(ix.toString().length + 3) + toProperCase(name) : toProperCase(name)).join("\n")}`).join("\n");
        const question = `I found these entries that could match. Would you like to put ${toProperCase(newPub.pub)} into one of these?\n\n${pubList}\n${saveStr}${cancelStr}`;

        const foundRes = await askQuestionV2(question, answers);
        // if (otherVals.includes(foundRes)) {
        // TODO Don't know what to do here currently, maybe ask for a new name to look for and offer matches?
        // This would require this mess to go recursive too, and that just gets really messy...
        // If I need this at some point, It will need the otherVals put back into the concat above
        if (saveVals.includes(foundRes)) {
            // If none of the matches are where it should go, just save it as a new publisher
            debugLog("If not for debug mode, it would save this publisher here: ", newPub);
            if (!argv.debug) {
                if (newPub.pub && !newPub.name) {
                    newPub.name = [toProperCase(newPub.pub)];
                }
                pubMap.push({
                    name: newPub.name,
                    locations: newPub.locs.map(l => toProperCase(l))
                });
                await savePubs(JSON.stringify(pubMap, null, 4));
                return console.log("Saved pub: " + newPub.pub);
            }
        } else if (cancelVals.includes(foundRes)) {
            // Just move along and treat it like any new publisher
            return;
        } else {
            // One of the known ones was picked
            // Then, find the index of that listing, put the new pubname in it (And the new location if needed)
            const pubIndex = pubMap.indexOf(foundPubs[foundRes]);
            pubMap[pubIndex].name.push(toProperCase(newPub.pub));
            if (!pubMap[pubIndex].locations.find(l => l.toLowerCase == newPub.locs[0].toLowerCase())) {
                // Stick any new locations in
                pubMap[pubIndex].locations.push(toProperCase(newPub.locs[0]));
                // Kill off any duplicate locations
                pubMap[pubIndex].locations = [...new Set(pubMap[pubIndex].locations)];
            }
            debugLog("New pub info: ", pubMap[pubIndex]);

            // Then, add it into the pubMap, and save it
            if (!argv.debug) {
                await savePubs(JSON.stringify(pubMap, null, 4));
                return console.log(`Merged ${newPub.pub} into ${pubMap[pubIndex].name.join(", ")}`);
            }
        }
    } else {
        // If it hasn't found a publisher to merge with, just save it as a new publisher
        // TODO Ask for a name to save it with, if it doesn't find a match
        delete newPub.new;
        debugLog("If not for debug mode, it would save this publisher here: ", newPub);
        if (!argv.debug) {
            if (newPub.pub && !newPub.name) {
                newPub.name = [toProperCase(newPub.pub)];
            }
            pubMap.push({
                name: newPub.name,
                locations: newPub.locs.map(l => toProperCase(l))
            });
            await savePubs(JSON.stringify(pubMap, null, 4));
            return console.log("Saved pub: " + newPub.pub);
        }
    }
}

// Save the pubmap
async function savePubs(pubJson) {
    if (argv.debug) return false;
    console.log("Saving pubs");
    await fs.writeFileSync(__dirname + "/data/pubMap.json", pubJson);
}

// Save the bookLog
async function saveBooks(bookJson) {
    if (argv.debug) return false;
    await fs.writeFileSync(__dirname + "/data/bookLog.json", bookJson);
}

// Run through all the data to make it all lowercase so it can be put in with caps lock on, then
// save it to the file and run the ahk script to actually put it into Record Manager
async function saveAndRun(infoArr) {
    const bookInfoOut = infoArr
        .map(e => e.toLowerCase())
        .join("\n")
        .replace(/’/g, "'");
    // Write to a file, then pass that to the ahk
    await fs.writeFileSync(__dirname + "/bookInfo.txt", bookInfoOut);
    rl.close();
    await exec(__dirname + "/bookOut.ahk", (error) => {
        if (error) {
            console.log(error);
        }
    });
}

// Quick little function to get the most recent x titles to use in the keyword slots
async function getFromAuthMap(auth, titleIn) {
    debugLog("[getFromAuthMap] AuthIn: ", auth);
    const fromMap = bookLog.filter(b => b.authors.some(a => a.name.toLowerCase() === auth.toLowerCase()));
    debugLog("[getFromAuthMap] FromMap: ", fromMap);
    if (!fromMap?.length) return null;

    const titleFilter = (book) => !(book.title.toLowerCase().includes(titleIn.toLowerCase()) || titleIn.toLowerCase().includes(book.title.toLowerCase()));
    const lengthFilter = (book) => book.title.length <= 19;
    const dateSort = (a, b) => parseInt(a.publish_date, 10) > parseInt(b.publish_date, 10) ? 1 : -1;

    const titles = fromMap
        .filter(titleFilter)
        .filter(lengthFilter)
        .sort(dateSort)
        .map(book => book.title.toLowerCase());

    const noDupTitles = [...new Set(titles)];

    return noDupTitles.slice(globalKWLen-5);
}

// Parse the title from what's given, as well as subtitle
function parseTitle(titleIn, subtitleIn, isBookClub, isLargePrint, manualSub) {
    if (!titleIn?.length) {
        throw new Error("[parseTitle] Missing title");
    }
    let title = titleIn
        .replace(/^the /i, "")          // Replace "the " at the beginning of titles
        .replace(/^a /i, "")            // Replace "a " at the beginning of the titles
        .replace(/(\r\n|\n|\r)/gm,"")   // Replace all line returns
        .replace(/\s\s+/g, " ")         // Replace multiple spaces with singles
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Replace accented letters with normal ones

    const bcString   = " - book club edition";
    const lpString   = " - large print edition";
    const bclpString = " - large print book club edition";
    let extraString  = "";

    let subtitle = subtitleIn?.length ? `: ${subtitleIn}` : "";

    if (isBookClub && isLargePrint) {
        extraString = bclpString;
    } else if (isBookClub) {
        extraString = bcString;
    } else if (isLargePrint) {
        extraString = lpString;
    }
    if (manualSub && !subtitle?.length) {
        subtitle = `: ${manualSub}`;
    }

    if (title.toLowerCase().indexOf("a novel") > -1) {
        // In case the ": a novel" is baked into the title instead of being a subtitle like it should
        // If it is, then wipe it out from the title, then put it on how I need it
        title = title
            .replace(/\s*: a novel/i, "")
            .replace(/\s*- a novel/i, "")
            .replace(/a novel/i, "");
        if (!subtitle?.length) {
            subtitle = ": a novel";
        } else {
            subtitle += " - a novel";
        }
    } else if (argv.novel) {
        // Or if I want to force it, just in case/ if it's not there and should be
        if (!subtitle?.length) {
            subtitle = ": a novel";
        } else if (subtitle.indexOf("novel") < 0) {
            // Make sure it's not in the subtitle already
            subtitle = subtitle
                .replace(/\s*: a novel/i, "")
                .replace(/\s*- a novel/i, "")
                .replace(/a novel/i, "");
            subtitle += " - a novel";
        }
    }

    return [`${title}${subtitle}${extraString}`, `${subtitle}${extraString}`, title];
}

// If a book is not found from the api or stored info, ask for the info manually
async function findInfo() {
    console.log("\nNo info was found for this book.\n");

    const newJsonOut = {
        isbn: isbn
    };

    // Grab the year it was published
    const dateRes = await askQuestion("What year was this published? Must be in YYYY format.");
    if (dateRes.match(/^\d{4}$/) && parseInt(dateRes, 10) > 0 && parseInt(dateRes, 10) <= new Date().getFullYear()) {
        newJsonOut.publish_date = dateRes;
    }

    // Grab the title, and subtitle, if viable
    const titleRes = await askQuestion("What is the title of this book? (If there's a subtitle, it will grab everything after a \":\")");
    if (titleRes?.length) {
        const [thisTitle, ...thisSub] = titleRes.split(":");
        newJsonOut.title = thisTitle.trim();
        if (Array.isArray(thisSub) && thisSub.length) {
            newJsonOut.subtitle = thisSub.join(":").trim();
        }
    }

    // Grab what ever author(s)
    const authRes = await askQuestion("What authors go with this book? (Authors will be split by commas)");
    if (authRes?.length) {
        const thisAuths = [...new Set(authRes.split(",").map(a => toProperCase(a.trim())))];
        newJsonOut.authors = thisAuths.map(auth => {
            return {name: auth};
        });
    }
    return newJsonOut;
}

// Log text & whatever object/ variable nicely
function debugLog(text, other) {
    if (argv.debug) {
        if (other) {
            // If there's an object or something you want logged, this way it whould behave better
            console.log("\n[DEBUG] " + text);
            console.log(inspect(other, {depth: 5}));
            console.log("\n");
        } else {
            console.log("\n[DEBUG] " + text);
        }
    }
}

// Return an array filled with consecutive numbers starting at 0
function arrRange(length) {
    return [...Array(length).keys()];
}

// Like camel-case but with spaces
function toProperCase(stringIn) {
    return stringIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}












