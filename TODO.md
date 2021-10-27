# Todo list

- Add whatever new flags are needed, as they're needed?

- Possibly phase out some of the older bits that aren't really ever used

- When comparing old vs new book entries, ignore certain fields like contribution (Still need to do something with this)
  and anything else that's added


## New Fields

- Add more fields to the bookLog so it will fill more of it in if/ when I get around to making a gui
    * Page Count
    * Price? (Original or Ours?)
    * Keywords maybe?
    * Binding (pb/ hc/ spiral)
    * French wraps, spiral variation (wire or comb)
    * Book club/ large print?

- Maybe stick a timestamp on booklog entries, so when comparing old vs new, you can see when it was put in differently? (Not important)

- Add a spot for other titles for it to grab as keywords, where it will look last if no other titles were entered
    * Possibly just have it as keywords, where titles can be in there?

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be .toLowerCase()'d like the rest of it if it's gonna be put in caps
    * For this, it'd need to be able to group them so editor would come first, then illustrator, then "with selections by", then a list of names

- Work out how to make conditions more variable
    * Somehow parse out each option, so it can be "creasing to rear wrap" vs front wrap, etc
        - Possibly something along the lines of condition_type:location (ex: few:rw  (Faint edgewear to rear wrap))?
        - If going this route, it would likely be worth trying to bunch em by location too, like if there are multiple for rear wrap (Creasing & small tear, etc)
            * Possibly seperate by dashes, so few-cre-stear:rw for "faint edgewear, creasing, and a small tear to rear wrap"?
    * Should stick in vg/vg-/g etc as extra options

- Add title aliases?
    * `Olive again` vs `Olive, again`


## Special descriptors for titles (BC, LP, signed 1st, etc)

- These should be in their own field per-book, and tacked on as needed

- Maybe shouldn't put large print/ book club into the subtitle field
    * Possibly another field in each applicable book for version or something?
    * Can put those in there if it even matters, though it should just be
      entered manually each time I think

- Stick ` - signed first printing` at the end of the title for books that are signed
  firsts, general inscriptions ok, just no personalization. This should NOT be saved
  with the book, just added on as needed


## Bugs

- Sometimes if I try changing an entry (moving the cursor) when entering a publisher or something
  manually, it will stick a bunch of keycode characters or something (example below) into the entry, which really screws stuff up.
  This needs to be wiped out if it sees that sort of thing, since it should never be in an entry
    * Ex:
        ```
            {
                "name": "Sphere / Little, Brown & Co.\u001b[1;5d\u001b[1;5d\u001b[1;5d\u001
                b[1;5d\u001b[1;5d\u001b[d\u001b[d\u001b[1;5d\u001b[1;5d\u001b[1;5d\u001b[d\u001b[d\u001
                b[d\u001b[d\u001b[d\u001b[d\u001b[d\u001b[d\u001b[\u001b["
            }
        ```

## Other stuff

- When checking for publishers, and it finds a result in one with multiple names, it should only return the one(s) that actually match

- Put another function in, to number the options so it doesn't have to be done each time
    * This would basically just call the askQv2, but so we don't have to format everything each time
    * Maybe have options for each type of extra (other, save, yes/no)
    * Input would be an array (of titles or pubs, etc), and an object for the options

- If it doesn't have a subtitle or other info, see if theres another book of the title and ask to use some of that?
    * Could maybe do the same based on the author, to check for series', but maybe an extra flag for if that should be enabled or not

- If entering a subtitle manually, check if it's part of the title too, then check about removing it from there


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever
