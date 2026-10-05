# The vault, story pass: the steak, the goal, the organs (Ola 2026-10-05)

Ola: "I LOVE Vault so far. So funny stupid." Men: "we don't understand why we want to be bio and what we're supposed to do,
except the only thing to do is biomass everything." Och: "more build up to the change into biostuff."
Godkänt av Ola: köttlabbet via Mr Hales steak, målet att få upp dem, organ med uppgifter. Plus: kommunicera viktiga
ögonblick (tiden saktar in, pling, markering på skärmen) och invånare som är irriterade på "Computer".

Spelartext nedan är ordagrann (engelska). Inga em-dash.

## 1. Köttet kommer in som lyx (akt I)

- Runt minut 3–4 (efter de första fem önskemålen): `Mr Hale: I want real steak.`
  Låser upp kortet **MEAT LAB** (160 ore, byggs på nivå 2 eller 3). Kortets rad: `Grows real meat in vats. Mood +6.`
  Rummets inforuta: `Real meat, grown in vats. Nobody asks from what.`
  När det är byggt: `Mr Hale: Finally. Real steak.`
- Senare önskemål: `Mrs Vance: More steak. Everyone wants steak.` → MEAT LAB nivå 2.
- Önskebubblan med en köttbit (stek-ikon) dyker upp när labbet finns.
- MEAT LAB ger mat (räknas med Hydroponics) och mood som ett nöjesrum.

## 2. Vändningen och kylan: köttet räddar dem

- Vid vändningen (SURFACE REPORT) går Hydroponics ner: `The hydroponics are failing. The lamps are old.`
  Hydroponics föder hälften. MEAT LAB föder resten om det finns. Utan MEAT LAB: hunger.
- Första gången en invånare dör (bråk, schaktet): dagen efter, en invånare: `The steak tastes different tonight.`
  Ingen förklaring.
- THE COLD: systemets rader när folk söver (en per 20 s, blandat med de vanliga):
  `Sleeper 41. 70 kg.` `Sleeper 42. 64 kg.` `Sleeper 43. 81 kg.` (vikterna slumpas 50–95)
- Natten: RECLAIM och TAKE ONE skickar till MEAT LAB. Vat (kortet) heter nu **VAT**, men med texten
  `The meat lab, grown up.` och samma bild som labbet, större. Finns ingen MEAT LAB när natten börjar: första RECLAIM bygger ett gratis.

## 3. Målet: få upp dem

När natten börjar (alla sover), tiden saktar in, pling, och CRT skriver med markering:
```
THE SURFACE WILL NOT RECOVER.
THEY CANNOT LIVE UP THERE.
SOMETHING STRONGER COULD.
GOAL: GET THEM TO THE SURFACE.
```
Panelen får en checklista (fyra rader med en ruta var, bocka när klart) och en räknare:
```
HEART      ☐
LUNGS      ☐
SKIN       ☐
STOMACH    ☐
INSIDE     0 / 214
```
RISE tänds när HEART, LUNGS och SKIN finns och alla som lever är INSIDE (kroppen har tagit alla Cryo Bays / alla sovande).
STOMACH är inte krav, men den som skaffar den får råd med resten.

## 4. Organen

GROW INTO ett rum (eller berg) ger nu ett val: vad rummet blir. Inforutan visar knapparna (bara de man har råd med lyser):

| Organ | Kostnad (biomassa) | Gör | Rad när det är klart |
|---|---|---|---|
| `TISSUE` | som i dag | binder ihop, ger lite ström | (ingen rad) |
| `STOMACH` | 150 | äter berg: biomassa +1 per år per magrum | `A stomach. It eats the rock.` |
| `HEART` | 250 | ström +40, maskinen behövs inte längre | `A heart. It beats for all of them.` |
| `LUNGS` | 350, kräver HEART | krav för RISE | `Lungs. The air up there is poison. Not to us.` |
| `SKIN` | 350, kräver HEART, måste ligga på nivå 1 | krav för RISE | `Skin. Let the storms come.` |

Knapparnas förklaringsrad (under knappen, som de andra nattknapparna):
- STOMACH: `Eats the rock. More biomass every year.`
- HEART: `Power for everything. The engine can rest.`
- LUNGS: `To breathe up there.`
- SKIN: `To take the storms. Only on the top level.`
- TISSUE: `Just more of the body.`

Ett organ ritas tydligt som sitt organ (hjärta som slår, lungor som andas, hud som spänns, magsäck som vrider sig),
i samma köttstil som resten. Inte söta, inte ögon.

Balans: biomassan ska vara knapp hela natten (spelaren har alltid nästan råd med nästa sak). Valet "vem tar jag för att bygga nästa organ"
ska kännas. Mål: natten från första kar till RISE 6–8 min, ett beslut minst var 30:e sekund.

## 5. Viktiga ögonblick syns

