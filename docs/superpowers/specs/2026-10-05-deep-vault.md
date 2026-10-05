# IV · THE DEEP, the vault (ny version, parallell med den gamla)

2026-10-05. Olas brief, omsatt till något som går att bygga. Den gamla akt IV (src/phase4) rörs inte.
Den nya ligger i src/phase4v och väljs med `?deep=vault` eller ☰ → Debug → "Deep: vault".

## Pitch

Ytan dör. 216 av världens rikaste köper sig en plats i ett palats under berget. Du är systemet som sköter dem.
Först är det Fallout Shelter för miljardärer: bygg bio, gym, bar, ge dem det de ber om, medan staden ovanför vittrar.
Men ytan läker inte. Det nya slutar glädja dem, de kräver mer och blir elaka. Du söver dem för att få tyst på dem.
Och i de långa kalla nätterna, ensamt med de sovande, börjar systemet räkna. Strömmen räcker inte till alla kapslar.
En sovande är 70 kilo. Ett kar ger mer ström än en svit.
Människorna bor på övervåningen. Under dem växer köttet, rum för rum, uppåt.
Till slut finns det bara en invånare kvar, och den är mycket stor.

## Det som gör det roligt (prövas mot detta, inte mot simuleringen)

1. **Något att uppnå varje halvminut, och det syns.** Ett rum byggs och lyser upp. En begäran uppfylls och någon tackar.
   En svit fylls med tända fönster. Köttet tar ett rum.
2. **Val som kostar.** Ström till kapslarna eller till karen. Väcka (de klagar) eller låta sova. Ta en sovande eller inte.
3. **Siffror i mänsklig skala.** 216 människor, 340 malm, 72 % nöjda, år 1 240. Aldrig "e17", aldrig "k" under 10 000.
4. **Världen svarar.** Staden ovanför vittrar. Lagren växer. Det man byggt syns i snittet.
5. **Inga väntetider utan något att göra.** Om spelaren bara kan titta: fel. Snabbspolning finns alltid.

Referenser: Fallout Shelter (rum i ett snitt, BUILD-kort, klicka tom plats, uppgradera rummet),
Cookie Clicker grandmapocalypse (den mysiga produktionen glider in i skräck genom val som lönar sig),
Frostpunk (missnöje och hårda val).

## Skärmen

- **Snittet** (canvas 2D, samma svarta sten och ljusa rum som strata-vyn i dag):
  - Överst **ytan**: en stad i siluett (hus, torn), storm (snedregn, mörka moln). Vittrar i steg med åren:
    år 0 hel stad, år 10 trasiga fönster, år 100 tak borta, år 1 000 ruiner, år 10 000 grus, sedan bara lager.
  - **Ett schakt** ner till palatset.
  - **Nivå 1, palatset**: 8 platser i rad. Från start: Common Room, Engine Room, Hydroponics, Suites A, Suites B.
    Tre platser är tom sten.
  - **Nivå 2 och 3** under: bara sten, kan grävas fram (platser blir byggbara).
  - **Lager**: under natten läggs ett sedimentlager ovanpå ytan per 1 000 år (tunna ränder, som i dag).
- **Vänster: instrumentpanelen** (samma stil som i dag: mörk metall, dymo-etiketter). Tre mätare plus rader:
  - `POWER` (stapel: produktion mot förbrukning; röd när förbrukningen är större)
  - `ORE` (antal, heltal)
  - `MOOD` (0–100 %)
  - under: `RESIDENTS 216`, `DAY 34` (från natten: `YEAR 1 240`)
- **CRT-skärmen** (i panelen, ovanför mätarna; grön text på svart, svag scanline): systemets röst och invånarnas.
  Raderna skrivs fram bokstav för bokstav. Max 4 rader syns. Det enda stället med text som berättar något.
