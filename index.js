const fetch = require("node-fetch");
const fs = require("fs");
// const {inspect} = require("util");
const {exec} = require("child_process");

const readline = require("readline");

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

const argv = require("minimist")(process.argv.slice(2), {
    alias: {
        i: "isbn",  // ISBN (Alternative to the one that brings up the info)
        d: "dj",    // Dust Jacket
        h: "hc",    // Hardcover
        p: "pb",    // Paperback
        b: "bc",    // Book Club
        l: "lp",    // Large Print
    }
});

const isbn = process.argv[2];
const pubMap = [
    {
        name: "Alfred A. Knopf",
        aliases: ["Knopf", "Alfred"],
        locations: ["New York"]
    },
    {
        name: "Bantam Books",
        aliases: ["Bantam"],
        locations: ["New York"]
    },
    {
        name: "Bethany House Publishers",
        aliases: ["Bethany House"],
        locations: ["Minneapolis, MN."]
    },
    {
        name: "Del Rey/Ballantine",
        aliases: ["Del Rey"],
        locations: ["New York"]
    },
    {
        name: "Disney / Hyperion",
        aliases: ["Miramax", "Disney"],
        locations: ["New York"]
    },
    {
        name: "Daw Books, inc.",
        aliases: ["DAW"],
        locations: ["New York"]
    },
    {
        name: "Donald M. Grant",
        aliases: ["Grant"],
        locations: ["Hampton Falls, NH."]
    },
    {
        name: "Ecco / Harper-Collins",
        aliases: ["Ecco"],
        locations: ["New York"]
    },
    {
        name: "Forge/Tom Doherty Associates",
        aliases: ["Forge"],
        locations: ["New York"]
    },
    {
        name: "G. P. Putnam's Sons",
        aliases: ["Putnam"],
        locations: ["New York"]
    },
    {
        name: "Grand Central Publishing",
        aliases: ["Grand Central"],
        locations: ["New York", "Boston"]
    },
    {
        name: "Harper-Collins",
        aliases: ["HarperCollins"],
        locations: ["New York"]
    },
    {
        name: "Howard Books / S&S",
        aliases: ["Howard"],
        locations: ["New York"]
    },
    {
        name: "Harper-Teen",
        aliases: ["HarperTeen"],
        locations: ["New York"]
    },
    {
        name: "Harvet House Publishers",
        aliases: ["Harvest House"],
        locations: ["Eugene, OR."]
    },
    {
        name: "Jove / Berkley",
        aliases: ["Jove"],
        locations: ["New York"]
    },
    {
        name: "Kensington Books",
        aliases: ["Kensington"],
        locations: ["New York"]
    },
    {
        name: "Little, Brown & Company",
        aliases: ["Little Brown"],
        locations: ["New York"]
    },
    {
        name: "Minotaur Books",
        aliases: ["Minotaur"],
        locations: ["New York"]
    },
    {
        name: "New American Library",
        aliases: ["New American Library"],
        locations: ["New York"]
    },
    {
        name: "Plume Books / Penguin",
        aliases: ["Plume"],
        locations: ["New York"]
    },
    {
        name: "Pegasus Books",
        aliases: ["Pegasus"],
        locations: ["New York"]
    },
    {
        name: "Penguin Books",
        aliases: ["Penguin"],
        locations: ["New York"]
    },
    {
        name: "Random House",
        aliases: ["Random"],
        locations: ["New York"]
    },
    {
        name: "Scribner",
        aliases: ["Scribner"],
        locations: ["New York"]
    },
    {
        name: "Simon & Schuster",
        aliases: ["Simon & Schuster"],
        locations: ["New York"]
    },
    {
        name: "Thomas & Mercer",
        aliases: ["Thomas & Mercer"],
        locations: ["Seattle, WA."]
    },
    {
        name: "Tor: Tom Doherty Associates",
        aliases: ["Tor"],
        locations: ["New York"]
    },
    {
        name: "Vintage Books",
        aliases: ["Vintage"],
        locations: ["New York"]
    },
    {
        name: "William Morrow",
        aliases: ["William Morrow"],
        locations: ["New York"]
    },
    {
        name: "Zebra / Kensington",
        aliases: ["Zebra"],
        locations: ["New York"]
    },
];

