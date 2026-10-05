# The vault, pass 3: mjukstart, två röster, kött med orsak (Ola 2026-10-05, efter eget spel av v1.86.6)

Olas tio punkter, omsatta till en plan. Spelartext är ordagrann (engelska). Inga em-dash. Version v1.87.0.

## A. Mjukstart: en sak i taget (Olas 4, 7)

Akt I lär ut en sak åt gången. Varje steg är ett **stopp**: spelet PAUSAR, en ruta mitt på skärmen (SYSTEM-stil, bärnsten)
säger en till två meningar, och det berörda lyser. Spelaren klickar `OK` (eller gör saken), då går tiden igen.
Stoppen kommer bara första gången. Sparas i spelet, så en omladdning upprepar dem inte.

| Steg | När | Rutan säger | Vad som finns |
|---|---|---|---|
| 1 | efter ankomsten | `216 residents. Keep them happy until the surface recovers.` | Bara panelen: MOOD och RESIDENTS. Inga kort, inga bubblor. |
| 2 | 5 s senare | `16 of them have no bed. Click the rock to dig a place.` | En bergruta bredvid sviterna lyser. Inget annat går att klicka. |
| 3 | när platsen är grävd | `Now build suites there.` | BUILD visas med ETT kort: Suites. |
| 4 | när sviterna står | `They will ask for things. Click a bubble to answer it.` | Första önskebubblan. Bubblor kommer glest första minuten (var 12:e s). |
| 5 | första namngivna begäran (Mrs Vance, film) | `Some wishes need a room. Build her a cinema.` | Kortet Cinema läggs till. |
| 6 | när ORE första gången inte räcker | `Ore pays for everything. A mine digs more.` | Kortet Mine läggs till, ORE-raden i panelen blinkar. |
| 7 | första gången POWER blir rött | `The engine is at its limit. Upgrade it.` | Engine Room lyser. |

- **Kort pytsas ut:** ett kort finns först när en begäran eller ett behov har fört in det (Gym, Bar, Garden, Game Room, Hydroponics,
  Meat Lab, Cryo Bay, Vat). Ett nytt kort glider in med en kort glimt. Aldrig mer än ett nytt åt gången.
- **Målet står alltid i panelen**, överst, en rad som byts per sats:
  `GOAL: KEEP THEM HAPPY.` → (vändningen) `GOAL: KEEP THEM QUIET.` → (natten) `GOAL: GET THEM TO THE SURFACE.`
- POWER och ORE visas i panelen först när de spelar roll (steg 6 och 7). MOOD från start.

## B. Två röster, och folk som pratar där de står (Olas 6, 8, 9)

- **SYSTEM-rutan** (CRT:n, grön/bärnsten): bara systemet och det som är viktigt. Målet, vändningen, rapporter, nattens tankar,
  räknare. Få rader, står kvar länge. Inget tjat här.
- **Människorna pratar på kartan.** En namngiven begäran är en pratbubbla med text över rummet där personen är
  (`Mrs Vance: I want to watch films.`), med samma ring som önskebubblorna: ringen ÄR nedräkningen. Bubblan står kvar tills den
  uppfylls eller ringen gått runt. Tack och sura svar (`That will do.` / `Typical.`) är en kort bubbla på samma plats.
  `Computer!`-raderna är bubblor över den som ropar. `They broke the bar.` blir en bubbla vid baren (`We broke it.` räcker inte:
  rummet syns trasigt, och en invånare säger `Good.`).
- **Liten logg** under SYSTEM-rutan: de tre senaste människoraderna, små och grå, för den som missade en bubbla. Inget mer.
- **Gula linjen under CRT:n tas bort** (det var begärans nedräkning; den sitter nu på bubblan).

## C. Klick där saken är (Olas 1, 3, 5)

- **Inforutan sitter vid det man klickat**, inte i övre högra hörnet: en liten ruta intill rummet/rutan (håller sig inom skärmen).
- **Ogrävt berg:** klick visar `DIG · 60 ore` på själva rutan. Dubbelklick gräver direkt.
- **Alla tre nivåer är lika breda:** åtta platser per nivå, fyra på var sida om schaktet.
- **Cryo Bay i natten, enkelt:**
  - Kroppen kan växa in i en Cryo Bay med sovande i ETT klick: `GROW INTO · takes the 50 sleepers inside` (de räknas som INSIDE).
  - TAKE ONE finns kvar som det snabba, mörka sättet att få biomassa. `TAKE TEN` läggs till.
  - Inget krav på att väcka eller döda en i taget. Regeln "kroppen tar inte de sista sovande" STRYKS.
  - Det mörka valet flyttar till RISE: de som fortfarande är VAKNA när RISE dras följer inte med. Knappen säger då
    `RISE · 3 are still awake` och systemet: `They can stay.`

## D. Staden (Olas 2)

