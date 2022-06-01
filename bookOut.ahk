CoordMode, Pixel, Client
CoordMode, Mouse, Client

SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

; global vars
appOriginalWidth  := 1333  ; original width of the dos app/game (common 320)
appOriginalHeight := 1000  ; original height of the dos app/game (common 240)
appScreenScale    := 1

; Move within dosbox, using whatever adjusted distance values
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
IfWinExist, ahk_class SDL_app
    WinActivate, ahk_class SDL_app
else {
    MsgBox, Error`, RM is not open!
    ExitApp
}

; Decide what boxes it can fill

; Map out how many times to go down in order to reach each spot, and which ones it can
; be trusted to fill properly

; From the starting point, CATEGORY
sleep, 50
; Go up to stop it from looping all over like it does when tabbed in/ focused
send, {up}
sleep, 50

; Move to the correct spot for the catalog#, then click there a few times to try and make sure the cursor is there
loop 4 {
    DosBoxMouseMove(195, 24)
    sleep, 50
    MouseClick, Left
    sleep, 50
}

; 3 to author
SetKeyDelay, 1
goDown(3)
if (strLen(AUTHOR)) {
    sendRaw, %AUTHOR%
}

; If the authors need 2 lines, go down 1 to the title, otherwise go down 2
if (strLen(AUTHOR) > 64) {
    goDown(1)
} else {
    goDown(2)
}

; If there's a title included (There should always be), put that in
if (strLen(TITLE)) {
    sendRaw, %TITLE%
}

; 1-2 to the condition, depending on if the title needs 1 row or 2
if (strLen(TITLE) > 64) {
    goDown(1)
} else {
    goDown(2)
}

; Put in the condition if needed
if (strLen(COND)) {
    sendRaw, %COND%
}

; Go down to the illustration box
goDown(1)

; If there's an illustration set, put that in
if (strLen(ILLUS)) {
    sendRaw, %ILLUS%
}

; Then 2 down to the publisher
goDown(2)

; If there's a publisher
if (strLen(PUB)) {
    sendRaw, %PUB%
}
goDown(1)

; Publishing location
if (strLen(LOC)) {
    sendRaw, %LOC%
}
goDown(1)

; Publish date
if (strLen(PUBDATE)) {
    sendRaw, %PUBDATE%
}
goDown(1)

; Edition (1st printing, book club, etc)
if (strLen(EDITION)) {
    sendRaw, %EDITION%
}
goDown(1)

; Binding (HC, PB, SP)
if (strLen(BD)) {
    sendRaw, %BD%
}
goDown(2)

; If there's a DJ, put that in
if (strLen(DJ)) {
    sendRaw, %DJ%
}
goDown(1)

; If there's a page count,
if (strlen(PAGES)) {
    sendRaw, %PAGES%
}
goDown(1)

; If there's overflow condition, put that in
if (strlen(COND2)) {
    sendRaw, %COND2%
}


; Go back up to the comments field since that's the next edit I need
if (strLen(COND2) > 64) {
    goUp(12)
} else {
    goUp(11)
}

; ########################################
;   End of the 1st page, go on to second
; ########################################

send, {pgdn}

; If there are keywords included, go ahead and stick em in
if(strlen(KW1)) {
    if (KW1 == "^f") {
        send, %KW1%
    } else {
        sendRaw, %KW1%
    }
}
goDown(1)
if(strlen(KW2)) {
    if (KW2 == "^f") {
        send, %KW2%
    } else {
        sendRaw, %KW2%
    }
}

goDown(1)
if(strlen(KW3)) {
    if (KW3 == "^f") {
        send, %KW3%
    } else {
        sendRaw, %KW3%
    }
}

goDown(1)
if(strlen(KW4)) {
    if (KW4 == "^f") {
        send, %KW4%
    } else {
        sendRaw, %KW4%
    }
}
goDown(1)
if(strlen(KW5)) {
    if (KW5 == "^f") {
        send, %KW5%
    } else {
        sendRaw, %KW5%
    }
}
goDown(1)


; 5 to the isbn10 slot, 7 to the isbn13
if (strlen(ISBN13)) {
    goDown(2)
    sendRaw, %ISBN13%
} else if (strLen(ISBN10)) {
    sendRaw, %ISBN10%
    goDown(2)
} else {
    MsgBox, This entry had no ISBN, please make sure everything processed correctly
}

; Set the price in
goDown(6)
if (strLen(PRICE)) {
    sendRaw, %PRICE%
}

; Go down to put it as quantity 1
goDown(1)
send, 1

; Go back up to the first keyword field for when I need start with thos
goUp(14)


; Go back to the first page so I can start entering as needed
send, {pgup}

ExitApp

LAlt::ExitApp
