# Todo list

## Next in line

- When checking for differences between an old/ saved version and what's going in now, it should update what's going in so it can help catch mistakes/ missed bits


## Recursion issues

- When changing a publisher from what it thinks it found to something else (Self-published/ author name -> published by author), it
  will try sticking in the location it found, rather than nothing like I told it to


## New Fields

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


## Other stuff

- When grabbing new titles from the api, if there are parentheses in the title,
  check if I want to put something specific in, since that's normally a subtitle mashed in there

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


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever
