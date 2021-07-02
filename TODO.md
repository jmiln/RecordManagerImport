## Todo list

- Set it up to ask which between however many subtitles if there are more than one
    - If there is a manual one and something that came from the api (And maybe split off the title?)

- Let it check through any api supplied subjects so we can choose em for keywords (Subject/ subject places, maybe classifications?)
  https://openlibrary.org/api/books?bibkeys=ISBN:9781400034109&jscmd=data&format=json


At some point, I should just start logging all the books that come in, and save em to another json, so it can
check that first before going to the api, so I can edit in subtitles and such as needed.  This would also give
another spot to check for other titles, juse by filtering out the author then going from there.
(Possible overhaul to the new authors file?)
