const fs = require("fs");
const cheerio = require("cheerio");
const { exec } = require("child_process");
const fetch = require("node-fetch");
const { inspect } = require("util");
const readline = require("readline");

const {condMap, condLocs} = require(__dirname + "/data/condLocs.js");

const helpArr      = require(__dirname + "/data/helpOut.js");
const kwMap        = require(__dirname + "/data/keywordMap.js");
const locMap       = require(__dirname + "/data/locations.js");
const pubMap       = require(__dirname + "/data/pubMap.json");
const bookLog      = require(__dirname + "/data/bookLog.json");
const authMap      = require(__dirname + "/data/authMap.json");
const pseudonyms   = require(__dirname + "/data/pseudonyms.json");
const illusOptions = require(__dirname + "/data/illustrations.js");

const cancelVals = ["c", "cancel"];
const noVals     = ["n", "no"];
const otherVals  = ["o", "other"];
const saveVals   = ["s", "save"];
const useVals    = ["u", "use"];
const yesVals    = ["y", "yes"];

// The max length of a single full size row/ field in record manager
const MAX_LEN = 64;

// Max length of the mid-sized rows (publisher, illustrations)
const MAX_MID_LEN = 28;

// Max length of the smaller mid-sized rows (topic, location)
const MAX_SMALL_MID_LEN = 27;

// Max length of the small rows (Pub date, size)
// const MAX_SMALL_LEN = 15;  // eslint-disable-line no-unused-vars

// Max length of the smaller rows (edition, binding, jacket, pages)
// const MAX_SMALLER_LEN = 15; // eslint-disable-line no-unused-vars

// Max length of the keyword fields
const MAX_KW_LEN = 19; // eslint-disable-line no-unused-vars

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
        sp:    "spiral",      // Spiral Binding
        fr:    "french",      // French Wraps

        // Conditions
        vg:    "vg_cond",          // Let me put in a vg- or g+, etc as needed

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
        debug: "debug",       // Don't actually run the ahk script or save files, just print the output
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

let globalKWLen = null;
let boardStr = "VG IN X.";
let isOldListing = false;
let manualCond = null;

const globalKWs = [];

