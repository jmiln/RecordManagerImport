# Todo list

- Add whatever new flags are needed, as they're needed?

- Possibly phase out some of the older bits that aren't really ever used


## Stuff that probably needs doing/ should be done

- Double check the location finder for new pubs... Got this once:

    [0] toronto, ontario
    [1] toronto, ontario
    [2] Toronto, Ontario
    [3] Toronto, Ontario
    [4] Toronto, Ontario
    [5] Toronto, Ontario
    [6] Toronto, Ontario
    [7] Toronto, Ontario
    [8] Toronto, Ontario
    [9] Toronto, Ontario
    [10] Toronto, Ontario
    [11] Toronto, Ontario
    [12] Toronto, Ontario
    [13] Toronto, Ontario


- Sometimes if I try changing an entry (moving the cursor, backspacing) when entering a publisher or something
  manually, it will stick a bunch of keycode characters or something (example below) into the entry, which really screws stuff up.
  This needs to be wiped out if it sees that sort of thing, since it should never be in an entry
    * Ex: ```
        {
            "name": "Sphere / Little, Brown & Co.\u001b[1;5d\u001b[1;5d\u001b[1;5d\u001
            b[1;5d\u001b[1;5d\u001b[d\u001b[d\u001b[1;5d\u001b[1;5d\u001b[1;5d\u001b[d\u001b[d\u001
            b[d\u001b[d\u001b[d\u001b[d\u001b[d\u001b[d\u001b[\u001b["
        }
        ```


- When checking for publishers, and it finds a result in one with multiple names, it should only return the one(s) that actually match

- Possibly stick a timestamp on booklog entries, so when comparing old vs new, you can see when it was put in differently? (Not important)

- If entering a subtitle manually, check if it's part of the title too, then check about removing it from there

- Put another function in, to number the options so it doesn't have to be done each time
    * This would basically just call the askQv2, but so we don't have to format everything each time
    * Maybe have options for each type of extra (other, save, yes/no)
    * input would be an array (of titles or pubs, etc), and an object for the options

- Possibly have a spot in booklog to stick other titles for it to grab as keywords, where it will look last if no other titles were entered

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
    * This would also be especially annoying if I put it in wrong in the first place
