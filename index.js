const fetch = require("node-fetch");
const fs = require("fs");
const { inspect } = require("util");  // eslint-disable-line no-unused-vars
const { exec } = require("child_process");

const readline = require("readline");


const argv = require("minimist")(process.argv.slice(2), {
    alias: {
        i: "isbn",    // ISBN (Alternative to the one that brings up the info)
        d: "dj",      // Dust Jacket

        // Bindings
        h: "hc",      // Hardcover
        p: "pb",      // Paperback
        sp: "sp",     // Spiral Binding

        // Editions
        bc: "bc",     // Book Club
        lp: "lp",     // Large Print

        f: "first",   // 1st Printing
        l: "later",   // Later Printing

        // Pages
        pg: "pages",        // Specify the page count
        u: "unpaginated",   // Set the pages as unpaginated

        // Other
        kw: "keywords",     // Stick some keywords into the keyword slots
        debug: "debug",     // Don't actually run the ahk script, just print the output
        help: "help",       // Print out the help info, don't do anything else
        n: "novel",         // Tack `: a novel` onto the title
        pr: "price",        // Set the price
        pub: "publisher",   // Give it a publisher to prioritize looking for
    }
});

const helpArr = [
    "Usage: node index.js <isbn> [options]",
    "",
    "Options:",
    "  -i, --isbn <isbn>    Use this alternative ISBN",
    "  -d, --dj             Mark that this book has a dust jacket",
    "",
    "Bindings",
    "  -h, --hc             Mark this as a hardcover book",
    "  -p, --pb             Mark this as a paperback book",
    "  --sp                 Mark this as a spiral bound book",
    "",
    "Special versions",
    "  --bc                 Mark this as a book club book",
    "  --lp                 Mark this as a large print book",
    "",
    "Printing / Edition",
    "  -f, --first [prt #]  Mark this as a 1st - 9th printing",
    "  -l, --later          Mark this as a later printing",
    "",
    "Pages",
    "  --pg <pages>         Set the page count",
    "  -u, --unpaginated    Mark this as unpaginated",
    "",
    "Other",
    "  --debug              Tell it to log the info instead of sending it to RM",
    "  --help               Print this usage info",
    "  -kw, --keywords      Put in some of the keywords (Comma separated only)",
    "  --pr <price>         Set the price",
    "  --pub <publisher>    Specify a publisher to try and match/ use",
    "  -n, --novel          Specify to tack `: a novel` onto the end if not there",
];


// Mapping the keywords so they're usable
const kwMap = {
    chi: "Children's Books",
    cri: "Crime Fiction",
    fan: "Fantasy",
    fic: "Fiction",
    hfi: "Historical Fiction",
    hor: "Horror",
    juv: "Juvenile",
    lit: "Literature",
    mys: "Mystery & Suspense",
    pic: "Picture Books",
    poe: "Poetry",
    rom: "Romance",
    sci: "Science",
    sfi: "Science Fiction",
    tee: "Teen Fiction",
    thr: "Thrillers",
    xfi: "Christian Fiction",
    wes: "Westerns",
    ww2: "World War II",
    ya:  "Young Adult"
};

if (argv.help) {
    return console.log(helpArr.join("\n"));
}

if (argv.debug) {
    console.log(`ArgV: \n${inspect(argv)}\n\n`);
}

const isbn = process.argv[2];
const {pubMap} = require("./pubMap.js");
let pubLocs = [];
const bookInfoArr = processArgv();

if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) return console.log("Invalid isbn length");

const API_URL = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;