async function init() {
    if (argv.help) {
        rl.close();
        return console.log(helpArr.join("\n"));
    }
    debugLog("argV: ", argv);

    if (!process.argv[2]) {
        rl.close();
        return console.log("[ERROR] Missing ISBN!");
    }

    let isbn = getIsbnFromArg(process.argv[2]);
    if (!isbn) {
        rl.close();
        return;
    }

    const API_URL = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;

    argv.conditions = argv.condition?.length ? argv.condition.split(",").map(c => c.toLowerCase()) : [];
    debugLog("Conditions: ", argv.conditions);
    const extraArgs = { bc: "bc", lp: "lp", fr: "french" };
    for (const arg of Object.keys(extraArgs)) {
        if (argv.conditions.includes(arg)) {
            debugLog(`Removing "${arg}" from conditions / setting it's own flag`);
            argv[extraArgs[arg]] = true;     // Book Club
            argv.conditions.splice(argv.conditions.indexOf(arg), 1);
        }
    }

    let jsonOut = null;

    // If it's a hardcover book with no DJ, this will ask about special boards and such as needed.
    if (argv.hc && !argv.dj) {
        // Check if the X should be swapped out
        const boardType = await getBoards();
        if (boardType) boardStr = boardType;
    }

    const bookInfoArr = await processArgv();

    const oldJsonOut = bookLog.find(ob => ob.isbn == isbn);
    if (oldJsonOut) {
        debugLog(`Found older data for ${isbn}, using that.`);
        jsonOut = {};
        isOldListing = true;

        // Stick it as an object with the isbn as it's key so it matches the api response
        jsonOut["ISBN:" + oldJsonOut.isbn] = oldJsonOut;
        debugLog("Old data:", jsonOut);
    } else {
        debugLog(`No old data found for ${isbn}, trying to fetch new.`);
        await fetch(API_URL)
            .then((res) => res.json())
            .then((json) => jsonOut = json)
            .catch((err) => console.log(err));
        debugLog("jsonOut: ", jsonOut);
    }

    // If it couldn't find a match for the isbn, ask for the main fields to be filled in
    // Normally, when an isbn isn't found, it will just need title/ subtitle, author(s), date, and publisher/ location
    if (!jsonOut || !Object.keys(jsonOut).length) {
        const newJson = await findInfoForBlank(isbn);

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
            return console.log("[ERROR] The api somehow returned more than one result for the given isbn.");
        }

        // Work out the title & subtitle
        let fullTitle, subtitle, extra, rawTitle = null;
        if (jsonOut.title) {
            // If there are subtitles from both us entering one in with the --subtitle flag, and from the api/ booklog
            // Ask which one we want to use
            if (jsonOut.subtitle && argv.subtitle && jsonOut.subtitle.toLowerCase() !== argv.subtitle.toLowerCase()) {
                const subRes = await askQuestionV2({
                    question: "Two subtitle options were found, which of these do you want to use?",
                    answerList: [jsonOut.subtitle, argv.subtitle],
                    cancel: true,
                });
                if (parseInt(subRes, 10) === 1) {
                    jsonOut.subtitle = argv.subtitle;
                }
            }
            ({fullTitle, subtitle, extra, rawTitle} = parseTitle(jsonOut.title, jsonOut.subtitle, argv.bc, argv.lp, argv.subtitle));
            if (subtitle?.length) {
                bookInfoArr.push(`SUB=${subtitle}${extra}`);
            }
            bookInfoArr.push(`TITLE=${fullTitle}`);
        }

        // Work out the authors as needed
        // TODO Figure out the contributions (edited by, illustrated by, etc)
        //      Not sure how this would be entered automatically, but would help out
        //      when putting a book in after the 1st time/ when it pulls from the bookLog
        const authOut = [];
        if (jsonOut?.authors?.length) {
            let authStr = "";

            let authUrl = null;
            if (jsonOut.authors[0]?.url) {
                authUrl = jsonOut.authors[0].url;
            }

            // Clean the names then make sure that there are no duplicates
            const authSet = new Set(jsonOut.authors.map(auth => {
                auth.name = auth.name.normalize("NFD").replace(/ø/g, "o").replace(/[\u0300-\u036f]/g, "");
                return auth.name.toLowerCase();
            }));
            for (let [ix, auth] of [...authSet].entries()) {
                if (!isOldListing) {
                    // If it's not an older listing where we trust that the auth is correct, go ahead and check for other names for the author
                    const pseu = await checkPseudonyms(auth);
                    if (pseu) {
                        auth = pseu;
                    }
                }

                const authMapIndex = Object.keys(authMap).find(au => au.toLowerCase() === auth.toLowerCase());
                const foundAuth = authMap[authMapIndex];

                if (foundAuth?.url && ix === 0) {
                    // If there's a different auth url that we should be using, grab that for later
                    authUrl = foundAuth.url;
                }
                authOut.push(auth);

                if (authStr?.length) {
                    // If there are already authors listed, go ahead and put in the separator
                    authStr += "; ";
                }
                if (foundAuth?.format) {
                    // In case there's a special format for the author, like jr. or some names where there's 2 parts of the last name
                    authStr += foundAuth.format;
                } else {
                    // Otherwise, split it up so it's `last, first` instead of `first last`
                    const name = auth.split(" ");
                    authStr += `${name[name.length-1]}, ${name.slice(0, name.length-1).join(" ")}`;
                }
            }

            // This solution via https://stackoverflow.com/a/37511463
            // Replace accented letters with normal ones
            bookInfoArr.push(`AUTHOR=${authStr}`);

            // If there are spaces that can be filled up in the keywords, check the booklog for more titiles by the author to fill in with
            debugLog("GlobalKWLen: ", globalKWLen);
            if (globalKWLen < 5) {
                // This should return `{titles: [], authUrl: ""}`, with those both filled up
                let {titles: kwTitles, url} = await getFromAuthMap(authOut[0], rawTitle);
                debugLog(`From getFromAuthMap, kwTitles: ${kwTitles}, url: ${url}`);
                if (!authUrl && url) {
                    // Only use the stored url if there's nothing provided
                    authUrl = url;
                }
                debugLog(`kwTitles: ${inspect(kwTitles)}, globalKWLen: ${globalKWLen}, authUrl: ${authUrl}`);
                if ((!kwTitles?.length || (5 - (kwTitles?.length || 0) - globalKWLen) > 0) && authUrl?.length) {
                    // If it still cannot find any, AND there's a link, try pulling more titles from openlibrary
                    // Or, if it found some, but needs more, go ahead and check too
                    const openLibTitles = await getOpenLibTitles({titleIn: rawTitle, authName: toProperCase(authOut[0]), authUrl: authUrl});
                    debugLog("Out from getOpenLibTitles: ", openLibTitles);
                    if (openLibTitles?.length) {
                        // Just add to the list, don't reset/ overwrite it
                        kwTitles.push(...openLibTitles);
                    }
                }
                kwTitles = [...new Set(kwTitles.map(t => toProperCase(t)))];
                debugLog("KW titles to fill with: ", kwTitles);
                if (kwTitles?.length) {
                    const kwTitleMap = kwTitles.map(t => toProperCase(t));
                    const res = await askQuestionV2({
                        question: `I found ${kwTitles.length} titles by ${toProperCase(authOut[0])} to use as keywords.\n${kwTitleMap.join(", ")}\nShould I use them?`,
                        answerList: kwTitleMap,
                        yesNo: true,
                        multiOption: true
                    });
                    if (Array.isArray(res)) {
                        // Got multiple answers back, process em
                        for (const resNum of res) {
                            if (globalKWLen >= 5) break;
                            globalKWLen++;
                            bookInfoArr.push(`kw${globalKWLen}=${kwTitles[resNum]}`);
                        }
                    } else if (["y", "yes"].includes(res.toLowerCase())) {
                        // Just answered yes, add all available titles while possible
                        for (const title of kwTitles) {
                            if (globalKWLen >= 5) break;
                            globalKWLen++;
                            bookInfoArr.push(`kw${globalKWLen}=${title}`);
                        }
                    }
                }
                if (argv.fill) {
                    while (globalKWLen < 5) {
                        globalKWLen += 1;
                        bookInfoArr.push(`KW${globalKWLen}=^f`);
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
                debugLog("jsonOut.pubLocs", jsonOut.publish_places);
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
        let illNum = null;
        if (argv.illustrated) {
            if (typeof argv.illustrated === "boolean") {
                const illRes = await askQuestionV2({
                    question: "What sort of illustrations are they?",
                    answerList: illusOptions,
                    cancel: true
                });
                if (Number.isInteger(parseInt(illRes)) && illusOptions[illRes]) {
                    illNum = parseInt(illRes, 10);
                    bookInfoArr.push(`ILLUS=${illusOptions[illRes]}`);
                }
            } else if (Number.isInteger(parseInt(argv.illustrated)) && illusOptions[argv.illustrated]) {
                bookInfoArr.push(`ILLUS=${illusOptions[argv.illustrated]}`);
                illNum = parseInt(argv.illustrated, 10);
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
        const oldBook = bookLog.find(ob => ob.isbn == isbn);
        const jsonToSave = {
            isbn: isbn,
            title: toProperCase(rawTitle),
            subtitle: subtitle ? toProperCase(subtitle.replace(/^\s*[-:]/, "").trim()) : "",
            authors: authOut.map(au => {
                return {name: toProperCase(au)};
            }),
            keywords: globalKWs,
            publish_date: date?.toString(),
            pages: argv.pages ? argv.pages : "unpaginated",
            price: argv.price,
            binding: argv.binding
        };
        if (argv.french) jsonToSave.french = true;
        if (argv.lp)     jsonToSave.lp     = true;
        if (argv.bc)     jsonToSave.bc     = true;
        if (illNum)      jsonToSave.ill    = illNum;

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
            // TODO Make this better/ let the user choose each difference
            // Should go through each key and compare those rather than the whole thing?
            const jsonToSaveString = JSON.stringify(jsonToSave, null, 4);
            const oldBookString    = JSON.stringify(oldBook, null, 4);
            if (jsonToSaveString !== oldBookString) {
                const keyDiffs = {};
                for (const key of Object.keys(oldBook)) {
                    // Check each key in the old data to see if it's different
                    const oldKeyJson = JSON.stringify(oldBook[key]);
                    const newKeyJson = JSON.stringify(jsonToSave[key]);
                    if (oldKeyJson !== newKeyJson) {
                        keyDiffs[key] = {
                            old: oldBook[key],
                            new: jsonToSave[key]
                        };
                    }
                }
                for (const key of Object.keys(jsonToSave)) {
                    // Check each key in the new data to see if it's different (just in case it has something the old one didn't)
                    if (keyDiffs[key]) continue;    // It's already been checked and logged
                    const oldKeyJson = JSON.stringify(oldBook[key]);
                    const newKeyJson = JSON.stringify(jsonToSave[key]);
                    if (oldKeyJson !== newKeyJson) {
                        keyDiffs[key] = {
                            old: oldBook[key],
                            new: jsonToSave[key]
                        };
                    }
                }
                debugLog("############# KEYDIFFS ############", keyDiffs);
                const keyDiffKeys = Object.keys(keyDiffs);
                if (keyDiffKeys.length) {
                    // Something's different, so go through and ask about each
                    console.log(`I found differences in ${keyDiffKeys.length} fields.\n`);
                    for (const key of Object.keys(keyDiffs)) {
                        const diff = keyDiffs[key];
                        let repRes = null;
                        if (!diff["old"]) {
                            // If there's no old version, so we're comparing a new value to something that isn't there, just take the new one
                            jsonToSave[key] = diff["new"];
                            console.log(`Added new ${key.toUpperCase()} (${diff["new"]})`);
                        } else {
                            repRes = await askQuestionV2({
                                question: `Which of the following ${key.toUpperCase()} should be saved?`,
                                answerList: [`NEW\n${inspect(diff["new"], {depth: 5})}`, `\nOLD\n${inspect(diff["old"], {depth: 5})}`],
                            });
                            const keep = repRes > 0 ? diff["old"] : diff["new"];
                            jsonToSave[key] = keep;
                        }
                    }
                    // The new one was chosen, so get rid of the old one
                    bookLog.splice(bookLog.findIndex(b => b.isbn == isbn), 1);
                    // Stick the new one it
                    bookLog.push(jsonToSave);

                    // Then go ahead and save it as needed
                    const booksToSave = JSON.stringify(bookLog, null, 4);
                    debugLog("JSON to save: ", jsonToSave);
                    await saveBooks(booksToSave);
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


// Check the ISBN that was input, making sure that it's only numbers and a valid length (10 or 13)
function getIsbnFromArg(isbnIn) {
    let outMsg = null;

    // If there's no ISBN
    if (!isbnIn) outMsg = "Invalid ISBN.";

    // Clean the string up to make sure there's no improper characters
    isbnIn = isbnIn.toString().toUpperCase().replace(/[^X\d]/g, "");

    // Make sure it's a valid ISBN format
    // Match 10 digit isbn with or without an x at the end, or 13 digit ones
    if (!isbnIn.match(/^(\d{9}[xX]|\d{10}|\d{13})$/)) outMsg = `Invalid ISBN format (${isbnIn}).`;

    // Make sure it's the correct length
    if (isbnIn.length !== 10 && isbnIn.length !== 13) {
        outMsg = `"${isbnIn}" is not a valid ISBN. (${isbnIn.length} is an invalid isbn length)`;
    }

    // If it's found any issues, go ahead and tell us
    if (outMsg?.length) {
        console.log(outMsg);
        return null;
    }
    return isbnIn;
}

// Process any flags/ arguments that were used to add extra data
async function processArgv() {
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
        const plus = argv.pages.toString().endsWith("+") ? "+" : "";
        if (Number.isInteger(pg)) {
            outArr.push(`PAGES=${pg}${plus}`);
        } else if (argv.pages.toString().toLowerCase() === "u") {
            outArr.push("PAGES=unpaginated");
        }
    } else if (argv.unpaginated) {
        outArr.push("PAGES=unpaginated");
    }

    // Set for hardcover, paperback, or spiral
    argv.binding = [];
    if (argv.hc) {
        outArr.push("BD=HC.");
        argv.binding.push("hc");
    } else if (argv.pb) {
        outArr.push("BD=PB.");
        argv.binding.push("pb");
    } else if (argv.sp) {
        outArr.push("BD=SPIRAL.");
        argv.binding.push("sp");
    }

    // If it's got a DJ
    if (argv.dj) {
        outArr.push("DJ=DJ.");
        argv.binding.push("dj");
    }

    // If the price is given
    const priceReg = /^\d{1,3}\.*\d{0,2}$/;
    if (argv.price?.toString().match(priceReg)) {
        outArr.push("PRICE=" + argv.price);
    } else {
        argv.price = null;
    }

    const condOut = await parseCond();
    if (condOut[1].length) {
        outArr.push(`COND=${condOut[1]}`);
    }
    if (condOut[2].length) {
        outArr.push(`COND2=${condOut[2]}`);
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
                    globalKWs.push(kw);
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

// Work out all the conditions
//
// Just a condition will put the given string in.
// A condition:location string will replace the ${} in a string with the given location.
//  - If there's an empty ${} in the string, and no location is given, it should prompt for one
//  - If there's no ${} and a location is given, it should warn about it, and offer to have one typed in
async function parseCond() {
    const condOut = {1: "", 2: ""};
    const mainCond = "VG";
    const mainDjCond = "VG/VG";
    const endStr = "Pages Clean & Tight.";

    let spiralStr = "";
    let frenchStr = "";
    if (argv.conditions.includes("spc")) spiralStr  = " with spiral comb binding";
    if (argv.conditions.includes("spw")) spiralStr  = " with spiral wire binding";
    if (argv.french)                     frenchStr  = "FRENCH ";
    if (argv.vg)                         manualCond = argv.vg;

    debugLog("[parseCond] argv.conditions: ", argv.conditions);
    debugLog("[parseCond] argv.vg: ", argv.vg);

    if (argv.condition?.length) {
        let startStr = "";
        const conds = [];

        if (argv.pb) {
            // Default condition to start with for pb books
            startStr = `${manualCond ? manualCond : mainCond} IN ${frenchStr}WRAPS${spiralStr}.`;
        } else if (argv.hc && argv.dj) {
            // Default condition to start with for hc books with a dj
            startStr = manualCond ? manualCond : mainDjCond;
        } else if (argv.hc) {
            // Default condition to start with for hc books without a dj
            //  - This will be vg in pictorial boards, cloth, etc
            //  - This is set back at the begining when it asks about board types
            startStr = manualCond ? boardStr.replace("VG", manualCond) : boardStr;
        }
        if (startStr?.length) {
            debugLog("StartStr: ", startStr);
            conds.push(startStr);
        }

        if (argv.conditions?.length) {
            // Go through the condition map and check for matches, so it can keep the
            // conditions in the order specified there
            argv.conditions = argv.conditions.map(condLoc => {
                const [cond, loc] = condLoc.split(":");
                debugLog("[parseCond] cond, loc: ", [cond, loc]);
                return {
                    str: cond,
                    loc: loc
                };
            });
            for (const condition of Object.keys(condMap)) {
                const foundCond = argv.conditions.find(cond => cond.str === condition);
                if (foundCond) {
                    const condStr = condMap[foundCond.str];
                    const match = condStr.match(/\${([^}]*)}/);
                    debugLog("CondStr: " + condStr + ", Match: ", match);
                    if (typeof foundCond?.loc === "string" && !foundCond.loc.length) {
                        // This should trigger if there's a condition with a `:` (cond:)
                        // TODO This should pull up an askQ to let us choose a location
                        // Also, error/ complain like below if there's no spot for a location on that one
                        debugLog("Found cond, but no matchLen", match, foundCond);
                        const condKeys = Object.keys(condLocs);
                        const condLocArr  = condKeys.map(k => condLocs[k]);
                        const res = await askQuestionV2({
                            question: `You did not include a location for \`${condMap[foundCond.str]}\`, please choose one of the following:`,
                            answerList: condLocArr,
                            other: true
                        });

                        debugLog("Looking for cond, res: ", condLocs[condKeys[res]]);

                        if (!otherVals.includes(res)) {
                            foundCond.loc = condLocs[condKeys[res]];
                        } else {
                            // Didn't want one of those, so let's get a custom one
                            foundCond.loc = await askQuestion({
                                query: "What do you want to use for the condition's location?"
                            });
                        }
                    }
                    if (foundCond.loc) {
                        debugLog("Have foundCond.loc: ", foundCond);
                        if (!match) {
                            // TODO This should spit out a message telling us that there's no spot for the location string specified.
                            // Maybe query asking for a custom full string to replace it with?
                            console.log("Missing condition loc for " + inspect(foundCond));
                            // continue;
                        }

                        let thisLoc = condLocs[foundCond.loc];
                        if (!thisLoc) {
                            thisLoc = foundCond.loc;
                        }
                        debugLog("thisLoc: ", thisLoc);
                        conds.push(condStr
                            // Replace the placeholder with the specified location
                            .replace(/\${([^}]*)}/, thisLoc)
                            // Use any "in" / "on" strings that're given
                            .replace(/\{([^}]*)\}/, "$1"));
                    } else {
                        // Just replace any location stuff with the given default chunk
                        conds.push(condStr
                            // Use the placeholder, if any
                            .replace(/\${([^}]*)}/, "$1")
                            // Get rid of any extra strings
                            .replace(/\{[^}]*\}/, ""));
                    }
                }
            }
        }
        conds.push(endStr);
        debugLog("CondsOut: ", conds);

        // See how many of the condition strings can fit into the fields
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
    } else {
        const remStr = argv.remainder ? "REMAINDER MARK.  " : "";

        // Work out some default conditions
        if (argv.pb) {
            // Default condition to start with for pb books
            condOut[1] = `COND=${mainCond} IN ${frenchStr}WRAPS${spiralStr}.  ${remStr}PAGES CLEAN & TIGHT.`;
        } else if (argv.hc && argv.dj) {
            // Default condition to start with for hc books with a dj
            condOut[1] = `COND=${mainDjCond}  ${remStr}PAGES CLEAN & TIGHT.`;
        } else if (argv.hc) {
            // Default condition to start with for hc books without a dj
            //  - This will be for vg in pictorial boards, cloth, etc
            condOut[1] = `COND=${mainCond} IN X BOARDS${spiralStr}.  ${remStr}PAGES CLEAN & TIGHT.`;
        }
    }
    debugLog("[parseCond] condOut: ", condOut);
    return condOut;
}

// Go through and see if there is a matching publisher available
async function getPub(pubName, inLocs=[]) {
    debugLog("[getPub INIT]", {pubName, inLocs});
    let out = {};
    if (inLocs && !Array.isArray(inLocs)) {
        return new Error("[getPub] inLocs needs to be an array!");
    } else if (!inLocs) {
        inLocs = [];
    }
    if (!pubName?.length) {
        return new Error("[getPub] Missing pubName to search for.");
    }
    pubName = pubName.toLowerCase();
    debugLog("[getPub pubName] Searching for: ", pubName);

    // Filter down the list to only include ones that have matching names
    let possiblePubs = pubMap
        // Filter out the names that won't matter
        .map(pub => {
            return {
                name: pub.name.filter(n => n.toLowerCase() === pubName || n.toLowerCase().includes(pubName)),
                locations: pub.locations
            };
        })
        // Then filter out the publishers we don't want
        .filter(pub => {
            if (!pub.name && pub.pub) pub.name = pub.pub;
            if (Array.isArray(pub.name)) {
                if (pub.name.find(n => n.toLowerCase() === pubName || n.toLowerCase().includes(pubName))) {
                    return true;
                }
            } else if (pub.name.toLowerCase().includes(pubName)) {
                return true;
            }
            return false;
        });

    // Then if it cannot find a match in the names, check the aliases
    if (!possiblePubs.length) {
        possiblePubs = pubMap.filter(pub => {
            if (!pub?.aliases) {
                return false;
            }
            const foundPub = pub.aliases.find(a => {
                return pubName.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(pubName.toLowerCase());
            });
            if (foundPub) return true;
        });
        debugLog("[possiblePubs 2] ", {possiblePubs});
    } else {
        debugLog("[possiblePubs 1] ", {possiblePubs});
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
        debugLog("[possiblePubs 3] ", {possiblePubs});
    }

    if (!possiblePubs.length) {
        // if it can't find something with the full name, try with just the first word of the publisher name, since this is often unique enough to work
        possiblePubs = pubMap.filter(pub => {
            let valid = false;
            if (!pub.name && pub.pub) pub.name = pub.pub;

            if (Array.isArray(pub.name)) {
                valid = pub.name.find(n => n.toLowerCase().includes(pubName.split(" ")[0]));
            } else {
                valid = pub.name.toLowerCase().includes(pubName.split(" ")[0]);
            }

            return valid;
        });
        debugLog("[possiblePubs 4] ", {possiblePubs});
    }

    // Make sure there aren't any duplicates in there
    if (possiblePubs?.length) {
        possiblePubs = getUniqueFromObjArray(possiblePubs);
        debugLog("Pubs, After set: ", possiblePubs);
    }
    let pubChoices = [];  // Fill it with objects with name/loc each

    // Go through the matched publishers, and stick them into pubChoices with their possible locations
    debugLog("Possible found pubs: ", possiblePubs);
    for (const pub of possiblePubs) {
        if (Array.isArray(pub.name)) {
            for (const name of pub.name) {
                pubChoices.push({
                    name: name,
                    locations: pub?.locations ? pub.locations : [],
                    new: pub.new ? true : false
                });
            }
        } else {
            pubChoices.push({
                name: pub.name,
                locations: pub?.locations ? pub.location : [],
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
        const pubRes = await askQuestionV2({
            question: "I found the following publishers, which should I use?",
            answerList: pubChoices.map(p => p.name),
            other: true,
            cancel: true
        });
        if (pubChoices[pubRes]) {
            out.pub = pubChoices[pubRes].name;
            if (pubChoices[pubRes]?.locations?.length) {
                inLocs.push(...pubChoices[pubRes].locations);
            }
            if (pubChoices && parseInt(pubRes, 10) === newNum) {
                out.new = true;
            }
            debugLog(`[pubChoices OUT] Chose "${out.pub}": `, out);
        } else if (pubRes.toLowerCase() === "o") {
            // Query for a new name to look for
            const newPub = await askQuestion({query: "What publisher should I search for?", maxLen: MAX_MID_LEN});
            if (!newPub?.length) {
                console.log("No publisher entered.");
                return out;
            }
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
        let question = null;
        if (pub.new) {
            question = `I did not find this publisher: ${pub.name}\nWould you like to use it anyways?`;
        } else {
            question = `I found the publisher: ${pub.name}\nWould you like to use this?`;
        }
        const res = await askQuestionV2({question: question, yesNo: true, cancel: true});
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
        } else if (noVals.includes(res.toLowerCase())) {
            // If that's not what it should be, ask what should be there, then run the search again...
            const newPub = await askQuestion({query: "What publisher should I search for?", maxLen: MAX_MID_LEN});
            out = await getPub(newPub);
            if ((!out.locs && !out.pub) || !out.locs?.length) {
                return out;
            }
            if (out.locs.length === 1) {
                debugLog("Returning just out", out);
                return out;
            } else {
                inLocs.push(...out.locs);
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
            const locRes = await askQuestionV2({
                question: "I found these location(s), which one should I use?",
                answerList: inLocs,
                other: true,
                cancel: true
            });
            if (Number.isInteger(parseInt(locRes)) && inLocs[locRes]) {
                return inLocs[locRes];
            } else if (locRes.toUpperCase() === "O") {
                // Ask for something to search by, and run it through this again with the results from that
                const targetLoc = await askQuestion({query: "What location would you like to look for?", maxLen: MAX_SMALL_MID_LEN });
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
            const locRes = await askQuestionV2({
                question: "I did not find any matching locations, would you like to find one?",
                yesNo: true
            });
            if (["y", "yes"].includes(locRes.toLowerCase())) {
                const targetLoc = await getNewLoc();
                return targetLoc;
            } else {
                return null;
            }
        }
    } else {
        // There were no locations provided, so see if they want to find one
        const locRes = await askQuestionV2({
            question: "There are no provided locations, would you like to find one?",
            yesNo: true
        });
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
    const newLocRes = await askQuestion({query: "What location would you like to look for?", maxLen: MAX_SMALL_MID_LEN });
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
        const noLocRes = await askQuestionV2({
            question: `I did not find any matches for ${newLocRes}, would you like to try again?`,
            yesNo: true,
            use: true
        });
        if (["y", "yes"].includes(noLocRes.toLowerCase())) {
            newLoc = getNewLoc();
        } else if (["u", "use"].includes(noLocRes.toLowerCase())) {
            return newLocRes;
        }
    } else if (possibleLocs.length > 1) {
        // If matched with more than one location
        possibleLocs = [...new Set(possibleLocs.map(loc => toProperCase(loc)))];
        const locChoiceRes = await askQuestionV2({
            question: "I found the following locations, which should I use?",
            answerList: possibleLocs,
            cancel: true,
            other: true
        });
        if (possibleLocs[locChoiceRes]) {
            debugLog("Setting newLoc to ", possibleLocs[locChoiceRes]);
            newLoc = possibleLocs[locChoiceRes];
        } else if (otherVals.includes(locChoiceRes)) {
            newLoc = getNewLoc();
        }
    } else {
        // There's only one match, so check if it's viable
        const oneLocRes = await askQuestionV2({
            question: `I found one match (${possibleLocs[0]}), would you like to use it?`,
            yesNo: true
        });
        if (["y", "yes"].includes(oneLocRes.toLowerCase())) {
            newLoc = possibleLocs[0];
        }
    }
    return newLoc;
}

// If there's no pub given, ask if it's wanted
async function getEmptyPub() {
    let out = {};
    const noRes = await askQuestionV2({
        question: "I did not find any publisher, would you like to find one?",
        yesNo: true
    });
    if (["y", "yes"].includes(noRes.toLowerCase())) {
        const newPub = await askQuestion({query: "What publisher should I search for?", maxLen: MAX_MID_LEN});
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
async function askQuestion({query, maxLen=0}) {
    debugLog("[askQuestion] Q: " + query);
    const prompt = "\n\n> ";
    return new Promise(resolve => rl.question("\n" + query + prompt, line => {
        if (maxLen && line.length > maxLen) {
            console.log(`\nERROR: That answer was too long (${line.length}), max length is ${maxLen}`);
            resolve(askQuestion({query: query, maxLen: maxLen}));
        } else {
            line = cleanString(line);
            resolve(line);
        }
    }));
}


// const chooseOtherStr = "\n[O] Choose other";
// const cancelStr      = "\n[C] Cancel";
// const saveStr        = "\n[S] Save as is";
//
// const cancelVals = ["c", "cancel"];
// const noVals     = ["n", "no"];
// const otherVals  = ["o", "other"];
// const saveVals   = ["s", "save"];
// const useVals    = ["u", "use"];
// const yesVals    = ["y", "yes"];

// Ask a question, with set answers that are expected
async function askQuestionV2({question="", answerList=[], multiOption=false, cancel=false, save=false, other=false, yesNo=false, use=false}) {
    debugLog("[askQuestionV2] inQuestion: ", question);
    debugLog("[askQuestionV2] inAnswerList: ", answerList);
    debugLog("Options: ", {cancel, save, other, yesNo, use});
    let pad = 4;
    let answerLen = answerList.length;
    answerLen += save   ? 1 : 0;
    answerLen += other  ? 1 : 0;
    answerLen += yesNo  ? 1 : 0;
    answerLen += use    ? 1 : 0;
    answerLen += cancel ? 1 : 0;
    if (answerLen > 99) {
        pad = 6;
    } else if (answerLen > 9) {
        pad = 7;
    }

    const answers = [];
    let questionOptions = [];
    if (answerList?.length) {
        questionOptions = [""].concat(answerList.map((ans, ix) => {
            if (ans.indexOf("\n")) {
                ans = ans.split("\n").join("\n".padEnd(pad+1));
            }
            answers.push(ix.toString());
            return `[${ix}]`.padEnd(pad) + ans.trim();
        }));
    }
    if (cancel || save || other || use || yesNo) {
        questionOptions.push("");
        if (save) {
            answers.push(...saveVals);
            questionOptions.push(`${"[S]".padEnd(pad)}Save as is`);
        }
        if (yesNo) {
            answers.push(...yesVals, ...noVals);
            questionOptions.push(`${"[Y]".padEnd(pad)}Yes`);
            questionOptions.push(`${"[N]".padEnd(pad)}No`);
        }
        if (use) {
            answers.push(...useVals);
            questionOptions.push(`${"[U]".padEnd(pad)}Use`);
        }
        if (other) {
            answers.push(...otherVals);
            questionOptions.push(`${"[O]".padEnd(pad)}Choose other`);
        }
        if (cancel) {
            answers.push(...cancelVals);
            questionOptions.push(`${"[C]".padEnd(pad)}Cancel`);
        }
    }
    debugLog("Answers After: ", answers);
    debugLog("QuestionOpts: (What's printed)", questionOptions);

    const prompt = "\n\n> ";

    if (!multiOption) {
        return new Promise((resolve) => {
            rl.question("\n" + question + (questionOptions?.length ? "\n" + questionOptions.join("\n") : "") + prompt, (line) => {
                line = cleanString(line.trim());
                if (answers.indexOf(line.toLowerCase()) > -1) {
                    resolve(line.toLowerCase());
                } else {
                    console.log(line + " is not a valid answer.\nChoose from the following: " + answers.join(", "));
                    resolve(askQuestionV2({question, answers, multiOption, answerList, cancel, save, other, yesNo, use}));
                }
            });
        });
    } else {
        const mutliChoiceStr = `You may choose more than one NUMBERED option (Up to ${5-globalKWLen}), separated by commas.\nIf you choose a non-numbered option, then that will be the only choice used.`;
        return new Promise((resolve) => {
            rl.question("\n" + question + (questionOptions?.length ? "\n" + questionOptions.join("\n") : "") + `\n\n${mutliChoiceStr}\n` + prompt, (line) => {
                line = cleanString(line.trim());
                const answerArr = line.split(",").map(ans => ans.trim());
                const nonNumArr = answerArr.filter(ans => isNaN(parseInt(ans, 10)));
                if (nonNumArr.length && answers.indexOf(nonNumArr[0].toLowerCase()) > -1) {
                    // If any of the chosen options were one of the non-numbered / extras like Other or Yes/No, us the first one of those instead
                    resolve(nonNumArr[0].toLowerCase());
                } else if (answerArr.some(ans => !answers.includes(ans))) {
                    // If any of the chosen options are invalid / not valid, try again
                    console.log("Some of your chosen options are invalid. Please double check your answers");
                    resolve(askQuestionV2({question, answers, multiOption, answerList, cancel, save, other, yesNo, use}));
                } else {
                    // They must all be valid? Let's go ahead and send em through
                    resolve(answerArr);
                }
            });
        });
    }
}

// Clean the control characters out of strings from readline when the arrow keys are pressed
function cleanString(stringIn) {
    stringIn = stringIn.replace(/ø/g, "o"); // Replace this specific character
    stringIn = stringIn
        // Following line is to strip out any mess from hitting movement keys when typing
        .replace(/(\x9B|\x1B\[|\x1B)[0-?]*[ -/]*[@-~]/g, "") // eslint-disable-line no-control-regex
        .replace("½", "1/2")                                 // Replace the ½ symbol with 1/2
        .replace(/(\r\n|\n|\r)/gm,"")                        // Replace all line returns
        .replace(/\s\s+/g, " ")                              // Replace multiple spaces with singles
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");   // Replace accented letters with normal ones
    return stringIn;
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
    const pubIgnoreList = [
        "book",
        "books",
        "ltd",
        "press",
        "publishers",
        "publishing",
        "publications",
    ];
    const namesToFind = newPub.pub.toLowerCase().split(" ")
        .filter(p => !pubIgnoreList.includes(p))
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
        const question = `I found these entries that could match. Would you like to put ${toProperCase(newPub.pub)} into one of these?`;

        const foundRes = await askQuestionV2({question, answerList: foundPubs.map(p => p.name.join("\n")), save: true, cancel: true});
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
    fs.writeFileSync(__dirname + "/data/pubMap.json", pubJson);
}

// Save the bookLog
async function saveBooks(bookJson) {
    if (argv.debug) return false;
    fs.writeFileSync(__dirname + "/data/bookLog.json", bookJson);
}

// Save the authMap
async function saveAuths(authMapJson) {
    if (argv.debug) return false;
    fs.writeFileSync(__dirname + "/data/authMap.json", authMapJson);
}

// Run through all the data to make it all lowercase so it can be put in with caps lock on, then
// save it to the file and run the ahk script to actually put it into Record Manager
async function saveAndRun(infoArr) {
    const bookInfoOut = infoArr
        .map(e => e.toLowerCase())
        .join("\n")
        .replace(/%/g, "`%")
        .replace(/’/g, "'");
    // Write to a file, then pass that to the ahk
    fs.writeFileSync(__dirname + "/bookInfo.txt", bookInfoOut);
    rl.close();
    exec(__dirname + "/bookOut.ahk", (error) => {
        if (error) {
            console.log(error);
        }
    });
}


async function getFromAuthMap(auth, titleIn) {
    debugLog(`[getFromAuthMap] AuthIn: ${auth}, TitleIn: ${titleIn}`);
    // Quick little function to get the most recent x titles from the bookLog file to use in the keyword slots
    auth = auth.toLowerCase();
    const fromMap = bookLog.filter(b => b.authors.some(a => a.name.toLowerCase() === auth));
    // debugLog("[getFromAuthMap] FromMap: ", fromMap);

    let authUrl = null;

    titleIn = titleIn.toLowerCase();

    const titleFilter  = (book) => !book.title.toLowerCase().includes(titleIn) && !titleIn.includes(book.title.toLowerCase());
    const lengthFilter = (book) => book.title.length <= MAX_KW_LEN;
    const dateSort     = (a, b) => parseInt(a.publish_date, 10) < parseInt(b.publish_date, 10) ? 1 : -1;

    // Get any possible previously entered titles that we can use
    const titles = fromMap
        .filter(titleFilter)
        .filter(lengthFilter)
        .sort(dateSort)
        .map(book => book.title.toLowerCase());

    debugLog("Titles after filtering: ", titles);

    // If there are no titles found from the bookLog, resort to checking from authMap
    if (globalKWLen < 5) {
        debugLog("[getFromAuthMap] No titles from BookLog, grabbing from authMap");
        const authMapIndex = Object.keys(authMap).find(au => au.toLowerCase() === auth);
        const authFromMap = authMap[authMapIndex];
        if (authFromMap?.titles) {
            debugLog("[getFromAuthMap] Found from authMap: ", authFromMap);
            titles.push(...authFromMap.titles
                .map(title => title.toLowerCase())
                .filter(title => title !== titleIn)
            );
            if (authFromMap.url) {
                authUrl = authFromMap.url;
            }
        }
    }

    // Use a Set to remove any duplicate titles from the list
    const noDupTitles = [...new Set(titles)];
    const titleOut = {
        titles: noDupTitles.length ? noDupTitles.slice(0, 5-globalKWLen) : [],
    };
    if (authUrl) {
        titleOut.url = authUrl;
    }
    return titleOut;
}

// Function to grab the newset titles from an author's page if the link was provided
async function getOpenLibTitles({titleIn, authName, authUrl}) {
    debugLog(`[getOpenLibTitles] titleIn: ${titleIn}, authName: ${authName}, authUrl: ${authUrl}`);

    // If there are other titles already registered there, don't try getting more / overwriting em
    if (authMap[authName]?.titles?.length) return null;

    authUrl = authUrl + "?sort=new";
    debugLog("Checking: ", authUrl);
    const pageHTML = await fetch(authUrl).then(async res => await res.text());
    const $ = cheerio.load(pageHTML);

    const titleList = $(".list-books > .searchResultItem").toArray().map((elem) => {
        let title = $(".resultTitle > h3 > a", elem).text().trim().replace(/^(a |an |the )/i, "").trim().toLowerCase();
        title = title.split(":")[0]; // If there's a subtitle, don't keep itself
        const authors = $(".bookauthor > a", elem).toArray().map(a => $(a).text());
        if (authors.length > 1) {
            // There's more than just the main author, so probably an anthology that I don't want
            return null;
        }
        return title;
    }).filter(a => !!a);

    debugLog("[getOpenLibTitles] titleList: ", titleList);

    const titleFilter  = (bookTitle) => !bookTitle.toLowerCase().includes(titleIn.toLowerCase()) && !titleIn.toLowerCase().includes(bookTitle.toLowerCase());
    const lengthFilter = (bookTitle) => bookTitle.length <= MAX_KW_LEN;
    const commaFilter  = (bookTitle) => !bookTitle.includes(",");

    const filteredTitleList = titleList
        .filter(titleFilter)
        .filter(lengthFilter)
        .filter(commaFilter)
        .map(bookTitle => bookTitle.toLowerCase().trim());

    debugLog("[getOpenLibTitles] filteredTitleList: ", filteredTitleList);

    const noDupTitles = [...new Set(filteredTitleList)];
    if (!noDupTitles?.length) return null;

    // If we're here, then we don't have any other titles to go off of, so save these to the authmap
    if (!authMap[authName]) {
        authMap[authName] = {};
    }
    authMap[authName].titles = noDupTitles.map(t => cleanString(toProperCase(t)));
    if (!authMap[authName]?.url) {
        authMap[authName].url = authUrl;
    }
    await saveAuths(JSON.stringify(authMap, null, 4));

    return noDupTitles;
}


// Parse the title from what's given, as well as subtitle
function parseTitle(titleIn, subtitleIn, isBookClub, isLargePrint, manualSub) {
    if (!titleIn?.length) {
        throw new Error("[parseTitle] Missing title");
    }
    let title = titleIn
        .replace(/^the /i, "")          // Replace "the " at the beginning of titles
        .replace(/^a /i, "")            // Replace "a " at the beginning of the titles
        .replace(/^an /i, "");          // Replace "an " at the beginning of the titles
    title = cleanString(title);

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
            .replace(/a novel/i, "")
            .trim();
        if (!subtitle.trim()?.length) {
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
            if (!subtitle.trim()?.length) {
                subtitle = ": a novel";
            } else {
                subtitle += " - a novel";
            }
        }
    }

    return {
        fullTitle: `${title}${subtitle}${extraString}`,
        subtitle: subtitle,
        extra: extraString,
        rawTitle: title
    };
}

// If a book is not found from the api or stored info, ask for the info manually
async function findInfoForBlank(isbn) {
    console.log("\nNo info was found for this book.\n");

    const newJsonOut = {
        isbn: isbn
    };

    // Grab the year it was published
    const dateRes = await askQuestion({query: "What year was this published? Must be in YYYY format.", maxLen: 4});
    if (dateRes.match(/^\d{4}$/) && parseInt(dateRes, 10) > 0 && parseInt(dateRes, 10) <= new Date().getFullYear()) {
        newJsonOut.publish_date = dateRes;
    }

    // Grab the title, and subtitle, if viable
    const titleRes = await askQuestion({query: "What is the title of this book? If there's a subtitle, it will grab everything after a \":\"" });
    if (titleRes?.length) {
        const [thisTitle, ...thisSub] = titleRes.split(":");
        newJsonOut.title = thisTitle.trim();
        if (Array.isArray(thisSub) && thisSub.length) {
            newJsonOut.subtitle = thisSub.join(":").trim();
        }
    }

    // Grab whatever author(s)
    const authRes = await askQuestion({query: "What authors go with this book? (Authors will be split by commas)" });
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

// Return the given array, but with no duplicates
// Based on one of the comments from this post: https://stackoverflow.com/a/36744732
function getUniqueFromObjArray(arrIn) {
    return arrIn.filter((object,index) => index === arrIn.findIndex(obj => JSON.stringify(obj) === JSON.stringify(object)));
}

// Like camel-case but with spaces
function toProperCase(stringIn) {
    const ignoreList = ["a", "an", "and", "for", "if", "is", "of", "the"];

    if (!stringIn?.length) {
        return stringIn;
    }

    // Then go through and do so for each following word (Excluding the strings specified)
    stringIn = stringIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        if (ignoreList.includes(txt.trim().toLowerCase())) {
            return txt.toLowerCase();
        }
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    // Make sure the 1st word is capitalized
    return stringIn.charAt(0).toUpperCase() + stringIn.substr(1);
}

// Check against other names in case we're given the wrong one.
async function checkPseudonyms(nameIn) {
    if (!nameIn?.length) return new Error("[checkPseudonyms] Missing name input.");
    if (typeof nameIn !== "string") return new Error("[checkPseudonyms] Input must be a string.");

    for (const authArr of pseudonyms) {
        if (authArr.map(au => au.toLowerCase()).includes(nameIn.toLowerCase())) {
            debugLog("[checkPseudonyms] Checking auths: ", authArr);
            const qAnswer = await askQuestionV2({
                question: "This author writes under multiple names. Which one is used here?",
                answerList: authArr
            });
            debugLog("[checkPseudonyms] Answered: ", authArr[qAnswer]);

            return authArr[qAnswer];
        }
    }
}

async function getBoards() {
    const boardTypes = [
        "cloth boards",
        "leatherette binding",
        "padded brown leatherette with gilt lettering",     // Pretty much for the louis l'amour leatherettes
        "pictorial boards",
        "spiral binding",
    ];
    const boardRes = await askQuestionV2({
        question: "The book is a HC without a DJ. Which, if any of the following should I use?",
        answerList: boardTypes,
        other: true,
        cancel: true
    });

    if (boardTypes[boardRes]) {
        return boardStr.replace("X", boardTypes[boardRes]);
    } else if (otherVals.includes(boardRes)) {
        const newBoardRes = await askQuestion({query: "What would you like to replace the X in `VG IN X` with?", maxLen: MAX_LEN-"VG IN .".length});
        if (newBoardRes?.length) {
            if ((newBoardRes.length + boardStr.length - 1) > MAX_LEN) {
                console.log(`Invalid string, your board condition can only be a max of ${MAX_LEN} long, including the base of "VG IN ."`);
                return null;
            } else {
                return boardStr.replace("X", newBoardRes);
            }
        }
    }
}




