CoordMode, Pixel, Client
CoordMode, Mouse, Client

; global vars
appOriginalWidth  := 1333  ; original width of the dos app/game (common 320)
appOriginalHeight := 1000  ; original height of the dos app/game (common 240)
appScreenScale    := 1     ; scale factor (see "Actions > #appScreenScale" in description below for the correct value)

DosBoxMouseMove(x, y) {
	global appOriginalWidth, appOriginalHeight, appScreenScale

	x := x * appScreenScale
	y := y * appScreenScale

	MouseMove, 0, 0

	while (x > 0) {
		if (x > appOriginalWidth) {
			MouseMove, appOriginalWidth, 0, 0, R
			x -= appOriginalWidth
		} else {
			MouseMove, x, 0, 0, R
			x = 0
		}
	}

	while (y > 0) {
		if (y > appOriginalHeight) {
			MouseMove, 0, appOriginalHeight, 0, R
			y -= appOriginalHeight
		} else {
			MouseMove, 0, y, 0, R
			y = 0
		}
	}
}



;; Import and parse data file
#include  bookInfo.txt

goDown(downNum) {
    loop %downNum% {
        send, {down}
    }
    return
}
goUp(upNum) {
    loop %upNum% {
        send, {up}
    }
    return
}

; Activate the RecordManager window
WinActivate, ahk_class SDL_app

; Decide what boxes it can fill

; Map out how many times to go down in order to reach each spot, and which ones it can
; be trusted to fill properly

; From the starting point, CATEGORY
sleep, 100
send, {up}
sleep, 150
DosBoxMouseMove(190, 25)
MouseClick, Left
sleep, 350
DosBoxMouseMove(190, 25)
; MouseMove, 400, 75, 80
sleep, 50
MouseClick, Left
sleep, 15
MouseClick, Left
sleep, 15
MouseClick, Left
sleep, 70

; 3 to author, but really 2 since from the cat field, it'll automatically go one
; more in when tabbed over
SetKeyDelay, 30
goDown(3)
if (strLen(AUTHOR)) {
    sendRaw, %AUTHOR%
}

if (strLen(AUTHOR) > 64) {  ; This means it'll take more than one line
    goDown(1)
} else {
    goDown(2)
}

if (strLen(TITLE)) {
    sendRaw, %TITLE%
}

; 5 more from title to publisher
if (strLen(TITLE) > 64) {
    goDown(4)
} else {
    goDown(5)
}

; If there's a publisher
if (strLen(PUB)) {
    sendRaw, %PUB%
}

; Publishing location
goDown(1)
if (strLen(LOC)) {
    sendRaw, %LOC%
}

; Publish date
goDown(1)
if (strLen(PUBDATE)) {
    sendRaw, %PUBDATE%
}

goDown(1)
if (strLen(EDITION)) {
    sendRaw, %EDITION%
}

goDown(1)
if (strLen(BD)) {
    sendRaw, %BD%
}

goDown(2)
if (strLen(DJ)) {
    sendRaw, %DJ%
}

; Go abck up to the comments field since that's the next edit I need
goUp(9)


; ########################################
;   End of the 1st page, go on to second
; ########################################

send, {pgdn}

; 5 to the isbn10 slot, 7 to the isbn13

if (strlen(ISBN13)) {
    goDown(7)
    sendRaw, %ISBN13%
} else if (strLen(ISBN10)) {
    goDown(5)
    sendRaw, %ISBN10%
    goDown(2)
}

; Go down to put it as quantity 1
goDown(7)
send, 1

; Go back up to the first keyword field for when I need start with thos
goUp(14)


; Go back to the first page so I can start entering as needed
send, {pgup}


Clipboard := PUB