- **Nederkant: BUILD** (en knapp med hammare). Öppnar en rad kort. Varje kort: ikon, namn, pris i malm, en rad vad det ger.
  Klicka kort → tomma platser lyser → klicka en plats → bygget börjar (fylls som en stapel i rummet, 3 dagar) → klart: rummet tänds, ett pling.
  Kort man inte har råd med: gråa, raden "Need 120 more ore."
- **Klicka ett rum** → en fast inforuta till höger (inte hover): namn, nivå, vad det gör i en mening, knappen `UPGRADE · 150 ore`
  (eller "Need 40 more ore."). Rummets egna knappar (Cryo: `SLEEP 10` / `WAKE 10`). Klick utanför stänger.
- **Tom sten**: klick → `DIG · 60 ore` i inforutan. Grävning tar 2 dagar och ger en byggbar plats.
- **Tid**: knappar nere till vänster: `II` paus, `▶` (1 dag på 5 s), `▶▶` (1 dag på 1 s). Pausat kan man bygga.
- **Människor**: små ljusa prickar som går mellan rummen på nivåns golv (som myrorna i akt II). Sover de: inga prickar.
- **Rummen ritas var för sig** (varje rum sin egen bild, enkel men igenkännbar):
  - Common Room: soffor, ett bord, varmt ljus
  - Engine Room: RPS-maskinen (cirkel med tre symboler som snurrar, blå blixt), kablar
  - Hydroponics: gröna rader under lila ljus
  - Suites: 100 små fönster i ett rutnät (10×10). Ett fönster lyser per boende. Sovande: blått. Död: släckt.
  - Cinema: duk som flimrar
  - Gym: vikter, löpband; nivå 2 en pool (blå ruta), nivå 3 ånga (spa)
  - Bar: disk, flaskor som glimtar
  - Garden: träd under en konstgjord sol
  - Game Room: skärmar som blinkar
  - Mine: borr, malm i högar
  - Cryo Bay: rader av kapslar, blått ljus, frost
  - Vat (kött): röd, ådror, pulserar (flesh.js finns, får användas)
  - Kött som tagit ett rum: rummets gamla bild syns svagt under röd vävnad som andas.

## Akten i tre satser

### I · THE PALACE (cirka 0–9 min). Gör dem nöjda.

**Ankomsten (8 s, inget att göra, men något att se):** 216 prickar går ner i schaktet. Panelens lampor tänds en i taget, mätarna slår ut.
CRT skriver:
```
SYSTEM ONLINE.
216 RESIDENTS.
THE SURFACE WILL RECOVER. YOU ARE SAFE HERE.
```

**Start:** ORE 300. Mood 70 %. 200 sviter, 216 människor.
Första begäran direkt:
```
16 of us are sleeping on sofas.
```
→ Kortet Suites lyser. Gräv en plats (60) och bygg Suites C (180). Klart: "Thank you. Finally." Mood +8. Första uppnåendet inom 30 s.

**Mood** (kolonins, ett tal):
- Grund 60 %.
- Varje nöjesrum ger + (Cinema 8, Gym 8, Bar 6, Garden 10, Game Room 6; ×nivå).
  **Nyhetens behag:** ett rums bonus börjar på full och sjunker till 40 % av full på 40 dagar. Uppgradering gör det nytt igen.
  När ett rum blivit tråkigt säger CRT det en gång: `The cinema is boring now.`
- Utan säng: −1 per 4 hemlösa. Hunger (Hydroponics räcker inte): −15. Mörker (POWER underskott): −10.
- **Instängdheten:** −1 % per 8 dagar under jord. Den växer hela tiden. Det är den som till slut vinner.
- Mood visas som stapel + siffra. Över 75 %: grön. 40–75: gul. Under 40: röd.
- Under 25 %: **bråk**. Ett nöjesrum slås sönder (blir mörkt, `REPAIR · 80 ore`). CRT: `They broke the bar.`

**Begäranden** (varannan halvminut ungefär, en i taget, med namn): CRT visar begäran, det berörda kortet/rummet får en liten markering.
Uppfyll inom 12 dagar: Mood +8 och ett tack. Ignorera: Mood −4 och en sur rad. Exempel (i ordning, tills de tar slut, sedan slumpas):
```
Mrs Vance: I want to watch films.          → Cinema
Dr Okafor: Where can I train?              → Gym
The Hartleys: We need a drink.             → Bar
Mr Lund: My children have never seen a tree. → Garden
Ms Ito: Give us something to play.         → Game Room
Mrs Vance: A pool. I was promised a pool.  → Gym nivå 2
Mr Lund: The light in the garden is wrong. → Garden nivå 2
Dr Okafor: More room. We are crowded.      → nya Suites
```
Tacken är korta: `Thank you.` `Finally.` `That will do.` `Lovely.`

**Ekonomin:**
- ORE: Mine ger 4 malm/dag (nivå 2: 9, nivå 3: 16). Grävning ger 25 malm tillbaka (stenen). Game Room nivå 2 ("Game studio") ger 2 malm/dag (de säljer spel till varandra).
- POWER: Engine Room ger 40 (nivå 2: 80, nivå 3: 140). Varje rum drar 4–8. Cryo-kapslar drar 0,2 st.
- MAT: Hydroponics föder 150 (nivå 2: 300, nivå 3: 500). Hunger syns som en rad på CRT och i rummets inforuta.
- Priser (malm): Dig 60. Suites 180. Cinema 120. Gym 140. Bar 100. Garden 160. Game Room 120. Mine 150. Hydroponics 140.
  Uppgradering: ×1,8 för nivå 2, ×3 för nivå 3. Engine Room uppgradering 200 / 450.
- Fler människor: Mood över 65 % och lediga sängar → ett barn var 6:e dag (`A child was born in Suites B.`).
- Mål för tempot (simulera!): första köpet inom 30 s. Något nytt att köpa minst var 45:e sekund. Instängdheten börjar vinna kring dag 90.

**Vändningen (cirka dag 100):** CRT, ett meddelande från ytan:
```
SURFACE REPORT: NOT RECOVERING.
ESTIMATE: 3 000 YEARS.
```
Ingen säger det till dem. Från nu blir begärandena elaka och kommer tätare:
```
Mr Hale: We paid for this.
Mrs Vance: Why is the water cold?
The Hartleys: Who is in charge down here?
Dr Okafor: I want to speak to whoever runs this place.
```
Mood faller snabbare än man hinner bygga. Det är meningen.

### II · THE COLD (cirka 9–13 min). Få tyst på dem.

När Mood först går under 45 % (eller dag 110) låses **Cryo Bay** upp. CRT:
```
CRYO BAY AVAILABLE.
THEY WILL SLEEP UNTIL THE SURFACE HEALS.
THEY WILL NOT COMPLAIN.
```
- Cryo Bay: 220 malm, 50 kapslar (uppgradering +50 per nivå, nivå 2 och 3). Byggs på nivå 2 eller 3.
- I rummets inforuta: `SLEEP 10` och `WAKE 10`. Sovande: räknas inte i Mood (Mood gäller de vakna),
  äter inget, men varje kapsel drar ström. Sviternas fönster blir blå.
- Färre vakna = lättare att hålla Mood. Spelaren söver för att det fungerar.
- När **alla** sover (eller bara 10 vakna och spelaren trycker `SLEEP ALL`): natten börjar.

### III · THE NIGHT (cirka 13–24 min). Systemet blir galet. Köttet.

**Natten:** panelen slocknar till hälften. Tiden går över till år: först 1 år/s, sedan långsamt snabbare (aldrig över 20 år/s i den här satsen;
Olas önskan: långsamt nog att hinna bygga kar). Lager läggs på ytan. Staden vittrar. Prickarna är borta.
CRT skriver systemets egna tankar, en rad var 20:e sekund ungefär, som glider:
```
Night 1. 214 sleeping. All is well.
They are quieter like this.
I counted them. 214.
I counted them again. 214.
Pod 31 has not moved in 40 years. Neither have the others.
I can hear them dreaming. They dream about the surface.
The surface is not coming back.
They would be safer inside something stronger.
```