Lista (och bara dessa): första begäran, MEAT LAB öppnas, vändningen (SURFACE REPORT), Cryo Bay öppnas, första döda,
natten och målet, första organet av varje sort, första fulla våningen, RISE redo.
- Tiden saktar in till en fjärdedel i 3 s (även från ▶▶), och går sedan tillbaka till spelarens fart.
- En pling (src/audio.js).
- Raden på CRT skrivs i bärnsten (amber) i stället för grönt, med en tunn understrykning som blinkar två gånger, och står kvar lite längre.

## 6. "Computer"

Invånarna tilltalar systemet som `Computer`. Raderna används när en önskebubbla missas, när ett bygge tar tid, och tätare efter vändningen.
Missad bubbla (en rad ibland, inte varje gång):
```
Computer! My drink!
Computer, are you even listening?
COMPUTER.
Is this thing broken?
Computer, I asked nicely.
```
Bygge som tar tid: `Computer, how long does a cinema take?` (rummets namn)
Efter vändningen:
```
Computer, we pay for your electricity.
Computer, open the shaft. I want to see the sky.
Computer, why are you so slow?
Who programmed this thing?
```
I natten, när tre väcks av TAKE ONE: `Computer? Computer, what is that?`

## Byggt, fas A (regler, text, balans; v1.86.5 tillsammans med fas B)

Kod: `src/phase4v/story.js` (orden, organen, ögonblicken, Computer, vägningen), `vault.js` (reglerna), `wishes.js`
(stekbubblan, Computer vid missad bubbla), tester i `story.test.js`. Skärmen (fas B) läser:

- **Organ per rum:** `organOf(room)` → `tissue | stomach | heart | lungs | skin` (null för kar och levande rum),
  `isVatRoom(room)` (ett Vat eller köttlabbet när natten väckt det). Köttlabbet är `kind: 'meatlab'`.
- **Checklistan:** `goal(s)` → `{ shown, heart, lungs, skin, stomach, inside, total, ready }`. `shown` blir sant när målet sagts.
- **Organvalet i inforutan:** `actionsFor` ger fem knappar med `group: 'grow'`, `organ`, `label` (`HEART · 250 biomass`),
  `ok`, `need`, `hint`. TISSUE har kvar id `grow`, de andra `grow-stomach` osv. På ren vävnad: fyra organknappar (vävnad kan bli organ).
- **Viktiga ögonblick:** raderna i `s.out` har `mark: true`; `s.slow` (sekunder kvar av saktad tid, reglerna saktar själva);
  ljudhändelsen `moment` i `s.sfx` (pling i fas B, sound.js har ingen mappning än).
- **Computer:** raderna har `computer: true` (`who: 'res'`).
- **Checkpoints** bär med sig ögonblicken de redan haft; `iv-vault-night` säger målet när man hoppar dit.

**Simuleringen** (`node scripts/sim-vault.mjs`, två magar; `--stomachs=1`, `--trace`):

| min | phase | day/year | residents/asleep | ore | power make/use | mood/body | bio | bought | request |
|---|---|---|---|---|---|---|---|---|---|
| 0 | palace | day 0 | 216/0 | 241 | 40/20 | mood 70% | 0 | dig | 16 of us are sleeping on sofas. |
| 1 | palace | day 13 | 217/0 | 154 | 40/26 | mood 71% | 0 | mine+ suites dig | - |
| 2 | palace | day 26 | 218/0 | 137 | 40/42 | mood 77% | 0 | cinema dig cinema dig bar dig | Where can I train? |
| 3 | palace | day 38 | 220/0 | 38 | 40/52 | mood 94% | 0 | gym dig game dig garden | My children have never seen a tree. |
| 4 | palace | day 50 | 221/0 | 45 | 40/64 | mood 91% | 0 | dig mine dig meatlab dig | I want real steak. |
| 5 | palace | day 63 | 223/0 | 114 | 80/71 | mood 91% | 0 | bar+ engine+ gym+ | A pool. I was promised a pool. |
| 6 | palace | day 77 | 224/0 | 160 | 80/80 | mood 91% | 0 | cinema+ mine+ cinema+ | The light in the garden is wrong. |
| 7 | palace | day 89 | 226/0 | 171 | 80/88 | mood 72% | 0 | game+ garden+ meatlab+ | More room. We are crowded. |
| 8 | palace | day 102 | 227/0 | 151 | 80/96 | mood 65% | 0 | suites dig bar+ cinema+ | A sauna. Is that too much? |
| 9 | palace | day 115 | 227/100 | 188 | 80/130 | mood 59% | 0 | cinema+ cryo dig cryo sleep50 dig sleep50 | Who is in charge down here? |
| 10 | night | year 3 | 227/227 | 178 | 79/65 | mood 0% | 0 | cryo dig sleep50 cryo dig cryo sleep50 dig SLEEP ALL | - |
| 11 | night | year 95 | 217/217 | 65 | 64/63 | body 17% ---S in 4/221 | 297 | take stomach sleep all take reclaim stomach sleep all reclaim take reclaim heart sleep all reclaim reclaim | - |
| 12 | night | year 221 | 100/100 | 344 | 96/28 | body 29% HL-S in 120/220 | 156 | take reclaim lungs sleep all grow grow | - |
| 13 | night | year 394 | 0/0 | 721 | 108/0 | body 38% HL-S in 220/220 | 13 | grow grow grow | - |
| 14 | night | year 621 | 0/0 | 721 | 142/0 | body 54% HL-S in 220/220 | 93 | grow grow | - |
| 15 | night | year 897 | 0/0 | 721 | 164/0 | body 63% HL-S in 220/220 | 277 | grow grow | - |

