module.exports.condMap = {
    // Something special
    sig:     "Signed by author.",
    sigtip:  "Signed by author on tipped-in page.",
    sigbp:   "Signed Bookplate inside.",
    ins:     "Inscribed to prev. owner.",
    sigins:  "Inscribed & Signed by author.",
    siginsp: "Inscribed to Prev. Owner & Signed by author.",
    siginspo: "Inscribed to Prev. Owner & Signed by author.",

    lp:  "Large Print.",

    // CDs
    acd: "Audio CD.",

    // Remainders
    red:  "Remainder Dot.",
    remd: "Remainder Dot.",
    rem:  "Remainder Mark.",
    remm: "Remainder Mark.",

    // Edgewear
    few:  "Faint Edgewear.",
    lew:  "Light Edgewear.",
    lewo: "Lightly Edgeworn.",

    // General Wear
    fw:  "Faint Wear.",
    lw:  "Light Wear.",

    // General Wear to Boards
    fwb:  "Faint Wear to Boards.",
    lwb:  "Light Wear to Boards.",

    // Previous owner stuff
    poad:  "Prev. Owner's address label inside.",
    poin:  "Prev. Owner's initials inside.",
    poins: "Prev. Owner's inscription inside.",
    pona:  "Prev. Owner's name inside.",
    pono:  "Prev. Owner note inside.",
    pobp:  "Prev. Owner bookplate inside.",
    post:  "Prev. Owner stamp inside.",

    // Toning
    fton: "Faint toning to page edges.",
    lton: "Light toning to page edges.",
    ton:  "Toning to page edges.",

    // Moisture Ripple
    fmoi: "Faint moisture ripple",
    lmoi: "Light moisture ripple",


    // Foxing to page edges
    ffox: "faint foxing to page edges.",
    lfox: "light foxing to page edges.",

    // Soiling to page edges
    fsoi: "faint soiling to page edges.",
    lsoi: "light soiling to page edges.",

    // Soiling to boards
    fsoib: "faint soiling to boards.",
    lsoib: "light soiling to boards.",

    // Board damage
    fewb: "Faint Edgewear to Boards.",
    lewb: "Light Edgewear to Boards.",

    // Boards & DJ
    fewbd: "Faint Edgewear to Boards & DJ.",
    lewbd: "Light Edgewear to Boards & DJ.",

    // PB Wraps creased
    cr:   "creased",
    crea:   "creased",
    fwcr: "Front Wrap Creased.",
    rwcr: "Rear Wrap Creased.",
    fpcr: "Front Page Creased.",
    rpcr: "Rear Page Creased.",

    // Tears
    ste: "Small Tear",
    tte: "Tiny Tear",

    // Sticker Issues
    stsc: "sticker scar at ...",
    ssha: "sticker shadow at ...",
    srem: "sticker remnant at ...",

    // DJ stuff
    dsun: "DJ Lightly Sunned at Spine.",
    fewd: "Faint Edgewear to DJ.",
    lewd: "Light Edgewear to DJ.",
    fwd:  "Faint Wear to DJ.",
    lwd:  "Light Wear to DJ.",
    djm:  "DJ in Mylar Wrap.",
    myl:  "DJ in Mylar Wrap.",
};

// Conditions that can have locations inserted instead of being statically assigned one
module.exports.modularCond = {
    // Edgewear
    few:  "Faint Edgewear to ^.",
    lew:  "Light Edgewear tp ^.",
    lewo: "^ Lightly Edgeworn.",

    // General Wear
    fw:  "Faint Wear to ^.",
    lw:  "Light Wear to ^.",

    // Toning
    fton: "Faint toning to ^.",
    lton: "Light toning to ^.",
    ton:  "Toning to ^.",

    // Previous owner notes etc.
    poad:  "Prev. Owner's address label ^.",
    poin:  "Prev. Owner's initials ^.",
    poins: "Prev. Owner's inscription ^.",
    pona:  "Prev. Owner's name ^.",
    pono:  "Prev. Owner note ^.",
    pobp:  "Prev. Owner bookplate ^.",
    post:  "Prev. Owner stamp ^.",

    // Sunning (DJ lightly sunned at spine)
    dsun: "DJ Lightly Sunned at ^.",

    // Moisture Ripples
    fmoi: "Faint moisture ripple to ^.",
    lmoi: "Light moisture ripple to ^.",

    // Foxing
    ffox: "faint foxing to ^.",
    lfox: "light foxing to ^.",

    // Soiling
    fsoi: "faint soiling to ^.",
    lsoi: "light soiling to ^.",

    // X creased
    cr: "^ Creased.",
    crea: "^ Creased.",

    // Tears
    ste: "small tear to ^.",
    tte: "tiny tear to ^.",

    // Sticker scars
    stsc: "sticker scar at ^.",
};

// The different parts of the book to name off
module.exports.condLocs = {
    b:    "boards",
    bdj:  "boards & dj",
    d:    "dj",
    dj:   "dj",
    fdj:  "front of dj",
    rdj:  "rear dj",
    djff: "dj front flap",
    djrf: "dj rear flap",
    djv:  "dj verso",
    ep:   "early pages",
    ffep: "ffep",
    fe:   "fore-edge",
    fw:   "front wrap",
    p:    "pages",
    pe:   "page edges",
    rfep: "rfep",
    rp:   "rear pages",
    rw:   "rear wrap",
    sp:   "spine",
};



