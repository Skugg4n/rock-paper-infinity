# IV · the dig, mänskligt speltest 2026-10-05 (v1.87.0, ?deep=dig)

Headless Chrome 1440×900, ljud och musik av, riktiga tangenttryck (piltangenter) och musklick.
Spelet pausat (`__rpiPaused`) mellan mina drag, så speltid ≈ mänsklig speltid utan betänketid.
Från `iv-dig-start`: 8,0 min speltid. Sedan `iv-dig-war` 1 min, `iv-dig-machine` 1 min, `iv-dig-flesh` 0,8 min, `iv-dig-heart` till RISE.
Bilder: `docs/playtests/dig-test-shots/001–079` (inte committade). Inga JS-fel under hela testet.

**Om automationen:** en tangenttryckning på 70 ms flyttade ibland drönaren två rutor, och sidsvängen vid en avsats har ett fönster på ca 75 ms som jag bara träffade ibland. Det gjorde de första fyra dödsfallen värre än för en van spelare. Men själva fällan (punkt 3.1) finns i spelet oavsett hur snabb man är.

## 1. Dom

**NÄSTAN.** Grundloopen (ner, fyll, hem, köp) fungerar och från 700 m och nedåt är det snyggt och flyter. Men de första 8 minuterna dör man av styrningen och mörkret, inte av beslutet "en ruta till eller hem nu". 7 dödsfall på 8 minuter, varav högst två var mitt eget dåliga beslut.

## 2. De tre bästa ögonblicken

1. **Kapslarna blir röda** (070). Första gången jag kom upp med köttklumpar lyste alla 216 kapslar rött i stället för blått. Inget ord, bara färgen. Där kändes vändningen.
2. **Fynden.** "A child's shoe. Size small." (014), "A shell casing, still warm." (028), "A helmet. A name written inside." (039), "A board. Rock beat scissors. Again and again." (064). Korta, bra, och de är dessutom de enda som ger riktigt med delar (12 till 100). Det var dem jag letade efter, inte malmen.
3. **Maskinlagret vid 700 m** (060–065). Kretskortsmönster, blå saxskärvor, "Machines. Older than the war." Två dyk, 80 delar per last, inga dödsfall. Här var det roligt på riktigt: fyll lasten, flyg hem på några sekunder, köp.

## 3. Grind, väntan och förvirring

Tid = speltid sedan start.

1. **Drönaren studsar under avsatser och äter batteriet** (t≈20–95 s, 006–016, igen t≈190, 320, 435). Håller man uppåt i ett schakt som tar slut flyger drönaren upp en ruta, faller tillbaka, flyger upp, i 10–20 % batteri per sekund. På skärmen syns nästan ingenting, bara att procenten rasar. Fyra av mina sju dödsfall kom härifrån, ett med 67 % batteri kvar på 140 m. Det går bara att svänga in i en sidotunnel om man släpper uppåt exakt när drönaren når raden.
2. **Mörkret: jag hittar inte hem** (005–011, 015, 017). Under 60 m syns bara en cirkel på ca 3 rutor runt drönaren, resten av skärmen (ca 80 %) är svart. Mina egna tunnlar syns inte i mörkret, så jag visste inte var schaktet var. Fick bygga raka schakt och alltid åka samma väg tillbaka.
3. **Malm som ser ut som fara, skräp som ser ut som malm** (001–004). De vita taggarna är malm (1 del styck), de grå lådorna med orange streck är skräp. Jag undvek taggarna första dyket och grävde efter lådorna.
4. **Statusraden ljuger efteråt.** "Recovered. The cargo is gone." står kvar i rött i över en minut. "Cargo full. Go home." står kvar på basen med lasten 0/14 (044). "Turn back. Just enough power to fly home." stod kvar när jag hade 27 % på 295 m, och jag dog på vägen upp (048–049). Raden sägs en gång och räknas aldrig om.
5. **300 m-porten är en kvarn** (045, t≈395 s). "Too hard. Needs DRILL 2." DRILL 2 kostar 100 delar. Ytmalmen ger 1–3 delar styck och en full last 8–15. Utan fynd är det 7–8 dyk till. Jag hade 27 delar efter 8 minuter.
6. **Batteriuppgraderingen märks inte** (027). Mätaren visar fortfarande 100 %. Lasten (8 → 14) och lampan märks direkt, batteriet inte alls.
7. **Hjärtat tar slut på en knapptryckning** (071–073). Checkpointen lägger mig precis ovanpå hjärtat, ett tryck nedåt och det är över.
8. Mindre: i köttet flyttade ett tryck drönaren flera rutor (068–069, osäkert om det var min automation). Radarprickarna är 3 px och lätta att missa (044). Kolonimätaren är röd vid 98 % i köttet, fast röd betyder "lågt" överallt annars.

