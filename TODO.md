# Todo list

## Next in line

- When grabbing new titles from an author's works
    * Use the https://openlibrary.org/authors/OL6812710A/works.json link to get the json response instead of
      scraping https://openlibrary.org/authors/OL6812710A/James_Patterson?sort=new
    * One way that it can sorta filter out other languages would be to clean the titles and see if there's any difference before & after (Check for accented characters)
    * We can probably try and grab categories from there too, listed under subjects?
    * Also, when grabbing new ones, have a way to veto ones we don't want kept (Titles in other languages normally)
        - Maybe when listing which ones to keep, only keep those?
        - Or, #x instead of # if we want to remove an entry?

- If there's no subtitle, check against other subtitles from a given author, and see if I want to use one

- Clean up the index file, split a bunch of the complicated bits into their own functions instead of just one massive one

- Add in a qty flag in case there end up being multiple copies of something


## New Fields

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be
      .toLowerCase()'d like the rest of it if it's gonna be put in caps. Maybe .toUpperCase() it so it goes in as lowercase?
    * For this, it'd need to be able to group them so editor(s)/ edited by would come first, then illustrator, then "with selections by", then a list of names
    * Also, the `edited by AUTHOR` or `AUTHOR, editor`, different orders, need to figure out why for each/ when to use which

- Possible new feature, put a counter on each publisher, and every time that publisher is used, increment it.
    Then, sort future results by that, so the more common ones are closer to the top.


## Conditions update

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

