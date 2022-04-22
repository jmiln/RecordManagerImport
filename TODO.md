# Todo list

## Next in line

- Add a new flag (Or file/ command) that will display the last x days worth of titles, seperated by genre (?), sorted by title or author (1st author only), and show them nicely to the console


## New Fields

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be
      .toLowerCase()'d like the rest of it if it's gonna be put in caps. Maybe .toUpperCase() it so it goes in as lowercase?
    * For this, it'd need to be able to group them so editor(s)/ edited by would come first, then illustrator, then "with selections by", then a list of names
    * Also, the `edited by AUTHOR` or `AUTHOR, editor`, different orders, need to figure out why for each/ when to use which

- Possible new feature, put a counter on each publisher, and every time that publisher is used, increment it.
    Then, sort future results by that, so the more common ones are closer to the top. (This would have issues
    when there's a LOT of results, but that needs to have a way of trimming down too)


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

- When grabbing new titles from the api, if there are parentheses in the title, check if I want to put
  something specific in, since that's normally a subtitle mashed in there

- If entering a subtitle manually, check if it's part of the title too, then check about removing it from there
    * This will help keep it from doubling up bits like `a novel` when it's part of the title, then also being added

- When entering a new book, maybe see if there's been an older listing of it in a different format?
    * If so, we could grab subtitle data from it if we don't have any (Make sure to query for that though, with an author so there's no duplicate title weirdness)


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever
    * If this ever happens, it should just ask for the isbn to start, then load up everything from the api or stored info
