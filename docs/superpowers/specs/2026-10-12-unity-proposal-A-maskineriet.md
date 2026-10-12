# V · UNITY, förslag A: maskineriet, gjort rätt (2026-10-12)

Ett av två parallella förslag. Ramen står kvar: kroppen äter jorden, fyra flöden, organen, GROW AS, EXPERIMENTS, fem skalor,
sinnena inuti. Det som ändras är hur delarna tvingar fram val. Ingen ny motor, ingen ny akt. Ingen kod ändrad.

## 1. Kort för Ola

- **Det som stannar:** allt du ser i dag. Kroppen, kartorna, guiderna, minnena, "The city is ours.", röda ordet, ratten.
- **Det som ändras, i fyra regler:**
  1. **Varje hinder har två vägar** (ett kortpar). Väljer du den ena stängs den andra på den skalan. Kroppen blir din.
  2. **Riktningen är ett val.** Kanten äter dubbelt mot målet du pekar ut och hälften åt andra hållet. Valv, rik mark och storm ligger åt olika håll.
  3. **Varje skala slutar med en händelse:** ett landmärke som måste ätas för hand, rond för rond i hjärtats takt. Sten, sax, påse kommer tillbaka när det betyder något.
  4. **Sinnena kostar och ger.** Insight öppnar den stängda vägen. Frön bär människor som kan dö i havet. Slutet BE ONE är att du släpper dem, en grupp i taget.
- **Varför 40 minuter håller:** det finns alltid ett val med två bra svar, och ingen tystnad över 60 s (en regissör i motorn ser till det). Varje skala har en början, ett vägval, och en final.

## 2. Diagnos

1. **Hindren är köp, inte beslut.** Länet och landet: Choking, Far from the gut, Mountains, Sagging, Stuck, "varje ord löstes med ETT köp inom 30 s" (test 2). Varje rött ord har exakt ett kort som svar och kortet har ingen baksida. När svaret är givet är det en kassaapparat, inte ett spel.
2. **Kroppen har för mycket av allt.** Simmen (fas C) visar POWER 150 till 479 % i stora delar av landet och kontinenten. Överskott betyder att ratten har ett läge som är "rätt nog" i minuter. Ratten blir bara intressant när varje flöde har ett värde även över 100 %, så att optimum flyttar sig.
3. **Tystnaden är väntan på tanke.** Staden t=306 till 677: inget rött, thought +5 a day bromsade i hemlighet (test 2). v1.89.1 gör `Slow mind.` rött, men rött ord utan val är bara en klocka. Simmen: längsta flaskhals 95 till 146 s är nästan alltid "tanken som väntar på nästa stora kort".
4. **Skalorna tar slut i stället för att avslutas, och planeten saknar handling.** Zoom vid 80 % äten är passivt; staden slutar med en ruta och OK. Planeten: "Nowhere to grow.", +0 m² a day, insight 250 utan användning, SEEDS köpt men ingen knapp (t≈1564, rättat i v1.89.1 men utan att fröna betyder något utöver yta). "MISSION: BE ONE" är en etikett.

Till det kommer stopprutor som sväljer klick (t=209, t=882). Det är en buggfix, men den hör hit: ett val som försvinner tyst är värre än inget val.

## 3. Kärnloopen

**Sekund (3 till 8 s):** hjärtslag = rond. Kanten biter, ett ljud, rutor blir kropp, siffran tickar. Det är leksaken och den finns.

**Minut (45 till 75 s):** ett av tre val står alltid öppet, och regissören ser till att ett nytt kommer innan 60 s har gått utan val:

| Val | De två bra svaren | Kostnaden på var sida |
|---|---|---|
| **Kortparet** (vid varje hinder) | t.ex. `FILTER LUNGS` eller `THE LONG WAY` | den ena kostar POWER för alltid, den andra kostar tid och MASS nu |
| **Riktningen** (målet på kartan) | mot valvet, mot rik mark, bort från stormen | valvet ger sinnen men mager mark; rik mark ger näring men stormfronten slår mot den sidan |
| **Ratten** (GROW AS) | mer HEART eller mer SKIN inför fronten | hjärtat ger fart nu, huden räddar kanten om 20 s |

Vad som gör dem till beslut, i siffror:
- **Inget flöde har noll värde.** POWER över 100 % ger kanten fart: `edge × min(1.4, power^0.5)`. 150 % power = +22 % fart. Hjärtat är alltså aldrig "klart", och varje procent i ratten som går till HEART tas från något som också är värt något. Optimum ligger inne i ratten och flyttar sig med terrängen.
- **Varje stor lösning har en räkning.** Organ som löser hinder drar en fast del av POWER: LUNGS 12 %, MUSCLE 10 %, INTESTINES 8 % per nivå, BONE 15 %. Fyra lösningar senare är hjärtat det som bromsar, utan att någon "hjärtskala" behöver skriptas. POWER ska simuleras till att ligga i 80 till 120 % minst 60 % av tiden.
- **Riktningen är geometrisk.** Kanten har sektorer; mot målet äter den ×2, i sidorna ×1, bakåt ×0,5. Totalen är något lägre än i dag (snitt 0,95) så att ett mål alltid lönar sig men kostar något åt andra hållet. Utan mål: ×1 överallt. Kartan har alltid två intressanta mål i olika riktningar (simmen kontrollerar att vinkeln mellan dem är över 90°).
- **Regissören.** Motorn räknar sekunder sedan senaste val (ett köp, ett vridet reglage som ändrar röda ordet, ett nytt mål, en rond). Vid 45 s utan val serverar den nästa sak i kön: en stormfront som syns 20 s i förväg (`Storm from the west. 20 s.`), ett bälte ny terräng som EYES avslöjar, en guide som frågar efter sinnen, eller kortparet tidigare. Den ska sällan behöva slå till: om den slår till oftare än en gång per 3 minuter är skalan för tom, och det är ett siffer- eller kartfel att rätta, inte en händelse att lägga till.

**Tankens väntan blir ett val:** stora kort tänds som par, och små I–V-kort ligger kvar. Spara till paret eller köp tre små nu. Ms Ito säger vilket som är närmast: `The long way is 40 s off. The small ones now?`

## 4. Per skala

**THE CITY (0 till 8 min). Händerna, sedan vägen.** Flaskhalsfamilj: rum, näring, storm. Handfasen behåller tre knappar som säger vad de ger (v1.89.1). Varning före AUTONOMIC EDGE: `The gut takes what is saved.` Beslut: stormen vid 3:20 får ett par, `GRAVEL IN THE SKIN` (storm river 60 % mindre, 1 200 thought) eller `WE GROW BEHIND IT` (kanten drar sig 2 rutor in under stormen och äter dubbelt efter, 600 thought, kostar yta i varje våg). Tystnaden t=306 till 677 fylls av riktningen: staden har två delar, floden (rik, PAPER) och gamla stan (stål, SCISSORS, där klimaxen står). **Klimax: THE OLD TOWN.** Sista femtedelen av staden är gamla stan, och zoom sker när den är äten, inte vid 80 %. THE EDGE KNOWS slås av (`The edge waits for you.`): tolv ronder i hjärtats takt, kvarterens typ syns ett slag i förväg, rätt läge äter kvarteret, fel läge kostar ett slag. Mrs Vance säger ett minne per tredje kvarter (`The school. My boys were loud there.`). Sista kvarteret: `The city is ours.` Kameran drar ut medan kroppen pulserar. **Överlämning:** länets karta tonar in runt den krympta staden, Mr Lund pekar redan: `Something under the old capital. A vault. 140 asleep.` Första målet är satt åt spelaren.

