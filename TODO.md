# Todo list


## New Fields

- Add more fields to the bookLog so it will fill more of it in if/ when I get around to making a gui
    * Keywords maybe?
    * Main category
    * French wraps, spiral variation (wire or comb)

- Add a spot for other titles for it to grab as keywords, where it will look last if no other titles were entered
    * Possibly just have it as keywords, where titles can be in there?
    * Any titles in there would be manually entered
    * Possibly also start/ go back to saving titles under authors, so each author would have a list of titles associated
      with em, dates not needed, but still something to fall back on if there are not enough books in the booklog by that author

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be
      .toLowerCase()'d like the rest of it if it's gonna be put in caps. Maybe .toUpperCase() it so it goes in as lowercase?
    * For this, it'd need to be able to group them so editor(s)/ edited by would come first, then illustrator, then "with selections by", then a list of names

- Add title aliases?
    * `Olive again` vs `Olive, again`
    * This would need it to copy over instead of trying to re-figure it out each time


## Conditions update

- Should stick in vg/vg-/g etc as extra options

- Work out how to make conditions more variable
    * Possibly seperate by dashes, so few-cre-stear:rw for "faint edgewear, creasing, and a small tear to rear wrap"?
    * Doing this ends up with it needing to be sorted by the group, then within each group, as well as whatever isn't
      grouped, and grab strings from each abbreviation, as well as trying to turn them into descriptions vs just conditions
      mashed together
    * In general, not worth the effort


## Special descriptors for titles (BC, LP, signed 1st, etc)

- Stick ` - signed first printing` at the end of the title for books that are signed
  firsts, general inscriptions ok, just no personalization. This should NOT be saved
  with the book, just added on as needed, and cannot be used if it's a book club title


## Bugs

- When a publisher is not in the publishers file, but is used by books in the bookLog file, it doesn't trim down duplicates
  like if more than 1 title has the same publisher. This would happen most often if it's a self published title with no location for the publisher


## Other stuff

- When listing bunches of publishers or other items (askQ..), pad the beginning so they're all lined up nicely

- When checking for publishers, and it finds a result in one with multiple names, it should only return the one(s) that actually match

- When inputting publishers and such manually when it doesn't find one, make sure to check the length against the max, and grumble as needed

- Put another function in, to number the options so it doesn't have to be done each time
    * This would basically just call the askQv2, but so we don't have to format everything each time
    * Maybe have options for each type of extra (other, save, yes/no)
    * Input would be an array (of titles or pubs, etc), and an object for the options ({other: true, save: true, ...})

- If it doesn't have a subtitle or other info, see if theres another book of the title (From the same author) and ask to use some of that?
    * Could maybe do the same based on the author, to check for series', but maybe an extra flag for if that should be enabled or not

- If entering a subtitle manually, check if it's part of the title too, then check about removing it from there
    * This will help keep it from doubling up bits like `a novel` when it's part of the title, then also being added

- When choosing between new & old versions, let the user decide which changes to keep in case there are multiple differences
    * This would also allow it to ignore certain fields more easily, like author contributions and such


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever
