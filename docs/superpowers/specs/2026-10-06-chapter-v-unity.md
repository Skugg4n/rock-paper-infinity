# V · UNITY, design (2026-10-06)

Olas riktning: kroppen bröt igenom i IV. Nu växer den över jorden. Kameran börjar inzoomad på ruinstaden och zoomar ut
steg för steg, som Google Earth baklänges. Ingen fiende. Det som behövs är resursspelet från början: bygg det här för att
låsa upp en nivå i det där, som öppnar en funktion som löser det tredje. Hela tiden växer kroppen i bild.
De namngivna från IV är kvar, inte som humor, utan som guider med varsin inriktning.

## Kort för Ola

- Fem skalor: STAD, LÄN, LAND, KONTINENT, PLANET. Varje skala har sin terräng, sin resurs, sitt hinder och sitt organ.
- En loop: äta → massa → organ → ny terräng att äta. Samma loop hela akten, men varje skala byter vad orden betyder.
- Kroppen är stapeln. Man ser den växa, och varje utzoomning är belöningen.
- Fyra röster inifrån kroppen, med namn, som säger det spelaren behöver veta just då. Systemet (the Watcher) berättar resten.
- 2D-karta uppifrån för de tre första skalorna, en 3D-glob för de två sista. Zoomen döljer bytet.
- Mål för tempot: 30 till 45 minuter. Den långa akten.

## Pitch

Vi är en kropp nu. 197 människor sover i oss. Ytan är storm, grus och gift, och ingen av dem skulle överleva en minut där uppe.
Vi överlever. Vi äter staden de kom från. Vi växer över länet, landet, kontinenten. Vi lär oss andas i gift, tåla kyla, korsa hav.
Vi blir det enda levande på jorden, och det enda som behövs. När vi täcker planeten ser vi upp.

## Loopen

```
TERRÄNG  →  äts av HUD/MAGE  →  RESURS  →  betalar ORGAN  →  öppnar ny TERRÄNG
```

- **Att äta** är automatiskt där huden ligger. Spelaren väljer **vart** kanten ska växa (klicka/dra en riktning på kartan, kanten
  växer dit) och **vad** massan läggs på (organ och nivåer i en panel).
- **Massa** är den enda valutan som alltid finns. Resurserna är terrängens: GRUS, STÅL, MINERAL, VATTEN, SALT, MALM, IS.
- **Organ** har nivåer. Varje nivå gör en sak snabbare eller möjlig. Organen från IV följer med och får nya nivåer.
- **Hindret** i varje skala stoppar kanten tills rätt organ finns. Terrängen är motståndaren, inte något som anfaller.

## Skalorna

| Skala | Vad vi ser | Terräng och resurs | Hinder | Organet som löser det | Tid, cirka |
|---|---|---|---|---|---|
| 1 STAD | ruinstaden, kvarter för kvarter | betong och grus → GRUS, STÅL ur skyskraporna | stormen sliter på kanten | SKIN II: `Skin with gravel in it. The storm cannot tear it.` | 6 min |
| 2 LÄN | staden som en fläck, fält, skog, floder | jord → MASSA snabbt, floder → VATTEN | gift i marken, kanten dör där | LUNGS II: `Lungs that filter. The poison is food now.` | 7 min |
| 3 LAND | flera städer, berg, kust | berg → MINERAL, städer → STÅL | berg, för hårt att äta | STOMACH II: `Acid for granite.` | 8 min |
| 4 KONTINENT | globen, en kontinent | hav → SALT, öknar, is | havet löser upp kanten | SKIN III: `Skin that holds salt out.` och HEART II: `A heart for a continent.` | 8 min |
| 5 PLANET | globen roterar, kroppen växer runt den | is → IS, djuphav, poler | kylan | HEART III: `Warm all the way through.` | 7 min |

Vid varje skalbyte: kameran zoomar ut (3 till 4 s), kroppen krymper till en fläck, siffrorna byter enhet, en rad från systemet.
Fläcken växer sedan igen tills den fyller bilden. Det är rytmen i akten: fylla bilden, zooma ut, fylla igen.

## Siffror i mänsklig skala

Mätarna byter enhet när skalan byter, så att talet alltid är läsbart:
- STAD: `BODY 3.2 km²` · LÄN: `BODY 410 km²` · LAND: `BODY 38 000 km²` · KONTINENT: `BODY 2.1 M km²` · PLANET: `BODY 41 % of the surface`
- Resurser alltid som heltal: `STEEL 1 240`, `WATER 86`. Inga e-tal.
- Takten står under: `+12 km² a day`.

## Organen och nivåerna

| Organ | I (från IV) | II | III |
|---|---|---|---|
| SKIN | finns | gravel: tål storm | salt: tål hav |
| LUNGS | finns | filter: gift blir mat | (ingen) |
| STOMACH | finns | granite acid: äter berg | (ingen) |
| HEART | finns | continent: kanten växer dubbelt så fort | warm: tål kyla, poler |
| NERVE (nytt, skala 2) | `A nerve. We think faster.`: allt tickar 1,5× | 2× | 3× |
| EYE (nytt, skala 3) | `An eye. We see what we have not eaten.`: kartan visar resurser utanför kanten | ser hela skalan | (ingen) |

Priser i massa plus skalans resurs (t.ex. SKIN II: 2 000 massa + 400 GRUS). Priserna sätts så att nästa organ alltid är
"nästan råd" (samma brist-regel som i IV:s natt). Ordningen inom en skala är spelarens val, hindret bestämmer vilket som krävs.

## Rösterna

**Systemet (the Watcher)** berättar, torrt, i CRT-rutan. Få rader, de viktiga är stopp (paus, bärnsten, OK) som i IV.
- Start: `WE ARE ON THE SURFACE. 197 INSIDE. ALIVE.` sedan `THE CITY IS FOOD.`
- Skalbyten: `The city is ours.` `The county is ours.` `The country is ours.` `The continent is ours.`
- Slutet: `THE SURFACE IS OURS. ALL OF IT.` paus. `WE LOOK UP.`

**Guiderna** är fyra av de som sover i kroppen. De talar i små rutor med namn, aldrig som skämt. Var och en bevakar ett område
och säger till när något i det området kräver något, och vad. En röst i taget, aldrig oftare än var 40:e sekund.

| Guide | Område | Exempel |
|---|---|---|
| Dr Okafor | kroppen: organ, vad som saknas | `Dr Okafor: The edge is dying in the poison. We need lungs that filter.` |
| Mr Lund | terräng och resurser: vad som finns där ute | `Mr Lund: Granite to the north. Steel to the east, in the old city.` |
| Ms Ito | takt och system: hastighet, nerver, när något går långsamt | `Ms Ito: We think too slowly for this. A nerve would help.` |
| Mrs Vance | världen som var: minnen av platserna vi äter | `Mrs Vance: That was the harbour. We used to sail from there.` |

Mrs Vance är inte nödvändig för spelet. Hon är där för att det ska kännas. Hennes rader kommer vid platser (en per stad, hamn, berg).

## Skärmen

- **Kartan** fyller skärmen. Skala 1 till 3: 2D uppifrån, terräng i spelets palett (svart sten, grå betong, mörk jord, blått vatten),
  kroppen i köttets röda med ådror som pulserar ut mot kanten, kanten lyser svagt där den äter. Storm som regn och mörker, mest i skala 1 och 2.
  Skala 4 och 5: en 3D-glob (three.js, som IV:s 3D-vy), kroppen som röd kontinent med ådror, globen roterar sakta.
- **Vänster panel** som i IV: CRT överst, mätarna BODY (med enhet), MASS, skalans resurser, INSIDE 197. Checklistan byts mot
  skalans hinder: `STORM · skin with gravel ☐`.
- **Organpanelen** (knapp nere i mitten, som BUILD): organen med nivåer som streck, pris, en rad vad nästa nivå ger, dimmat med "Need N more mass."
- **Riktning:** klicka på kartan, kanten växer mot punkten. En svag pil visar vald riktning. Ingen mikrostyrning.
- **Zoomen** är automatisk vid skalbyte. Scrollhjul får zooma fritt mellan 0,5× och 2× för den som vill titta.
- **Guiderna:** en liten ruta nere till höger med namn och rad, 8 s, sedan borta. Logg under CRT:n som i IV.

## Tempo och stopp

- Stopp (paus + ruta + OK) bara vid: akten börjar, första hindret, varje skalbyte, första EYE, slutet. Sju stopp totalt.
- Något att uppnå var 30:e sekund: en organnivå, ett nytt kvarter/område ätet (en rad från Mr Lund eller Mrs Vance), en resurs som når ett tröskelvärde.
- Aldrig vänta utan val: finns inget att köpa ska det alltid finnas en riktning att välja som ger något.
- Snabbspolning som i IV (▶ ▶▶), paus.

## Slutet

Kroppen täcker planeten. Globen är röd och pulserar. `THE SURFACE IS OURS. ALL OF IT.` Mrs Vance: `Mrs Vance: It is quiet.`
`WE LOOK UP.` Kameran vänder från globen mot stjärnorna. Kapitelkort `VI` (titel senare). Det här är slutet på det vi planerar nu.

## Bygga

1. Regler (rena, testade): terrängkarta per skala (seedad), kanten som äter, resurser, organ och nivåer, hinder, skalbyte, guidernas triggers.
2. Sim: en spelare som väljer riktning mot närmaste resurs och köper det hindret kräver. Mål 30 till 45 min, inget glapp över 30 s.
3. Skärm 2D (skala 1 till 3) med panel, organpanel, stopp och guider.
4. Skärm 3D (skala 4 och 5): globen. Bytet vid zoomen.
5. Ljud: IV:s puls fortsätter, djupare per skala. Guiderna: ett mjukt tecken per röst.
6. Oberoende speltest före "spelbart".

## Osäkert, att avgöra med Ola

- Stad till land i 2D och glob i 3D är mitt förslag. Alternativet är glob från start, enklare att bygga en gång, men staden blir
  liten och storm/mörker svårare att få snyggt.
- Fem skalor på 35 minuter: räcker det med fem hinder, eller behövs ett mindre hinder mitt i varje skala (en flod, en kedja av berg)?
- Mr Hale: han var den förste in i kroppen. Ska han ha en röst här (den som pratar om de som sover), eller är det starkare att han är tyst?