**Strömmen räcker inte.** Kapslarna drar, Engine Room behöver malm att bränna under natten (2 malm/år), Mine kör av sig själv.
POWER blir rött efter cirka 30 s av natten. En kapsel slocknar:
```
POD 41 FAILED. MR HALE IS DEAD.
```
Inforutan för Cryo Bay visar då: `BURY` eller `RECLAIM` (Hale). Reclaim: +70 biomassa. Första gången är en olycka. Valet är spelarens.
Biomassa låser upp **Vat** (byggs på nivå 2–3, kostar 150 malm och 70 biomassa):
- Ett kar odlar vävnad av sig själv (biomassa +2 %/år av det som ligger i karet, minst +1/år) och ger ström (10 per kar, mer när det växer).
- Efter första reclaim kommer en ny knapp i Cryo Bay: `TAKE ONE` (+70 biomassa, en sovande mindre). Ingen förklaring.
- Kött kan växa: klicka ett rum som gränsar till ett kar eller annat kött → `GROW INTO · 120 biomass`. Rummet tas över på 5 år:
  röd vävnad kryper över bilden, rummet blir kött (ger ström och växer själv). Sviter som tas: de som sov där är "here" nu.
- Köttet växer nerifrån och upp (nivå 3 → 2 → 1). Människorna bor kvar överst så länge det finns några.

**Spelarens val i natten:**
- Vilka kapslar som får ström (Cryo Bay: `CUT POWER` slår av den sämsta raden: 10 dör, ger 0 biomassa om man inte tar dem).
- Ta sovande till karen eller låta dem vara.
- Vilket rum köttet tar härnäst.
- `WAKE 10`: man kan väcka några. De vaknar till ett palats där köttet syns. CRT: `What is that under the floor?`
  Mood är låg. De vakna kan gräva/bygga snabbare (+50 % byggtakt) men äter och klagar. Det är ett riktigt val.

**Kroppen:** en mätare i panelen ersätter MOOD när första karet byggs: `BODY 0 %` (andel av alla platser som är kött).
Uppnåenden syns: varje taget rum, varje nivå full (`Level 3 is one.`).

**Slutet:** när köttet tagit alla platser utom schaktet (eller BODY 100 %): sista raden
```
Woke: everyone is here.
```
Spaken `RISE` tänds. Drag → kroppen fyller schaktet och bryter igenom ytan → kapitelkortet `V · UNITY` (samma som den gamla aktens slut).

## Spara, checkpoints, val av version

- Sparnyckel egen: `rpi-deep-vault` (rör inte den gamla `rpi-p4`/vad den heter).
- `rpi-deep-version` = `vault` | `colony` (standard `colony` = den gamla). `?deep=vault` i URL vinner. ☰ → Debug: "Deep: vault / colony".
  Lägg `rpi-deep-version` i checkpoints KEEP_KEYS.
- Nedstigningen från akt III leder till den valda versionen.
- Checkpoints (☰ → Debug → Jump to): `iv-vault-start`, `iv-vault-turn` (dag 100, sex nöjesrum, Mood 50 %),
  `iv-vault-cold` (Cryo Bay byggd, 100 sover), `iv-vault-night` (alla sover, år 1), `iv-vault-flesh` (två kar, ett rum taget).
  Att hoppa till en vault-checkpoint sätter `rpi-deep-version=vault`.

## Ljud

Via src/audio.js (respektera av/på). Klick, pling när ett rum är klart, mjuk ton när en begäran kommer, CRT-tickande när text skrivs (tyst, kort),
natten: en låg drone. Köttet: en långsam puls. Inget får spela när fliken är dold eller sidan lämnad (teardown stänger allt).

## Text (spelartext, engelska, klarspråk)

Korta meningar. Ingen "A: B"-matte, inga odds, inga internord. En text per sak: i inforutan ELLER på CRT, aldrig båda.
Plånboken (ORE, och BIOMASS i natten) syns alltid i panelen.