let jsonOut = null;
async function init() {
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
            const title = jsonOut.title
                .replace(/^the /i, "")          // Replace "the " at the beginning of titles
                .replace(/^a /i, "")            // Replace "a " at the beginning of the titles
                .replace(/(\r\n|\n|\r)/gm,"")   // Replace all line returns
                .replace(/\s\s+/g, " ");        // Replace multiple spaces with singles

            let subtitle = jsonOut.subtitle ? ": " + jsonOut.subtitle : "";
            const bcString = " - book club edition";
            const lpString = " - large print edition";
            const bclpString = " - large print book club edition";
            let extraString = "";
            if (argv.bc && argv.lp) {
                extraString = bclpString;
            } else if (argv.bc) {
                extraString = bcString;
            } else if (argv.lp) {
                extraString = lpString;
            }
            if (title.indexOf("a novel")) {
                title.replace(/a novel/i, "");
                if (!subtitle?.length) {
                    subtitle = ": a novel";
                }
            } else if (argv.novel) {
                if (!subtitle?.length) {
                    subtitle = ": a novel";
                } else {
                    subtitle += " - a novel";
                }
            }
            bookInfoArr.push(`TITLE=${title}${subtitle}${extraString}`);
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

        if (argv.publisher) {
            const chosenName = await getPub(argv.publisher);
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
        } else if (jsonOut.publishers?.length && !argv.publisher) {
            const pubName = jsonOut.publishers[0].name;
            if (jsonOut.publish_places?.length) {
                pubLocs.push(...jsonOut.publish_places.map(loc => loc.name));
            }

            // TODO Work out how to do handle multiple matches
            const chosenName = await getPub(pubName);
            if (chosenName) {
                // If we found a publisher name for it, stick that in then figure out a location
                bookInfoArr.push(`PUB=${chosenName}`);

                // Format all the locations and make sure there aren't duplicates
                const stateRegex = /, [a-z]{2}$/i;
                const longStateRegex = /, [a-z]{3}$/i;
                if (pubLocs.length) {
                    pubLocs = pubLocs.map(loc => {
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
                }
                pubLocs = [...new Set(pubLocs)];

                // If there is more than one location, let em choose
                if (pubLocs.length > 1) {
                    const locRes = await askQuestion(`I found these location(s): \n\n${pubLocs.map((loc, ix) => `[${ix}] ${loc}`).join("\n")} \n\nWhich one should I use? (N to cancel) \n`);
                    if (Number.isInteger(parseInt(locRes)) && pubLocs[locRes]) {
                        bookInfoArr.push(`LOC=${pubLocs[locRes]}`);
                    }
                } else if (pubLocs.length === 1) {
                    bookInfoArr.push(`LOC=${pubLocs[0]}`);
                }
            }
        }

        if (jsonOut.publish_date) {
            const date = new Date(jsonOut.publish_date).getUTCFullYear();
            bookInfoArr.push(`PUBDATE=${date}`);
        }


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


        // TODO See if I can get a list of the author's books to stick in the keywords, as well as grab the subjects they
        // give and offer them up, mapped against what we actually use (Apparently not available through this API, so not sure if doable)

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
            const chosenName = await getPub(argv.publisher);
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
function processArgv() {
    const outArr = [];
    // Anything to be put in the edition field
    if (argv.bc) {
        // It's a book club book, so need to put that in the edition slot
        outArr.push("EDITION=BOOK CLUB");
    } else if (argv.later) {
        // It's a large print edition, so put that in the edition slot
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

    if (argv.keywords) {
        const keywords = argv.keywords.split(",");
        if (keywords.lengh > 5) return console.log("You can only have 5 keywords MAX.");

        let ix = 1;
        for (const kw of keywords.map(k => k.toLowerCase())) {
            // Check against a list of em somewhere up top
            // If found, stick it in, else continue, maybe log it?
            if (Object.keys(kwMap).indexOf(kw) > -1) {
                outArr.push(`KW${ix}=${kwMap[kw]}`);
                ix += 1;
            }
        }
    }

    return outArr;
}

// Go through and see if there is a matching publisher available
async function getPub(pubName) {
    for (const pub of pubMap) {
        if (pub.aliases.filter(a => pubName.toLowerCase().includes(a.toLowerCase())).length) {
            if (Array.isArray(pub.name)) {
                const pubRes = await askQuestion(`I found the following publishers, which should I use?\n\n${pub.name.map((p, ix) => `[${ix}] ${p}`).join("\n")}\n`);
                if (pub.name[pubRes]) {
                    pubName = pub.name[pubRes];
                }
            } else {
                pubName = pub.name;
            }

            // Chose a location out of the possible options
            if (pub.locations.length === 1) {
                pubLocs.push(pub.locations[0]);
            } else if (pub.locations.length > 1) {
                pubLocs.push(...pub.locations);
            }
            break;
        }
    }

    const res = await askQuestion(`I found the publisher: ${pubName} \nDo you want to use this? (Y)es/ (N)o/ (C)ancel\n`);
    if (["y", "yes"].includes(res.toLowerCase())) {
        return pubName;
    } else if (["c", "cancel"].includes(res.toLowerCase())) {
        return null;
    } else {
        // If that's not what it should be, ask what should be there, then run the search again...
        // This means sticking the publisher search stuff above into a function
        const newPub = await askQuestion("What publisher should I search for?\n");
        pubName = await getPub(newPub);
    }
    return pubName;
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
    await fs.writeFileSync("./bookInfo.txt", bookInfoOut);
    exec("C:/Users/Other/Desktop/Jeff/Fiddling/nodeAHK/bookOut.ahk", (error, stdout, stderror) => {
        console.log(error, stdout, stderror);
    });
}

















