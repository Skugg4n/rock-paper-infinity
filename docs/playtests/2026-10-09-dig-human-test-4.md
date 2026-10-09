# IV · the dig, mänskligt test 4 (v1.92.2)

2026-10-09. Headless Chrome 1440x900, ljud av, riktiga tangenttryck, spelet pausat medan jag läste. Ny spelare. `iv-dig-start` 5:24 speltid (inte 12, tidsrutan räckte inte; en kort autopilottur räknas bort), sedan `iv-dig-machine` och `iv-dig-flesh` ca 10 s vardera (båda slutade snabbt, se nedan), `iv-dig-heart` till RISE. 69 skärmdumpar i `docs/playtests/dig-test4-shots/` (ej committade). Inga sidfel. Inget kapitelkort vid laddning, varken från start eller från checkpoints: man landar direkt i basen och CRT-texten skrivs fram.

## 1. Dom: NÄSTAN

Första fem minuterna är nu ett riktigt spel (gräv, hem, verkstad, labb, laga), och gas och magma ger val. Men dödsfallen saknar orsak, bas-pressen är för mjuk och RISE slutar fortfarande i "V UNITY TO COME".

## 2. Styrningen nu

- Före STEERING (0:00 till 2:17): ett tryck = två rutor, och UPP mot berg gör ingenting utan text. Det kostade min första drönare (1:12, nio rutor under basen).
- Med STEERING (15 PARTS, kom 2:10): korta tryck i berg = exakt en ruta. Paritetsfällan vid schaktet är borta, jag träffade schaktet varje gång.
- Kvar: i öppen tunnel glider ett tryck två rutor, eller så faller drönaren om golvet saknas. Svårt att ställa sig precis under malm.
- Håll UPP + sida fungerar bra för hemvägen, men det står fortfarande ingenstans.

## 3. Utmaning: gör farorna och generatorn val?

- **Gas (3:56):** ja. Grönt bubblande, varning "Gas from the war. It burns." när lampan träffar. Jag borrade in med flit: POWER 86 → 29 på en gång. Då måste jag hem. Bra val. Men inget sades i ögonblicket, bara stapeln föll.
- **Magma (machine, 11:10):** syns på långt håll som orange glöd, "Magma. Do not open it." Bra. Men när jag rörde den dog drönaren inom cirka en sekund. Spec H1 säger en ruta per 1,5 s och att HULL håller en stund. Det kändes som en fälla, inte ett val.
- **Ras:** såg jag inte (grävde inga stora hålrum).
- **Generatorn:** nej, inget val än. Den sjunker ca 0,2 % per sekund och varje leverans fyller till ~100 %. Lägsta jag såg på 5 min: 85 %. GENERATOR II (40 PARTS) vid generatorn tävlar aldrig om pengarna.
- **Kammarlarmet (3:00, CHAMBER 5 · 123 s):** jag stod hemma, körde dit och lagade på 3 s. Ingen press den gången. Lagningen tog 22 av mina 23 PARTS och jag såg inget pris innan.

## 4. Förlorad drönare + vrak

- Känns rätt. "The drone is lost. Build another.", BUILD A DRONE · FREE, ny drönare på ca 3 s, DRONE 2 i panelen. Vraket låg kvar i schaktet och när jag föll förbi det: "Half of its cargo was still there." (3 av 6 malm). Bra liten belöning.
- Saknas: varför den dog. Båda gångerna (tomt batteri, magma) bara samma stopp. "Magma took DRONE 2." hade räckt.
- Gratis bygge gör förlusten billig: man förlorar last och en resa. Okej så tidigt.

## 5. ORE och PARTS

Tydligt. "8 ORE → 26 PARTS" flyger upp i WAREHOUSE, fynd säger "+30 PARTS" direkt, CARGO har malmikoner och PARTS en kugge. Två saker skaver: ikonerna i CARGO är små (◆3 ◆5), och jag ser inte hur generatorn får sin malm när all malm blir PARTS (generatorn steg ändå 85 → 89 %).