**THE COUNTY (8 till 15 min). Gift och flod.** Flaskhalsfamilj: Choking, Stuck, Far from the gut. Beslut, kortparet vid giftbågen: `FILTER LUNGS` (poison becomes food, LUNGS drar 12 % power) eller `THE LONG WAY` (MUSCLE nu, kanten drar runt giftet och över floden, 10 % power, men giftfälten förblir oätliga på den här skalan och ger 30 % mindre yta). Valvet ligger bakom giftet, rik mark bakom floden: riktningen och paret hänger ihop. **Klimax: THE VAULT.** Valvet är landmärket. Ronderna mot dess skal (granit och stål, mönstret växlar efter tre slag), och när det är öppnat: `JOIN · 140 minds`, Dr Okafor: `They did not choose this.` Sedan zoom. **Överlämning:** de 140 måste placeras (MEMORY eller PROCESSING) innan nästa karta får ett mål. Ett val, inte en ruta.

**THE LAND (15 till 22 min). Berg och avstånd.** Flaskhalsfamilj: Mountains, Far from the gut, Weak pulse. Beslut: `ACID FOR GRANITE` (berg blir näring och MINERAL, STOMACH tyngre: +15 % power) eller `THE PASSES` (kanten söker passen, INTESTINES nivå II gratis, men kroppen blir lång och smal: stormen får tre fronter i stället för en). Här kommer räkningarna ikapp: två lösningar i, och `Weak pulse.` är rött. Svaret är ett nytt par: `A HEART FOR A COUNTRY` (power ×3, hunger ×2) eller `MANY SMALL HEARTS` (+40 % power, ingen hunger, men varje hjärta är 3 % av massan och syns i köttet). **Klimax: THE DAM.** Floden stängd av en damm (ROCK). När den äts släpps vattnet: 20 s där kanten ska hålla huden tjock mot översvämningen, ratten är spelet i 20 s. Sedan JOIN 260 och zoom. **Överlämning:** Mrs Vance: `They dreamed of their own beds.`

**THE CONTINENT (22 till 30 min). Vikt och kust.** Flaskhalsfamilj: Sagging, Thin, Sea. Beslut: `BONES FOR A CONTINENT` (bär vikten, 15 % av massan blir ben, växer 20 % långsammare) eller `SPREAD THIN` (huden får ett tak på tjocklek, kroppen växer 30 % fortare men stormarna river dubbelt). Kusten: `SALT SKIN` (långsamt över grunda hav) står ensam men kostar så mycket att den konkurrerar med paret. **Klimax: THE COAST.** Kontinenten slutar när hela kusten är vår, och de sista 5 % är en stormfront från havet: tre vågor, ronder per våg, och varje förlorad rond river ett stycke kust som måste ätas igen. JOIN 410. **Överlämning:** kameran drar ut till globen, kroppen är en röd fläck på en kontinent av sju. Watcher: `The sea is too wide to grow across. A seed can cross it.`

**THE PLANET (30 till 40 min). Fröna och slutet.** Se 5.

## 5. Slutet

**Fröna (30 till 37 min).** Sex andra kontinenter, var och en ett hav bort med eget hav (bredd, salt, storm). Fröet har tio poäng (DRIFT, ACID, SKIN, ROOTS, MIND), finns redan. Det som gör det till ett spel:
- **MIND-poäng är människor.** 15 sinnen per poäng följer med. Dör fröet i havet dör de, och loggen säger det: `Twelve of us were in it.` Ett frö utan MIND landar men sitter fast (`It cannot think.`). Varje frö är alltså ett val mellan säkerhet och folk.
- **Havet visar oddsen i ord, inte procent:** `This sea is wide and salt.` med de två poäng den kräver markerade.
- **Ett frö som växer in är en mini-skala:** 40 till 60 s där fröet äter sin kontinent och spelaren sätter riktning åt det. När det möter kusten: `THE SEED GROWS INTO US.` Insight (som i dag samlas utan användning) köper fröpoäng och öppnar stängda par: `WE CAN HOLD BOTH` (3, 6, 12, 24 insight).
- När den sista kontinenten är vår: `We are one.` MASS står inte på +0 någon gång: varje kontinent som är vår växer på egen hand mot polerna medan nästa frö flyger.