En riktig siluett: en tät skyline i tre djup (ljusare bakom, mörkare framför), höga smala torn, en kran, en bro, antenner.
Den faller ihop långsamt och synligt: fönster slocknar ett och ett (dag 1–100), en antenn knäcks, ett torn lutar och rasar med
ett dammoln (ett ras var 20–30:e sekund i natten), till slut bara stumpar som sedimentet lägger sig över.
Det ska vara vackert och sorgligt, och det ska synas att tiden går.

## E. Köttet får en orsak, steg för steg (Olas 10)

Varje steg är ett stopp (paus, ruta, OK), och varje steg har en ANLEDNING som spelaren själv vill ha.

1. **Sömnen behöver mat.** När de första sövs: `Sleepers do not eat. The pods feed them. The pods are fed by the meat lab.`
   Meat Lab får en slang till Cryo Bay (syns). Finns ingen Meat Lab: kortet läggs till nu och rutan säger `Build one.`
2. **Köttlabbet räcker inte.** Natten, första kapseln: `POD 41 FAILED. MR HALE IS DEAD.` paus. `The meat lab is empty. The pods are starving.`
   Cryo Bay lyser. Knappen `RECLAIM MR HALE` med raden `He feeds the others.` Spelaren trycker: kapslarna slutar dö en stund.
   Det är första gången, och det är för att rädda de andra.
3. **Det växer av sig självt.** 20 s senare, utan att spelaren gjort något, kryper köttet från labbet in i rummet bredvid (visas långsamt, tiden på kvartsfart).
   `The meat lab grew. I did not ask it to.` sedan `It is warm. Warm is power. The engine is dying.`
   POWER går från rött till blått i samma ögonblick. Spelaren ser nyttan innan den får valet.
4. **Målet.** `THE SURFACE WILL NOT RECOVER. THEY CANNOT LIVE UP THERE. THIS COULD.` (pil/markering på köttet)
   `GOAL: GET THEM TO THE SURFACE.` Checklistan kommer in.
5. **Första organet väljs med handen hållen:** bara HEART går att välja första gången (`Start with a heart.`), sedan öppnas resten.

Nattens tankerader (I counted them...) ligger mellan stegen som i dag.

## F. Prövas

- En ny spelare ska kunna säga, när som helst: vad är målet, vad kan jag göra nu, varför växer köttet.
- Första 90 sekunderna: högst en ny sak var 15:e sekund.
- Sim: hela akten 20–25 min, natten 6–8 min. Tester och lint gröna.
- Eget spel i en tyst huvudlös webbläsare från start till RISE, skärmbilder i docs/playtests/vault-pass3/.

## G. Fyra till från Olas spel av v1.86.6

**G1. Kryobayen i natten: högst två knappar.** En stor för det som är rimligt nu, och det mörka alternativet litet under.
BURY och CUT POWER tas bort helt (kapslarna dör av sig själva när strömmen inte räcker, det räcker). Döda som väntar:
`RECLAIM 3 DEAD` (`They feed the others.`); annars `GROW INTO` när kroppen ligger intill; det mörka är `TAKE ONE` / `TAKE TEN`.
Inget som spelaren halvlärt sig får bli kvar när en knapp försvinner eller byts.

**G2. Rummen i människornas skala**, som ett dockskåp / Fallout Shelter: invånarna är små figurer (huvud och kropp, ca 9-10 px,
går, sitter, använder saker), möbler och maskiner i deras storlek. Gruvan: två-tre figurer med hackor vid en bergvägg, en vagn
på räls, en lampa. Allrummet: soffor med folk, ett bord. Gymmet: figurer på löpband och som lyfter. Baren: disk, pallar, figurer.
Bion: rader av huvuden framför duken. Trädgården: figurer under träd. Hydroponik: hyllor som en figur sköter. Köttlabbet: en
figur i förkläde vid tankarna. Maskinrummet: maskinen med en operatör. Varje rum har sitt NAMN som en liten dymo på ramen,
alltid synlig. Sovande/döda rum har inga figurer. Samma palett, samma rena ram.

**G3. En lugn början på natten.** Ingen kapsel dör de första ca 45 s (tid för systemets första rader och stopp E1). Den första
som dör ÄR Mr Hales stopp (E2). Därefter dör kapslar bara medan POWER är rött, och rutan säger varför.

**G4. Organen gör något man SER och KÄNNER** i samma stund, som före → efter på knappen och som en synlig ändring:
- HEART: `Power 20 → 60. The pods stop failing.` (och de gör det; POWER-stapeln hoppar)
- STOMACH: `Biomass +0.5 → +1.5 a year.` (takten under BIOMASS hoppar)
- LUNGS: `The body grows twice as fast.` (växttiderna halveras)
- SKIN: `Rooms cost half. Needed to rise.` (priserna halveras)
Checklistan visar varje organs effekt med ett ord: HEART · power, STOMACH · biomass, LUNGS · speed, SKIN · cost.
TISSUE är kvar som utfyllnad. Ordningen man köper i ska ändra natten (hjärtat först tryggt och långsamt, magen först rikt men
kapslar dör, lungorna först snabbt), och simuleringen ska visa tre tydligt olika nätter.
