# The vault, build pass (2026-10-05)

Played in headless Chrome at 1280×800, muted (sound and music off in `rpi-audio`, `--mute-audio`), with
`scripts/play-vault.mjs`: real mouse clicks on the canvas, the cards and the info box, chosen by a plausible
player (the requests first, the power and the food when short, fun rooms, upgrades of the bored ones; ▶▶
after 20 s with nothing to do; the bubbles clicked a second or so after they show). Shots in
`docs/playtests/vault-shots/`. At every shot the question: what choice do I have right now, and does the screen
show it?

## Act I, the palace (shots a01 to a17: a full run from the arrival, v1.86.0 before the bubbles)

| shot | day | what I could do | shown? | what I did about it |
|---|---|---|---|---|
| t01, t02 | 0 | nothing for 8 s: the arrival | the dots go down the shaft, the panel lights one by one, the CRT types the three lines | as designed |
| a01 | 8 | wait for 144 ore for Suites C, the request | the request on the CRT, the dot on the Suites card, "Need 144 more ore." on it | the wait was 5 to 15 s of nothing: this is where the bubbles now go (see below) |
| a02 | 16 | build the cinema Mrs Vance wants, or a mine | yes, cards and marks | |
| a03, a04 | 22 to 28 | dig (every card read "Dig a place first.") | yes: the card says it, the rock that can be dug has a dashed outline | |
| a05 | 34 | POWER red (58 in use of 40); the fix is the engine's UPGRADE, 14 ore away | **no**: the gauge was red but nothing said where to look | the Engine Room now gets the dashed gold outline while the power is short; Hydroponics the same while they are hungry |
| a06 to a10 | 41 to 70 | the pool, the garden light (upgrades), more beds | yes: the room gets the dashed outline for an upgrade request | |
| a03 to a10 | | "A child was born" every 6 days filled half the CRT | | births every 8 days |
| a11 to a14 | 76 to 99 | upgrades of the bored rooms ("The gym is boring now.") | yes | |
| a15 | 107 | the turn: SURFACE REPORT, then the complaints | yes | |
| a16, a17 | 113 to 119 | dig and build Cryo Bays on level 2 and 3, SLEEP 10 | yes: the Cryo Bay card appears, SLEEP 10 in the info box | |
| a-final | 124 | 190 asleep, mood 38 % red, a riot broke the cinema (REPAIR · 80 ore) | yes | |

Act I ran to the turn in about 8 minutes of play, as the spec wants.

## The bubbles (Ola's addition, shots w01 to w03, t01 to t04)

| shot | what I could do | shown? | notes |
|---|---|---|---|
| w01, w02 | click a hand over a suite, a drink | yes: icon, the ring running down; hover gives "Room 98 wants breakfast in bed. 1 ore." | the floor of "something to do": in the ore waits there was always a bubble |
| w03 | a wave of five plates on day 8 | the CRT said "Overwhelming wishes for fresh fruit.", the Hydroponics card got the dot | **too early** (nothing affordable) and the five sat on top of each other over two suites: the first wave now comes after 90 s, and each bubble goes to the room with the fewest and away from the others in it |
| t01 to t04 | after the turn: two or three at a time, bells and fingers | yes | 40 clicked in a minute; mood still fell from 50 to 37 % as the spec wants ("faster than you can build") |
