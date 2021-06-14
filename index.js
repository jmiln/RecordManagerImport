const fetch = require("node-fetch");
const fs = require("fs");
const { inspect } = require("util");  // eslint-disable-line no-unused-vars
const { exec } = require("child_process");

const readline = require("readline");

const helpArr  = require("./data/helpOut.js");
const kwMap    = require("./data/keywordMap.js");
const pubMap = require("./data/pubMap.js");

const argv = require("minimist")(process.argv.slice(2), {
    alias: {
        i: "isbn",    // ISBN (Alternative to the one that brings up the info)
        d: "dj",      // Dust Jacket

        // Bindings
        h: "hc",      // Hardcover
        p: "pb",      // Paperback
        sp: "sp",     // Spiral Binding
        fr: "french", // French Wraps

        // Editions
        bc: "bc",     // Book Club
        lp: "lp",     // Large Print

        f: "first",   // 1st Printing
        l: "later",   // Later Printing

        // Pages
        pg: "pages",        // Specify the page count
        u: "unpaginated",   // Set the pages as unpaginated

        // Other
        cond: "condition",  // Flag for condition strings
        kw: "keywords",     // Stick some keywords into the keyword slots
        debug: "debug",     // Don't actually run the ahk script, just print the output
        help: "help",       // Print out the help info, don't do anything else
        fill: "fill",       // Fill in the extra keyword slots with previous entries (ctrl+f) if available
        ill: "illustrated", // If it has illustrations, pop up the menu to ask what kind
        n: "novel",         // Tack `: a novel` onto the title
        pr: "price",        // Set the price
        pub: "publisher",   // Give it a publisher to prioritize looking for
        rem: "remainder",   // Mark that it has a remainder mark
        rep: "repeat",      // Try to repeat given args (kw, pr, pg, etc...)
        sub: "subtitle",    // Stick in a subtitle manually
    }
});


if (argv.help) {
    return console.log(helpArr.join("\n"));
}

if (argv.debug) {
    console.log(`ArgV: \n${inspect(argv)}\n\n`);
}

const isbn = process.argv[2];

if (!isbn) {
    return console.log("Missing ISBN.");
} else if (isbn.length !== 10 && isbn.length !== 13) {
    return console.log(`"${isbn}" is not a valid ISBN. (Invalid isbn length)`);
}

