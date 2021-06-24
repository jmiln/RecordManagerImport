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
