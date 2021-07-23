# Todo list

- Set it up to ask which between however many subtitles if there are more than one
    * If there is a manual one and something that came from the api (And maybe split off the title?)

- Maybe add a flag so it'll ask for a subtitle, so it can be manually put in as needed?

- Add whatever new flags are needed, as they're needed?

- Possibly phase out some of the older bits that aren't really ever used


## Stuff that probably needs doing/ should be done

- Work in a way for it to show whatever the original publisher was in case we want that instead of whatever matches it finds

- If an entry for the book log has no pub/loc or a missing field, make sure to ask about it
    * Also possible here, if it's missing any other fields from the bookLog, maybe try grabbing from the api to see if it's got better info,  or ask?

- Add in sub-whatever for authors, that will always go in as lowercase (illustrated by, edited by, etc.)
    * Contribution? not sure what to call it, but that kinda makes sense.
    * Started doing this as needed in the bookLog, but will still need to figure out how to put it through, since it can't be .toLowerCase()'d like the rest of it if it's gonna be put in caps

- Possibly update the locations file if we come across a new one.
    * This would need to be verified each time though in case it grabs something funky
    * This will also require it being swapped over to a json instead of a .js

- Change it so we can add full length keywords manually, surrounded by double quotes or soemthing to mark it?
    * ex: `--kw sfi,fan,"space travel",hfi`, then pick out what's in the file vs what's new?

- If it cannot find a matching publisher/ place, maybe look through the booklog file to see if another book has had the same one


## Long term/ maybes

- Eventually, work out a way to put this into a gui/ local html so it's more user friendly?
  Not sure how that will/ would work, but whatever

- When saving a book, save the keywords used as well? So when it's pulled back up, it can use em. Not sure if I should, or how to prompt for that though
    * This would be especially useful in case I forget to change the keywords between genres, and try putting romance in sci-fi or something, but would then depend on it being an older book that's been used before
