module.exports = [
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
    "  --fr, --french       Mark this as having french wraps (PB only)",
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
    "  --fill               Fill in the extra keyword slots with previous entries (ctrl+f) if available",
    "  --help               Print this usage info",
    "  --ill                Choose how it's illustrated from a menu",
    "  --loc, --location    Supply a custom location for it to choose from",
    "  --kw <keywords>      Put in some of the keywords (Comma separated only)",
    "  --pr <price>         Set the price",
    "  --pub <publisher>    Specify a publisher to try and match/ use",
    "  -n, --novel          Specify to tack `: a novel` onto the end if not there",
    "  --rep <keys>         Tell it to repeat some of pub, keywords, price, and pages",
    "  --sub <subtitle>     Give it a subtitle to stick in, surround it with quotes (\") if there are spaces",
];