const API_URL = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn.toString().toUpperCase()}&jscmd=data&format=json`;

let jsonOut = null;
async function init() {
    const oldArgs = await readOld();
    const bookInfoArr = processArgv(oldArgs);

    await fetch(API_URL)
        .then((res) => res.json())
        .then((json) => jsonOut = json)
        .catch((err) => console.log(err));

    if (jsonOut && Object.keys(jsonOut).length) {
        // Format all the info as it will be needed, ex:
        // ISBN=123123123131
        // TITLE=wheel of time
        // AUTHOR=jordan, robert
        //
        // Take off "the", "a", etc from the start of titles, put the authors' last name first,
        // lowercase everything, since caps will be on, and we want it all caps (Unless it's an edited by or illustrated or something)

        let isbn = null;
        if (Object.keys(jsonOut).length === 1) {
            isbn = Object.keys(jsonOut)[0].split(":")[1];
            jsonOut = jsonOut[Object.keys(jsonOut)[0]];
        }
        if (jsonOut.title) {
            const titleOut = parseTitle(jsonOut.title, jsonOut.subtitle, argv.bc, argv.lp, argv.subtitle);
            bookInfoArr.push(`TITLE=${titleOut}`);
        }

        if (jsonOut.authors && jsonOut.authors.length) {
            let authStr = "";

            // Make sure that there are no duplicates
            const authSet = new Set(jsonOut.authors.map(a => a.name));
            const authArr = [...authSet];

            for (const auth of authArr) {
                const name = auth.split(" ");
                if (authStr.length) {
                    // There's already an author there
                    authStr += `; ${name[name.length-1]}, ${name.slice(0, name.length-1).join(" ")}`;
                } else {
                    // This is the first name
                    authStr = `${name[name.length-1]}, ${name.slice(0, name.length-1).join(" ")}`;
                }
            }
            bookInfoArr.push(`AUTHOR=${authStr}`);
        }

        if (argv.publisher && argv.publisher?.length) {
            const {pub: chosenName, loc: pubLoc} = await getPub(argv.publisher);
            if (chosenName) {
                bookInfoArr.push(`PUB=${chosenName}`);
                if (pubLoc) {
                    bookInfoArr.push(`LOC=${pubLoc}`);
                }
            }
        } else if (jsonOut.publishers?.length && !argv.publisher) {
            const pubName = jsonOut.publishers[0].name;
            let inLocs = null;
            if (jsonOut.publish_places?.length) {
                inLocs = jsonOut.publish_places.map(loc => loc.name);
            }

            const {pub: chosenName, loc: pubLoc} = await getPub(pubName, inLocs);
            if (chosenName) {
                bookInfoArr.push(`PUB=${chosenName}`);
                if (pubLoc) {
                    bookInfoArr.push(`LOC=${pubLoc}`);
                }
            }
        } else {
            // There's no pub given/ found, so ask
            const {pub: chosenName, loc: pubLoc} = await getEmptyPub();
            if (chosenName) {
                bookInfoArr.push(`PUB=${chosenName}`);
                if (pubLoc) {
                    bookInfoArr.push(`LOC=${pubLoc}`);
                }
            }
        }

        if (jsonOut.publish_date) {
            const date = new Date(jsonOut.publish_date).getUTCFullYear();
            bookInfoArr.push(`PUBDATE=${date}`);
        }

        if (argv.illustrated) {
            const illusOptions = require("./data/illustrations.js");
            const illRes = await askQuestion(`What sort of illustrations are they?\n\n${illusOptions.map((ill, ix) => `[${ix}] ${ill}`).join("\n")} \n\n`);
            if (Number.isInteger(parseInt(illRes)) && illusOptions[illRes]) {
                bookInfoArr.push(`ILLUS=${illusOptions[illRes]}`);
            }
        }

        // This is where it'll work out the ISBN
        if (jsonOut.identifiers) {
            const ident = jsonOut.identifiers;
            if (argv.isbn) {
                isbn = argv.isbn.toString();
            }
            if (isbn && (isbn.length === 10 || isbn.length === 13)) {
                bookInfoArr.push(`ISBN${isbn.length}=${isbn}`);
            } else if (ident.isbn_13?.length) {
                bookInfoArr.push(`ISBN13=${ident.isbn_13[0]}`);
            } else if (ident.isbn_10?.length) {
                bookInfoArr.push(`ISBN10=${ident.isbn_10[0]}`);
            }
        }

        // if I have it set to debug, just return and print out what would go through
        if (argv.debug) {
            console.log(bookInfoArr);
            return;
        }

        await saveAndRun(bookInfoArr);
    } else {
        // This will offer to input the data you've provided if it cannot find more.
        // This being ISBN, maybe edition, maybe hc/pb/dj, as well as 1 for the quantity, and whatever else is added in the future
        console.log("No valid book found.");
        if (isbn && (isbn.length === 10 || isbn.length === 13)) {
            bookInfoArr.push(`ISBN${isbn.length}=${isbn}`);
        }

        if (argv.publisher) {
            const {pub: chosenName, locs: pubLocs} = await getPub(argv.publisher);
            if (chosenName) {
                bookInfoArr.push(`PUB=${chosenName}`);
            }
            if (pubLocs.length > 1) {
                const locRes = await askQuestion(`I found these location(s): \n\n${pubLocs.map((loc, ix) => `[${ix}] ${loc}`).join("\n")} \n\nWhich one should I use? (N to cancel) \n`);
                if (Number.isInteger(parseInt(locRes)) && pubLocs[locRes]) {
                    bookInfoArr.push(`LOC=${pubLocs[locRes]}`);
                }
            } else if (pubLocs.length === 1) {
                bookInfoArr.push(`LOC=${pubLocs[0]}`);
            }
        }

        if (argv.debug) {
            console.log(bookInfoArr);
            return;
        }

        // Check if the info is correct, and if it should be run through to stick in RM
        const procRes = await askQuestion(`\n\n${bookInfoArr.join("\n")}\n\nGiven the previous info, should I put in what I know? (Y)es / (N)o\n`);
        if (["y", "yes"].includes(procRes.toLowerCase())) {
            await saveAndRun(bookInfoArr);
        }
    }
}
init();


// Process any flags/ arguments that were used to add extra data
function processArgv(oldArgs) {
    const outArr = [];

    if (argv.repeat) {
        const reps = argv.repeat.split(",");
        for (const rep of reps.map(r => r.toLowerCase())) {
            if (rep === "kw" && oldArgs.kw) {
                argv.keywords = oldArgs.kw;
            } else if (rep === "pr" && oldArgs.pr) {
                argv.price = oldArgs.pr;
            } else if (rep === "pg" && oldArgs.pg) {
                argv.pages = oldArgs.pg;
            } else if (rep === "pub" && oldArgs.pub) {
                argv.publisher = oldArgs.pub;
            } else if (rep === "ill" && oldArgs.ill) {
                argv.illustrated = oldArgs.ill;
            }
        }
    }

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
        const MAX_LEN = 64;

        if (argv.pb) {
            // Default condition to start with for pb books
            startStr = `VG IN ${frenchStr}WRAPS.`;
        } else if (argv.hc && argv.dj) {
            // Default condition to start with for hc books with a dj
            startStr = "VG/VG";
        } else if (argv.hc) {
            // Default condition to start with for hc books without a dj
            //  - This will be vg in pictorial boards, cloth, etc
            startStr = "VG IN X BOARDS.";
        }
        if (startStr?.length) {
            conds.push(startStr);
        }

        if (typeof argv.condition === "string") {
            const conditions = argv.condition.split(",").map(c => c.toLowerCase());

            // Go through the condition map and check for matches, so it can keep the
            // conditions in the order specified there
            for (const condition of Object.keys(condMap)) {
                if (conditions.indexOf(condition) > -1) {
                    conds.push(condMap[condition]);
                }
            }
        }
        conds.push(endStr);

        // See how many of the condition strings can fit into the fields
        const condOut = {1: "", 2: ""};
        let maxFirst = false; // If it needs to go into the 2nd, don't keep putting stuff into the first
        for (const cond of conds) {
            if (condOut[1].length + cond.length < MAX_LEN && !maxFirst) {
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
                }
            }
        }

        if (argv.fill) {
            while (ix <= 5) {
                outArr.push(`KW${ix}=^f`);
                ix += 1;
            }
        }
    }

    return outArr;
}

// Go through and see if there is a matching publisher available
async function getPub(pubName, inLocs) {
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

    // Filter down the list to only include ones that have matching aliases (May need to change this in the future)
    let possiblePubs = pubMap.filter(pub => pub.aliases.find(a => pubName.includes(a.toLowerCase())));

    // If it cannot find an alias that matches just right, try searching the aliases to see if any of them include the given string
    if (!possiblePubs.length) {
        possiblePubs = pubMap.filter(pub => pub.aliases.find(a => a.toLowerCase().includes(pubName)));
    }

    // Then if somehow, it cannot find a match in the aliases, check the names
    if (!possiblePubs.length) {
        possiblePubs = pubMap.filter(pub => {
            let valid = false;
            if (Array.isArray(pub.name)) {
                valid = pub.name.find(n => n.toLowerCase().includes(pubName));
            } else {
                valid = pub.name.toLowerCase().includes(pubName);
            }
            return valid;
        });
    }

    const pubChoices = [];  // Fill it with objects with name/loc each

    // Go through the matched publishers, and stick them into pubChoices with their possible locations
    for (const pub of possiblePubs) {
        if (Array.isArray(pub.name)) {
            for (const name of pub.name) {
                pubChoices.push({
                    name: name,
                    locations: pub.locations
                });
            }
        } else {
            pubChoices.push({
                name: pub.name,
                locations: pub.locations
            });
        }
    }

    // If there were matches, work through those and spit out the choices
    if (pubChoices?.length) {
        const OTHER_NUM = pubChoices.length;
        const chooseOtherStr = `\n[${OTHER_NUM}] Choose other`;

        const CANCEL_NUM = pubChoices.length+1;
        const cancelStr = `\n[${CANCEL_NUM}] Cancel`;

        const pubRes = await askQuestion(`I found the following publishers, which should I use?\n\n${pubChoices.map((p, ix) => `[${ix}] ${p.name}`).join("\n")}\n${chooseOtherStr}${cancelStr}\n\n`);
        if (pubChoices[pubRes]) {
            out.pub = pubChoices[pubRes].name;
            inLocs.push(...pubChoices[pubRes].locations);
        } else if (parseInt(pubRes, 10) === OTHER_NUM) {
            const newPub = await askQuestion("What publisher should I search for?\n");
            out = await getPub(newPub);
            if (out.locs) {
                inLocs.push(...out.locs);
            }
        } else if (parseInt(pubRes, 10) === CANCEL_NUM) {
            out.pub = null;
        }
    }

    // If it does not successfully find a publisher, ask if it should look for another, and get a new name to try
    if (!out.pub?.length) {
        const noRes = await askQuestion(`I did not find any matches for ${pubName}, would you like to try again? (Y)es / (N)o\n`);
        if (["y", "yes"].includes(noRes.toLowerCase())) {
            const newPub = await askQuestion("What publisher should I search for?\n");
            out = await getPub(newPub);
            if (out.locs?.length) {
                inLocs.push(...out.locs);
            }
        } else {
            out.pub = null;
            out.locs = null;
        }
    }

    // If there were any locations found for whatever publisher, format em and see which is correct
    if (inLocs?.length) {
        const stateRegex = /, [a-z]{2}$/i;
        const longStateRegex = /, [a-z]{3,4}\.*$/i;
        inLocs = inLocs.map(loc => {
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

        let outLoc = null;
        out.locs = inLocs;

        // If there is more than one location, let em choose
        if (inLocs?.length > 1) {
            const locRes = await askQuestion(`I found these location(s): \n\n${inLocs.map((loc, ix) => `[${ix}] ${loc}`).join("\n")} \n\nWhich one should I use? (N to cancel) \n`);
            if (Number.isInteger(parseInt(locRes)) && inLocs[locRes]) {
                outLoc = inLocs[locRes];
            }
        } else if (inLocs?.length === 1) {
            outLoc = inLocs[0];
        }
        out.loc = outLoc;
    }

    return out;
}

// If there's no pub given, ask if it's wanted
async function getEmptyPub() {
    let out = {};
    const noRes = await askQuestion("I did not find any publisher, would you like to find one? (Y)es / (N)o\n");
    if (["y", "yes"].includes(noRes.toLowerCase())) {
        const newPub = await askQuestion("What publisher should I search for?\n");
        out = await getPub(newPub);
    } else {
        out.pub = null;
        out.locs = null;
    }
    return out;
}


// Ask a question/ prompt and wait for the reply
async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
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
    await exec(__dirname + "/bookOut.ahk", (error, stdout, stderror) => {
        console.log(error, stdout, stderror);
    });
}


async function readOld() {
    const bookInfoIn = await fs.readFileSync(__dirname + "/bookInfo.txt", "utf-8");
    const outObj = {};
    const bookInfo = bookInfoIn.split("\n");

    const kw = [];

    for (const row of bookInfo) {
        const [key, value] = row.split("=");
        if (key.startsWith("kw")) {
            const kwKey = Object.keys(kwMap).find(k => kwMap[k].toLowerCase() === value);
            if (kwKey) {
                kw.push(kwKey);
            }
        } else if (key === "pages") {
            outObj.pages = value;
            outObj.pg = value;
        } else if (key === "edition") {
            if (value === "later printing") {
                outObj.lp = true;
            } else if (value === "book club") {
                outObj.bc = true;
            } else if (value.match(/\d{1,2}[a-z]{2} printing/)) {
                const prt = parseInt(value.substr(0,1));
                if (prt === 1) {
                    outObj.f = true;
                } else {
                    outObj.f = prt;
                }
            }
        } else if (key === "pub") {
            outObj.publisher = value;
            outObj.pub = value;
        } else if (key === "price") {
            outObj.price = value;
            outObj.pr = value;
        }
    }

    if (kw.length) {
        outObj.keywords = kw.join(",");
        outObj.kw = kw.join(",");
    }

    return outObj;
}


function parseTitle(titleIn, subtitleIn, isBookClub, isLargePrint, manualSub) {
    if (!titleIn?.length) {
        throw new Error("[parseTitle] Missing title");
    }
    let title = titleIn
        .replace(/^the /i, "")          // Replace "the " at the beginning of titles
        .replace(/^a /i, "")            // Replace "a " at the beginning of the titles
        .replace(/(\r\n|\n|\r)/gm,"")   // Replace all line returns
        .replace(/\s\s+/g, " ")         // Replace multiple spaces with singles
        .replace(/[éè]+/g, "e");        // Replace accented E's with a normal one

    const bcString = " - book club edition";
    const lpString = " - large print edition";
    const bclpString = " - large print book club edition";
    let extraString = "";

    let subtitle = subtitleIn ? ": " + subtitleIn : "";

    if (isBookClub && isLargePrint) {
        extraString = bclpString;
    } else if (isBookClub) {
        extraString = bcString;
    } else if (isLargePrint) {
        extraString = lpString;
    }
    if (manualSub && !subtitle?.length) {
        subtitle = manualSub;
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

    return `${title}${subtitle}${extraString}`;
}













