# V · UNITY, mänskligt test 2 (2026-10-08, v1.89.0)

En headless Chrome (playwright, 1440x900, ljud av), riktiga klick, från `v-start`. Skärmdumpar i `unity-test2-shots/` (00-40, ej committade). Tider är spelets klocka (t) och realtid. 1× i staden till t=640, sedan ▶▶. Totalt 24 min realtid: staden 13 min, länet 3, landet 1,5, kontinenten 2,5, planeten 3 (fast).

## 1. Dom: NÄSTAN
Staden är nu ett riktigt spel i 5 minuter och zoomen sitter, men efter t=306 kommer flaskhalsen bara tillbaka i korta stötar, och på planeten (t=1669) tar spelet slut: "MISSION: BE ONE", +0 m² a day och inget att göra.

## 2. Paperclips-känslan
- **Flyttade flaskhalsen?** I staden ja, t=95 till 306: Full, Starving, Thin, Weak pulse, Thin igen (storm). Varje rött ord hade ett reglage som lyste i samma färg och en rad från Dr Okafor. Det var bra.
- **Tyst 1: staden t=306 till 677 (6 spelminuter, ca 5 min realtid).** Inget rött eller gult. Jag köpte kort och tittade på kroppen. Det som egentligen bromsade var thought (+5 a day), men det sa ingenting. Jag hittade själv att NERVE upp gav mer thought.
- **Länet (3 min) och landet (1,5 min):** Choking, Far from the gut, Mountains, Sagging, Stuck. Varje ord löstes med ETT köp inom 30 s. Flaskhalsen flyttar sig, men den är ett köp, inget beslut.
- **Tyst 2, slutet: planeten från t=1669.** "Nowhere to grow." i 1 min, sedan försvinner det röda men kroppen står på 9 % med +0 m² a day. Jag väntade 3 min realtid (t=2169), insight växte till 250 utan att gå att använda.

## 3. Bästa stunderna
- t=167: kroppen får två ögon på 0,11 km². Från då vill man se den växa.
- Dr Okafor och Mrs Vance: rådet är exakt och kort, minnena ("My street. I knew every door.") ger staden en vikt.
- Zoomen t=677: den lilla röda klumpen med ögon i ett nytt landskap med flod, medan "The city is ours." står kvar. Ingen svart skärm.
- Kontinenten (skärmdump 33): ben, naglar, tarmar och ögon syns som saker i kroppen. Man ser vad man köpt.

## 4. Döda eller förvirrande stunder
- **0:00 till 1:30, handbitandet:** "Room for 4 more blocks", 4 bett, "Full. Grow first." Fungerar nu, men de tre organknapparna säger inte vad de gör (alla tre ger "room", hover visar inget). Jag gissade.
- **t=95, AUTONOMIC EDGE:** jag hade 2 270 nutrient sparat för fyra organ. Köpet tog bort knapparna och saldot direkt ("In the gut: 128", Starving). Ingen varning.
- **t=131 till 440, EDGE för hand:** terrängen byter var ~30 s. Fortfarande syssla, men nu tar THE EDGE KNOWS (750 thought) över efter 5 min. Det är ett mål att spara till, bättre än förr.
- **t=209 och t=882, stopprutorna:** STORM och "140 minds join us." pausar spelet. Korten och knapparna ser lika köpbara ut som annars, mina klick på CRUSH och WE CAN PULL försvann tyst.
- **Thought-taket krymper på planeten:** 14 931, 13 833, 13 305. Mätaren står full och sjunker.
- **SEEDS (5 insight, t≈1564):** "We send seeds across the sea." Jag köpte det. Ingen knapp, ingen markering på kartan, klick på andra landmassor gör inget. Spelets logik har en `sendSeed`, men inget i gränssnittet anropar den.
- **Smått:** TISSUE och EYES gråas ut på 0 utan förklaring (skärmdump 29). Loggen klipps i panelens underkant på kontinenten (skärmdump 33). Staden har ingen klimax: "The city is ours." och OK.

## 5. Första testarens topp 5
1. **Handbitandet:** DELVIS. Vägrat bett säger "Full. Grow first.", knapparna lyser, saldot syns, "Starving" med fullt konto syns inte längre i handfasen. Kvar: organknapparna förklarar sig inte, och saldot försvinner tyst vid AUTONOMIC EDGE.
2. **Tempot efter 5 min:** INTE FIXAT. Staden tyst t=306 till 677. Länet 3 min, landet 1,5 min, kontinenten 2,5 min. Röda ord kommer, men ett köp löser vart och ett.
3. **"+0.00 km² a day":** FIXAT. MASS visar "+160 m² a day", "+720 m² a day", sedan km².
4. **Zoomen:** FIXAT. Nya kartan syns runt kroppen medan rutan står där.
5. **Panelen och stopprutorna:** DELVIS. MINDS syns nu även med 14 reglage. Kvar: korten är inte grå medan rutan pausar, och loggen klipps längst ner. (Valvets "0 ROOMS LEFT" testade jag inte.)

## 6. Utseende
Kroppen är kapitlets styrka: fiber, ådror från ett centrum, ögon, magar, tarmar, ben, naglar. Staden är ett mörkt rutnät, floden syns, husen läses inte som hus. Länet, landet och kontinenten är suddiga fläckar i grönt, grått och lila. Det fungerar som bakgrund men man ser inte vad "Mountains" är förrän ordet står där. Planeten är kroppen på en suddig blå yta, mest tomt.

## 7. Topp 3 att fixa
1. **Planeten är en återvändsgränd.** Antingen ett gränssnitt för SEEDS (klicka en kontinent, se odds och kostnad) eller stoppa kapitlet efter kontinenten med ett slut. Visa aldrig "MISSION: BE ONE" utan en väg.
2. **Flaskhalsen ska tillbaka efter t=300 och vara ett val, inte ett köp.** Låt thought bli det röda ordet när det är thought som bromsar ("Slow mind", peka på NERVE). I länet och landet: låt ett rött ord kräva att man flyttar reglage, inte bara köper nästa kort.
3. **Pausrutor och övergångar:** grå ut kort och knappar medan en ruta pausar. Varna innan AUTONOMIC EDGE ("Spend your nutrient first, the gut takes it"). Låt organknapparna i handfasen säga vad de ger ("Skin: room, costs power", "Heart: power").
