# IV · the dig, mänskligt test 3 (v1.92.0, pass 3)

2026-10-09. Headless Chrome 1440x900, ljud av, riktiga tangenttryck. Från `iv-dig-start` ca 17 min verklig tid (= 5,7 min speltid, spelet pausat medan jag läste). Sedan `iv-dig-alarm`, `iv-dig-lab`, `iv-dig-flesh`, `iv-dig-heart` 2 till 3 min vardera, RISE nådd. Skärmdumpar i `docs/playtests/dig-test3-shots/` (ej committade). Tre av dyken från start styrdes av spelets egen autopilot (beslut skickade som riktiga tangenttryck), resten för hand. Inga sidfel.

## 1. Dom: NÄSTAN

Starten är äntligen lugn och begriplig, en sak i taget, men STEERING I gör att jag inte kommer hem: 4 dödsfall och 2 PARTS efter 5,7 minuter, och reparationen åt upp pengarna till styrningen.

## 2. En sak i taget

Funkar. Ordningen jag fick: CRT-texten, `216 SLEEPERS`, stopp "The generators burn ore. Dig.", POWER-stopp, DEPTH + linjal, CARGO vid första malmen, PARTS + "The workshop is open." vid leverans, verkstaden med EN rad (BATTERY), sedan STEERING efter första dödsfallet, HOMING LINE, LAMP, GENERATORS-mätaren, kammarlarmet. Pilar på rummen (WAREHOUSE, WORKSHOP, kammaren) visar vart. Jag visste var jag var och vad nästa steg var de första 2 minuterna.

För mycket på en gång: nej. Problemet är det omvända, vissa saker kommer utan förklaring:
- **GENERATORS** dyker upp vid ca 1:25 och sjunker (100 → 56 % på 4 min). Ingen ruta säger vad som händer vid 0 eller att leveranser fyller på.
- POWER-stoppet kommer mitt i första grävtaget och avbryter det.

## 3. Basen

Förstod den direkt: en rad rum under staden, schaktet i mitten, kamrarna ovanför. WAREHOUSE (lasten töms, PARTS räknas upp), WORKSHOP (panelen öppnas när man står där), LAB (vitrin + "LAB 58 s"). Rummen utan skylt (två mörka rum) undrade jag vad de var. Kamrarnas fönster släcks när folk dör, snyggt.

## 4. Felen och de sovande

- Första larmet (3:00) var verklig press: `CHAMBER 5 · 117 s`, jag hade 0 PARTS, dök, kom hem med 7 s kvar och lagade. Det kändes bra, en riktig "en ruta till eller hem nu".
- Men: priset steg tyst från "Repair needs 17 PARTS" till 20 under dyket (följer djuprekordet). Lagningen tog 20 av mina 22, inga pengar kvar till STEERING (15). Valet "rädda sovande eller fixa styrningen" är bra, men jag såg inte att priset ändrades.
- Stoppet säger "Return to base and repair it." när jag redan står i basen.
- Ingen kvittens när lagningen är klar (rutan försvinner bara).
- Lät jag en kammare dö (utan radio, nere i schaktet): SLEEPERS 216 → 206 helt tyst. Hemma stod bara "New in the workshop: SHORT WAVE RADIO." Ingen rad om att tio dog. Spec D säger att man ska få veta när man kommer upp.

## 5. Kvantobjekten och labbet

Labbet är bra: lämna, 60 s stapel, stopp "The lab opened it. It was a BOOSTER. Double speed for 5 s, half the power. Key B." Kort och klart. SHOCK WAVE (Q) känns stort, äter en rejäl kvadrat. PING (G) med konen är tydlig. BOOSTER syns knappt på skärmen (bara en stapel som töms).
Frustration: jag såg det lila objektet 3 rutor bort i nästan en minut och kom inte åt det. Det låg i en vägg ovanför min tunnel och tvåstegsstyrningen sköt mig förbi varje gång. Objektet saknar etikett/flimmer i stillbild, jag visste inte att det var ett "QUANTUM OBJECT" förrän i checkpointen.

## 6. Styrning och känsla

Det här är huvudproblemet.
- **STEERING I (två steg per tryck)** gör schaktet ouppnåeligt från fel paritet: står jag på x12 kan jag bara landa på x10, x14... aldrig x11. Jag fastnade i ping-pong flera gånger, och fick "Up only through open ground. The way up is to the left/right" om och om igen (CRT:n fylls av den raden).
- Jag tryckte UPP och åkte åt sidan (andra steget av förra trycket kördes först).
- Räddningen jag hittade av en slump: håll UPP + sida samtidigt, då svänger drönaren ett steg in i schaktet. Det står ingenstans.
- Uppåt-tryck på 150 ms gör ingenting men kostar ström (troligen lyfter den en ruta och faller tillbaka).
- Även spelets egen autopilot dog 3 gånger av 4 dyk med STEERING I, och en gång med STEERING II.
- Från STEERING II (checkpoints) är styrningen okej. Köttet, lampovalen, hjärtat och drönarens köttdelar ser fina ut.
- Input-fördröjning i automationen: 100 till 300 ms per drag, påverkar precisionen men förklarar inte paritetsfällan.

## 7. Döda eller förvirrande stunder (speltid)

- 0:05 till 0:16: första dyket, STEERING I skickar mig åt fel håll, 26 av 40 POWER borta på 6 s.
- 0:33 till 1:15: det lila objektet går inte att nå, jag dör (1:15) med 7 malm. "Recovered. The cargo is gone." är enda reaktionen, inget stopp.
- 1:55 till 3:00: hemma med 0 PARTS, pilen pekar på WORKSHOP fast jag inte kan köpa något.
- 4:40 till 4:44: sju sekunders ping-pong vid schaktet med 19 s kvar på larmet.
- Statusrader står kvar efter att de slutat gälla ("It was not there.", "Turn back...", "Cargo full. Go home." hemma med tom last).
- HOME-etiketten under POWER-stapeln krockar med CARGO/DEPTH-rubriken.
- Efter RISE: svart kort "V UNITY TO COME". Ingen fortsättning från gräv-versionen.

## 8. Topp 5

1. **STEERING I: behåll grovheten men gör den inte till en fälla.** Andra steget får aldrig gå in i ett öppet schakt man står mitt i, och ett UPP-tryck ska avbryta väntande sidosteg. Eller ge STEERING II gratis efter första dödsfallet.
2. **Döda sovande ska sägas.** När man kommer hem: "Chamber 3 went dark. 10 sleepers are gone." Samma för generatorn vid 0.
3. **GENERATORS behöver ett stopp** när mätaren dyker upp: vad den är, att malm fyller på, vad som händer vid 0.
4. **Reparationspriset ska stå fast** när larmet börjar (eller visa det nya priset i larmrutan), plus kvittens "Chamber 5 is mended."
5. **Kvantobjektet ska gå att känna igen och nå:** flimmer som syns även stilla, ordet QUANTUM OBJECT första gången lampan träffar det, och placera det inte i en vägg ovanför en tunnel där man inte kan gräva upp.

Det jag skulle behålla: CRT-ankomsten, en rad i taget i verkstaden, pilarna i basen, kammarlarmet med sekunder, labbstoppet, SHOCK WAVE, köttet och hjärtat.