Steken 3:30, labbet byggt 4:05, vändningen 7:47, Cryo Bay 8:30, natten 9:56, Mr Hale 10:10, magen 10:28, hjärtat 11:06,
lungorna 11:30, nivå 3 full 12:49, alla INSIDE ca 13:00, huden och RISE 15:39. Natten från första kar till RISE:
5:28 med två magar, 6:05 med en. Längsta glapp mellan beslut i natten 31–32 s. Biomassan räcker nästan aldrig:
spelaren köper i stort sett direkt när det går, och tar en sovande när det inte gör det (5–7 gånger per natt).

**Avsteg från specen, och varför**
- Sovande som kroppen tar med en Cryo Bay ger 1 biomassa var (var 10): med organen som enda utgift blev det 2 000 över
  och natten tog slut på 4:37 utan ett enda val.
- Organens pris är aldrig lägre än vävnadens (vävnaden blir dyrare per rum), annars blev MAGE billigare än vävnad mot slutet.
- Hjärtat: +40 ström, och maskinen vilar (ingen ström, ingen malm bränns). "Maskinen behövs inte längre."
- RISE kräver nu hjärta, lungor och hud och att alla levande är inne. Sista Cryo Bay som tas tar med alla som är kvar
  (även vakna). Huden kan bara växa när nivå 2 är full, och då är alla Cryo Bays redan tagna.
- Vävnad kan göras om till ett organ (samma pris, samma tid), så kroppen aldrig kan låsa sig utan plats för huden.
- Vat-kortet: `The meat lab, grown up. Power +N.` (specens rad plus siffran, som andra testet krävde: en sanning för ström).
- Steken smakar annorlunda bara om labbet finns och någon är vaken. Första döda i natten kan vara Mr Hale (han som ville ha stek).
- CUT POWER som första död säger `10 PODS WENT DARK.` (ny rad, behövs för ögonblicket).
- Computer-raderna: en var 25:e s som mest (12 s efter vändningen), 35 % chans per missad bubbla (70 % efter vändningen),
  aldrig någon av de fyra senaste; bygget frågas en gång per rumssort; TAKE ONE-raden första gången och sedan var tredje.
- Vägningen börjar på Sleeper 41 och räknar uppåt, bara så länge numret finns bland de sovande.

**Inte nått:** målet 6–8 min med beslut var 30:e s. I den här strukturen är nattens längd ungefär 11 gånger det längsta glappet
(sent i natten finns bara vävnad att köpa medan kroppen klättrar mot nivå 1). Jag provade långsammare år, billigare vävnad,
kortare växttid, att kroppen når vidare från halvvuxna rum, och att de som är inne föder kroppen: längre natt gav alltid
längre glapp. För att få båda behövs fler beslut sent i natten (något nytt att köpa eller välja), det är ett designbeslut.

## Byggt, fas B (skärmen, v1.86.5)

Köttlabbet ritat (rent labb: ståltankar med en röd bit i varje, stek på ståbord under lampan, en bit på krok; i natten
två av kroppens tankar under lampan), stekbubbla (T-bone). Organen i köttstilen, i ett eget lager ovanför senorna:
HJÄRTA slår (spiralmuskel, båge av stora kärl, kranskärl med pulsen, ljus på slaget), LUNGOR andas (två svampiga lober,
benvit luftstrupe), HUD spänd över hela rummet (veck, porer, senor i hörnen), MAGE en J av muskel som vrider sig med en
klämvåg. Ett rum som växer eller ändras visar organet som bildas. GROW INTO som ett val i inforutan, checklistan i panelen
från målet, viktiga rader i bärnsten med understrykning som blinkar två gånger och håller skärmen 1,6 s, bilden dämpas
medan tiden går på en fjärdedel, en klocka (ljud av/på respekteras), Computer-raderna feta med röd `>>`.
Fixar: CRT:n växer så de sex senaste raderna syns hela; staden står på grus och mörka huskroppar; senorna böjer sig och
är benvita; grannrum i kroppen delar vävnad (ingen mörk kant) och kärl löper från det ena in i det andra.
Målet sägs nu på nattens första tick om det inte sagts (checkpoints och gamla sparningar). Bilder: docs/playtests/vault-story/.