if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) return console.log("Invalid isbn length");

const API_URL = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;

let jsonOut = null;
async function init() {
    await fetch(API_URL)
        .then((res) => res.json())
        .then((json) => jsonOut = json)
        .catch((err) => console.log(err));

    if (jsonOut && Object.keys(jsonOut).length) {
        const bookInfoArr = [];
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

            const subtitle = jsonOut.subtitle ? ": " + jsonOut.subtitle : "";
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
            bookInfoArr.push(`TITLE=${title}${subtitle}${extraString}`);
        }

        if (argv.bc) {
            // It's a book club book, so need to put that in the edition slot
            bookInfoArr.push("EDITION=BOOK CLUB");
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

        if (jsonOut.publishers?.length) {
            let pubName = jsonOut.publishers[0].name;
            let pubLocs = [];
            // TODO Get a mapping so they can try to map to soemthing that matches the norm
            // This would also allow for the location to be tied in
            if (jsonOut.publish_places?.length) {
                pubLocs.push(...jsonOut.publish_places.map(loc => loc.name));
            }
            for (const pub of pubMap) {
                if (pub.aliases.filter(a => pubName.toLowerCase().includes(a.toLowerCase())).length) {
                    pubName = pub.name;

                    if (pub.locations.length === 1) {
                        pubLocs.push(pub.locations[0].toLowerCase());
                    } else if (pub.locations.length > 1) {
                        pubLocs.push(...pub.locations);
                    }
                    break;
                }
            }

            // Once it gets the publisher, ask if it should be used
            const res = await askQuestion(`I found the publisher: ${pubName}. \nDo you want to use this? (Y)es/ (N)o\n`);
            if (["y", "yes"].includes(res.toLowerCase())) {
                bookInfoArr.push(`PUB=${pubName}`);
                if (pubLocs.length) {
                    pubLocs = [...new Set(pubLocs.map(l => l.toLowerCase()))];
                    if (pubLocs.length > 1) {
                        const locRes = await askQuestion(`I found these location(s): \n\n${pubLocs.map((loc, ix) => `[${ix}] ${loc}`).join("\n")} \n\nWhich one should I use? (N to cancel) \n`);
                        if (Number.isInteger(parseInt(locRes)) && pubLocs[locRes]) {
                            bookInfoArr.push(`LOC=${pubLocs[locRes]}`);
                        }
                    } else {
                        bookInfoArr.push(`LOC=${pubLocs[0]}`);
                    }
                }
            }
        }

        if (jsonOut.publish_date) {
            const date = new Date(jsonOut.publish_date).getUTCFullYear();
            bookInfoArr.push(`PUBDATE=${date}`);
        }
        if (jsonOut.number_of_pages) {
            console.log(`Pages: ${jsonOut.number_of_pages}`);
        }

        if (argv.hc) {
            bookInfoArr.push("BD=HC.");
        } else if (argv.pb) {
            bookInfoArr.push("BD=PB.");
        }
        if (argv.dj) {
            bookInfoArr.push("DJ=DJ.");
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

        const bookInfoOut = bookInfoArr
            .map(e => e.toLowerCase())
            .join("\n")
            .replace(/’/g, "'");
        await fs.writeFileSync("./bookInfo.txt", bookInfoOut);
        exec("C:/Users/Other/Desktop/Jeff/Fiddling/nodeAHK/bookOut.ahk", (error, stdout, stderror) => {
            console.log(error, stdout, stderror);
        });
    } else {
        console.log("No valid book found");
    }
    // Write json to a file, then pass that to the ahk
}
init();