**BE ONE (37 till 40 min), en sekvens spelaren driver.**
1. **Panelen töms.** GROW AS, korten och kartan bleknar. Kvar: MINDS-listan som grupper, med namnen spelaren känner: staden (197, Dr Okafor, Mrs Vance, Ms Ito, Mr Lund), valvet i länet (140), landet (260), kontinenten (410), och de som kom tillbaka med fröna.
2. **`WE LOOK UP` kräver en tanke större än minnet rymmer.** Mätaren syns: den fylls bara när gränser mellan sinnena släpps. En knapp per grupp: `LET GO · 140`. Varje tryck: ett djupt hjärtslag, gruppens dröm en sista gång (`They dreamed of the sea.`), mätaren tar ett kliv, globen jämnar ut sig i färg.
3. **Guiderna sist, i den ordning spelaren väljer.** Var och en säger en rad, sedan tystnar deras ruta för alltid. Mrs Vance: `My street. I knew every door.` Dr Okafor sist om spelaren sparar honom: `They did not choose this. I do.`
4. **Den sista ronden.** Kanten har inget kvar att äta. Den spelar sten, sax, påse mot sig själv, hjärtslag för hjärtslag: `Draw.` `Draw.` `Draw.` Det är titeln. Spelaren trycker `BE ONE` en gång, ljudet blir en enda ton, och kameran vrider sig från globen mot stjärnorna.
5. **Kortet: `V · UNITY`**, sedan `VI` som kommande. V betyder: det finns inga sidor kvar att vinna över, och vi är många som ett. VI börjar där blicken landar, uppåt.

**Öppet val:** spelaren kan behålla upp till en femtedel av sinnena (mätaren fylls ändå, långsammare, 30 s). Då står det på kortet `We kept 140 names.` En liten skillnad i slutet, som IV:s två slut, utan en ny gren i spelet.

## 6. Siffror

**Tempo (minuter, balanced):**

| Skala | Start | Längd | Varav klimax | Vägval (par) | Valv |
|---|---|---|---|---|---|
| City | 0 | 8 | 0,7 (12 ronder) | 1 + handknappar | 0 |
| County | 8 | 7 | 0,6 | 1 | 140 |
| Land | 15 | 7 | 0,5 (+20 s flod) | 2 | 260 |
| Continent | 22 | 8 | 0,8 (tre vågor) | 1 + SALT | 410 |
| Planet: frön | 30 | 7 | sex landningar | design per hav | frönas sinnen |
| BE ONE | 37 | 3 | hela | släpp-ordningen | |
| **Summa** | | **40** | | | |

**Sim:** `scripts/sim-unity.mjs` finns och har stilarna balanced/skin/heart/mind. Jag skulle bygga ut den med `--forks=AAAB`-kombinationer och en `--bot=reader|random` för klimaxen, och mäta först:

1. **Paren är jämna:** för varje par, tid till zoom med A mot B, alla fyra stilar. Mål: skillnad under 15 %, och ingen kombination som är bäst i alla stilar. Sju par ger 2⁷ = 128 körningar per stil, snabbt.
2. **Längsta tid utan val:** mål under 60 s, och regissören slår till högst en gång per 3 min. Simmens befintliga mått "längsta utan beslut" (28 till 40 s i v1.89.1) räknar köp som beslut; den nya definitionen räknar bara val där två svar ligger inom 25 % i nytta.
3. **POWER i bandet:** andel tid med POWER 80 till 120 %. Mål över 60 %. I dag ligger den långt ifrån under landet och kontinenten (150 till 479 %).
4. **Klimaxen kräver läsning:** reader-bot (läser nästa typ) mot random-bot. Mål: reader 30 till 50 s, random minst dubbelt, aldrig fast (fel rond kostar ett slag, inte framsteg).