## 4. Uppnått

**Ja:** första fulla lasten hemma (t≈121 s, kolonin 39 → 51 %), varje fynd, köp av LAST (8 → 14 syns direkt), lampan (större ljuscirkel), att flyga upp 220 m på 3 sekunder i ett rakt schakt, 80 delar per last i maskinlagret, kapslarna som blir röda.
**Nej:** batteriet (ingen synlig skillnad), dödsfallen (lasten försvinner, ingen tid att förstå varför), "Pod 162 went dark." (stod i en rad medan jag var i mörkret, jag såg aldrig kapseln slockna), 300 m-porten (en vägg, ingen delseger på vägen dit).

## 5. Landar köttet och hjärtat?

**Köttet: ja.** Varm röd sten med sprickor, sedan rött kött med ådror och lysande klumpar (066). Drönaren blir rosa. Rösten "It was not there." i rosa text under 700 m är obehaglig på rätt sätt. Röda kapslar på basen är bästa bilden i kapitlet.
**Hjärtat: halvvägs.** Bra: kameran åker upp till basen där kapslarna töms, ett rött band följer schaktet hela vägen ner och hela tvärsnittet lyses upp, så man ser äntligen allt man grävt förbi (075–077). Dåligt: hjärtat ligger halvt utanför skärmens nederkant (071), en knapptryckning och det är slut, HUD:en står kvar ("POWER 100 %", "Buy at the base."), ett ljust rosa band går tvärs över bilden (076–077), och RISE-knappen klipper direkt till "V · UNITY · to come" (078). Ingen uppstigning syns.

## 6. Utseende

Bra: ruinstaden med regn och de 216 blå prickarna (001), maskinlagrets kretskort (060), köttet (066), sluttvärsnittet (075).
Dåligt: de första minuterna är skärmen mest svart. Drönaren är ca 20 px stor på en 1440-skärm. Workshop-texten ("Digs faster.", "Need 13 more.") är liten och grå. Ytlagret är fullt upplyst vid start (001) så den första blicken avslöjar all malm, sedan blir det plötsligt nästan svart vid 60 m.

## 7. Topp 5 fixar

1. **Sväva i stället för att studsa.** Uppåt mot en avsats ska drönaren stå still (och inte dra ström som en klättring). Uppåt + sida samtidigt ska betyda "klättra och sväng vid första öppningen". Det tar bort fyra av sju dödsfall.
2. **Visa vägen hem i mörkret.** Låt grävda tunnlar ligga kvar svagt synliga (minneskarta) och gör home-strecket på batterimätaren tydligare eller lägg en tunn linje till schaktet.
3. **Statusraden ska stämma just nu.** Töm dödsraden när man startar nästa dyk, ta bort "Cargo full" när lasten är tom, och räkna om "Turn back" hela tiden (eller visa den bara medan den är sann).
4. **Läsbar malm och en mjukare 300 m-port.** Malm ska glimma, skräp ska se ut som sten. Höj ytmalmens värde eller sänk DRILL 2, och säg någonstans att fynd är de stora pengarna.
5. **Ge hjärtat ett slut.** Centrera hjärtat i bild, låt sista metrarna ta några slag (det pulserar, en röst: "come home"), dölj HUD:en under slutet och låt RISE visa något som stiger innan titelkortet.
