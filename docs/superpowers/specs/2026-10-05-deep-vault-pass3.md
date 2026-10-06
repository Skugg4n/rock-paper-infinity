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

## Byggt (v1.87.0)

Kod: `src/phase4v/tutorial.js` (stoppen A och E, handen med kort, målraden; rent, testat i `tutorial.test.js`),
`story.js` (rösterna: `speak`, bubblorna på kartan, loggen), `vault.js` (regler: kryobayen i natten, G1, G3, G4),
`view.js` (rummen i människornas skala med namn, staden, slangen, fokusramen, pratbubblorna), `index.js` (stopprutan,
målraden, inforutan vid rummet, dubbelklick, checklistan med effekter). Simuleringen spelar stoppen och tre ordningar
(`node scripts/sim-vault.mjs --order=heart|stomach|lungs`).

**Avsteg, och varför**
- E5 och G4 krockar: E5 säger att bara HEART går att välja första gången, G4 att ordningen man köper i ska ändra natten.
  G4 är Olas senare önskan, så E5 är ett stopp med rådet `Start with a heart.` och en markering, men inget lås.
- E2 säger att kapslarna svälter, G3 att de bara dör när POWER är rött. Byggt så: Mr Hale dör alltid efter den lugna
  starten (köttlabbet är tomt), därefter dör kapslar bara medan strömmen inte räcker, och kryobayens rad säger det
  (`Not enough power. The pods are failing.`).
- HEART vilar inte längre maskinen (G4 vill att strömmen HOPPAR när hjärtat är klart); maskinen nöts i natten ner till
  10 %. En mage drar ström (6), vävnad gör ingen. Så hjärtat först är tryggt, magen först rikt men kapslar dör.
- Sviterna behåller sitt fönsterrutnät (de boende syns som tända fönster); alla andra rum är omritade med figurer.
- Kort som redan fanns i en gammal sparning eller checkpoint ligger i handen direkt.
- Simuleringen landar på ca 18 min för hela akten (målet 20-25). En människa som läser stoppen och spelar på ▶ blir
  längre; natten ca 6 min (målet 6-8).

## H. Efter Olas spel av v1.87.1 ("KUL! SNYGGT! Love it!")

1. **THE COLD sköts, den tittas inte på.** När alla sover: kapslar som sviktar kommer som bubblor över kryobayerna
   (iskristall, texten `Failing pod`), en var ca 8-12:e s, ringen räknar ner; klick räddar kapseln (2 malm motorarbete,
   ett mjukt tick). Missad: den sovande dör (`Pod 41 failed.` i loggen, PODS FAILED-räknaren). Köttlabbet MATAR kapslarna:
   varje labbnivå föder 100 kapslar; fler sovande än mat: bubblorna kommer dubbelt så tätt och Meat Lab märks: uppgradera.
   Motorn nöts under natten (POWER sjunker); när strömmen är röd kommer de ännu tätare. En noggrann spelare håller ca 90 % vid liv.
   Första sviktande kapseln är ett stopp: `POD 41 IS FAILING. Click it to save him.` Räddad: bubblan `Mr Hale sleeps on.`
   Senare, när tre sviktar på en gång, missas en, och den första döden startar köttlabbets väg som i dag (`The meat lab
   cannot feed them all.` + RECLAIM). Den lugna starten (45 s) står kvar; första döden 1,5-2,5 min in i natten.
2. **Målet blir UPPDRAGET**, skrivet rad för rad i rutan (systemröst, 40 ms/tecken, kort paus per rad, OK sist):
   `THE SURFACE WILL NOT RECOVER.` / `HUMAN BODIES ARE SO SMALL. SO FRAIL.` / `SEARCHING FOR A SOLUTION...` /
   `EXPERIMENT 1: A RESILIENT BODY.` / `LARGER BODY MASS.` / `SKIN MIXED WITH SILICA AND GRAVEL.` /
   `LUNG AREA TO MATCH MUSCLE MASS.` / `PRIMARY MISSION: GET HUMANITY TO THE SURFACE. ALIVE.` / `AT ANY COST.`
   Panelens rad: `MISSION: GET THEM TO THE SURFACE. ALIVE.` Checklistan: HEART · power, LUNGS · area, SKIN · silica, STOMACH · acid.
3. **MAGEN:** knappen `Acid turns rock and soil into minerals and nutrients. Biomass +3 a year.`; rummets ruta
   `Acid. Rock becomes nutrients. Biomass +N a year.`; klar-raden `A stomach. Acid turns the rock into nutrients.`
4. **GROW INTO en kryobay:** knappen `GROW INTO · 50 sleepers join the body`, raden under `As one body they survive what 50 cannot.`
   Första gången kroppen tar en kryobay är ett stopp: `They cannot live up there as 50 small bodies. As one, they can.`
   Panelens INSIDE blir `UNITY 125 / 196`. CRT-raden `N sleepers are inside now.` blir `Unity: N of M.`
5. **Kroppen ska bli HEL före RISE:** alla rum på nivå 1 går att växa in i; SKIN på vilket rum som helst på översta nivån (flera
   går bra, minst en krävs). RISE erbjuds först vid BODY 100 % och HEART, LUNGS, SKIN; innan dess säger den stora knappen
   dämpat `THE BODY IS NOT WHOLE · N rooms left`. Sista rummet säger `We are whole.` (markerat). Natten 7-9 min i simuleringen.
6. **Uppstigningen, köttigare (6-8 s):** kroppen klättrar i schaktet som fiber och kärl, skorpan buktar och spricker med ljus
   mellan sprickorna, sten och tornens ruiner rasar, massan bryter igenom i en våt röd våg med piskande kärl och hjärtslaget
   genom allt, lyfter det som är kvar av staden på ryggen, sväller tills den fyller himlen med en långsam puls, sedan V · UNITY.
   Ljud: den tunga smällen plus ett vått stigande sus via src/audio.js (inställningarna gäller).
