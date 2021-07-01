## Todo list

- Set it up to ask which between however many subtitles if there are more than one
    - If there is a manual one and something that came from the api (And maybe split off the title?)

- Add in the option to give a publisher manually, in case of a rare one/ one that never shows up?

- Let it check through any api supplied subjects so we can choose em for keywords (Subject/ subject places, maybe classifications?)
  https://openlibrary.org/api/books?bibkeys=ISBN:9781400034109&jscmd=data&format=json

- Maybe start collecting newest x number of titles from popular authors so it can auto-fill those in sometimes?
    - Put em in data/authors, as `"jance, j. a.": [...]` or something?
    - Would maybe have to think of a way to separate them based on series if so, then display that as we go

    {
        "Jance, J. A.": {
            "standalone": [...],
            "Ali Reynolds": [...],
            "J. P. Beaumont": [...],
            ...
        }
    }

    - This has been started, and currently has a bunch of Patterson & Jance in there

    - (DONE) Need to work it out so that it checks against the 1st author, and if it matches one in
      this, it will ask if you want to check against other titles by the author, then check
      which of the series/ headers, then ask about the titles inside.

    - (DONE) This should be filtered by titles that are small enough to fit.

    - (DONE) Should probably change it to a json, so that each time a new book is put in, it will add
      in automatically. Maybe under each of the different authors?

    - Possibly just grab the newest X titles from the matching series instead of choosing them (Or rather, ask if it should put put titles in, then grab em automatically)?

    - (DONE) Also make sure to filter out any matching titles so it's not a duplicate


At some point, I should just start logging all the books that come in, and save em to another json, so it can
check that first before going to the api, so I can edit in subtitles and such as needed.  This would also give
another spot to check for other titles, juse by filtering out the author then going from there.
(Possible overhaul to the new authors file?)