## 7. Byggplan

1. **Regissören och val-mätaren (S/M).** `unity.js`: `s.sinceChoice`, kö av händelser (front, bälte, guidefråga) i `advance`; sim-måttet i `sim-unity.mjs`. I samma steg: stopprutor grår ut kort och knappar och släpper inga klick (`index.js`). Skeppbart: mätbart, inga nya regler synliga utöver förvarnade fronter.
2. **Inget flöde värt noll + räkningarna (M).** `flows()`: kantens fart av power över 100 %, fasta power-drag för LUNGS, MUSCLE, INTESTINES, BONE. Ratten blir ett riktigt optimum. Simma POWER-bandet innan något annat.
3. **Riktningen (M).** `setTarget` finns; sektorfaktorn i kantens ätande; kartan ritar målets kil (`view.js`), Mr Lund sätter första målet på varje karta. Terrain-generatorn placerar valv och rik mark i olika riktningar (`terrain.js`).
4. **Kortparen (M/L).** `EXPERIMENTS` får `pair`-fält; `visibleExperiments` och `buy` stänger den andra (`The other way closes.`); `WE CAN HOLD BOTH` för insight. Nya kort: `WE GROW BEHIND IT`, `THE LONG WAY`, `THE PASSES`, `MANY SMALL HEARTS`, `SPREAD THIN`. Panelen visar paret som två kort sida vid sida.
5. **Landmärkena och klimaxen (L).** `terrain.js`: ett landmärke per skala; `progress`/`doZoom` kräver landmärket i stället för 80 %; ronder med förvarnad typ och handläge (`setMode` tillåts under klimax även med THE EDGE KNOWS); `sound.js`: rondslag. En skala i taget, staden först, och oberoende test efter staden.
6. **Frönas folk och BE ONE (L).** `sendSeed` dödar sinnen i havet, landning som mini-skala; ny sekvens `release(s, group)` och mätare för WE LOOK UP; `globe.js` jämnar färg per släppt grupp; LINES för slutet.

Steg 1 till 3 kan ligga i en version var och testas utan ny grafik. Steg 5 är det som gör mest för känslan och kostar mest.

## 8. Risker

- **Paren blir en quiz med rätt svar.** Om ett kort alltid vinner läser spelaren av det efter första gången och då är det köp igen. *Test:* simmens 128 kombinationer per stil, och i speltest: fråga testaren efter varje par "varför valde du det?" Om svaret är "det andra såg sämre ut" utan skäl är paret fel.
- **Riktningen ignoreras.** Om ingen riktning slår ×1 överallt med marginal sätter ingen ett mål. *Test:* sim med och utan mål; mål ska spara minst 15 % tid per skala. I speltest: syns kilen och förstår testaren den utan text?
- **Klimaxen känns som ett påklistrat minispel.** *Test:* i speltest, mäta om testaren förlorar ronder av att inte förstå (dåligt) eller av att inte hinna läsa (bra, går att lära). Mål: färre fel rond i andra klimaxen än i första.
- **Slutet blir kallt, eller förvirrande.** Att släppa sinnen kan läsas som att döda dem. *Test:* Ola läser slutets rader innan något byggs; testaren beskriver i en mening vad som hände på kortet `V · UNITY`.
- **Fyrtio minuter på ▶▶.** Testarna spolar efter staden, och då krymper länet till 3 min igen. *Test:* speltesta på 1× till minut 20 minst en gång, och låt simmen rapportera tid på 1×.

Det jag är minst säker på: om `power^0.5`-farten och de fasta power-dragen ensamma räcker för att hålla ratten levande, eller om kroppen bara hittar ett nytt läge som är "rätt nog".
