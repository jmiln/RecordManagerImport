# Todo list

- Add whatever new flags are needed, as they're needed?

- Possibly phase out some of the older bits that aren't really ever used


## Stuff that probably needs doing/ should be done

- Possibly have a spot in booklog to stick other titles for it to grab as keywords, where it will look last if no other titles were entered

- When saving new pubs, find some way to save em with other similar ones if available
    * Also ask before doing so
    * Ex: Picador can go in with picador usa and others

- Whenever a known publisher comes through with a new location from the api, maybe ask if it should be saved/ added in

- Maybe if it doesn't have a subtitle or other info, see if theres another book of the title and ask to use some of that?
    * Could maybe do the same based on the author, to check for series', but maybe an extra flag for if that should be enabled or not

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be .toLowerCase()'d like the rest of it if it's gonna be put in caps

- Possibly update the locations file if we come across a new one.
    * This would need to be verified each time though in case it grabs something funky
    * This will also require it being swapped over to a json instead of a .js

- Work out how to make conditions more variable
    * Somehow parse out each option, so it can be "creasing to rear wrap" vs front wrap, etc
        - Possibly something along the lines of condition_type:location (ex: few:rw  (Faint edgewear to rear wrap))?
        - If going this route, it would likely be worth trying to bunch em by location too, like if there are multiple for rear wrap (Creasing & small tear, etc)
            * Possibly seperate by dashes, so few-cre-stear:rw for "faint edgewear, creasing, and a small tear to rear wrap"?
    * Should stick in vg/vg-/g etc as extra options


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever

- When saving a book, save the keywords used as well? So when it's pulled back up, it can use em. Not sure if I should, or how to prompt for that though
    * This would be especially useful in case I forget to change the keywords between genres, and try putting romance in sci-fi or something, but would then depend on it being an older book that's been used before