## 6. Första testarens topp 5

1. **STEERING I-fällan:** delvis fixad. Med STEERING är den borta och den kommer tidigare (2:10). Före köpet är två-stegs-trycket och tysta UPP kvar och kostade mig en drönare.
2. **Döda sovande ska sägas:** ej testat, ingen kammare dog (216 hela tiden).
3. **GENERATORS-stopp:** fixat. "The generators keep them alive. Ore keeps the generators running." när mätaren dyker upp. Vad som händer vid 0 såg jag inte.
4. **Fast reparationspris + kvittens:** kvittens fixad ("Chamber 5 is mended."). Pris: inte synligt för mig, lagningen tog 22 PARTS utan förvarning.
5. **Kvantobjekt synligt och nåbart:** fixat. Lila ruta syns på långt håll, ordet QUANTUM OBJECT när man tar det, båda jag hittade gick att nå. UPWARD DRILL finns.

## 7. Döda och förvirrande stunder (speltid)

- 0:11 UPP mot berg under malm: inget händer, ingen text (UPWARD DRILL fanns inte än).
- 0:15 höll vänster in i basen och körde rakt igenom WAREHOUSE utan att lasta av. Man måste stanna inne.
- 0:40 till 1:12 första förlusten: UPP i en återvändsgränd lyfter och faller tillbaka, åt ström. "Turn back" kom vid 15/60 men min väg hem var längre än den raka. Död 9 rutor under basen.
- 0:45 till 4:00+: den röda raden "Turn back. Just enough power to fly home." står kvar i CRT:n hela tiden, och den skrevs IGEN mellan "Almost." och "Woke: everyone is here." vid hjärtat.
- 1:44 till 1:55 och 3:00: NER bredvid schaktet i basen (x12, x16) gör ingenting.
- 2:40 labbet blev klart medan jag var nere: inget meddelande. Raden QUANTUM OBJECT försvann bara. (Andra gången, hemma, kom ett stopp.)
- 3:56 gas: POWER −57 utan text.
- 4:39 "Too hard. Needs DRILL 2." DRILL dök upp i verkstaden med "Steel bit. Next: digs faster." Först efter köpet stod "Next: breaks hard rock (300 m)".
- UPWARD DRILL visade ■□□ på nivå 0, BATTERY □□□□□ på nivå 0. Rutorna betyder olika saker.
- Machine 11:10: magma, död efter ca 1 s, ingen orsak.
- Flesh: håll NER 8 s → föll rakt till hjärtat på 1990 m. "Turn back" fast stapeln var full (160/160).
- Efter RISE: "V UNITY TO COME". Samma återvändsgränd som test 3.

## 8. Topp 5

1. **Säg varför drönaren dog och sakta ner magman enligt H1.** "Magma took DRONE 2." / "Gas. −57 POWER." och en ruta per 1,5 s så att man hinner backa.
2. **Rensa gamla rader.** "Turn back" ska bort när man är hemma, och får aldrig skrivas vid hjärtat. Samma regel för alla statusrader.
3. **Ge basen tänder.** Generatorn ska kunna gå under 50 % på en normal tur, eller larm medan man är nere, så att GENERATOR II och hemresan blir ett val. Visa lagningspriset i larmraden.
4. **Första två minuterna:** UPP mot berg ska säga "Can't dig up. UPWARD DRILL." och STEERING ska erbjudas vid första leveransen, inte efter första förlusten.
5. **Små basgrejer:** lasta av när man kör igenom WAREHOUSE, NER i basen går till schaktet, labbet meddelar även när man är nere, DRILL säger "breaks hard rock" från början, samma ruta-logik på alla rader.

Behåll: lugna ankomsten, en rad i taget i verkstaden (val landar på det man har råd med), "8 ORE → 26 PARTS", gasens gröna bubblor, magmans glöd i mörkret, vraket med halva lasten, maskinlagret, hjärtat.
