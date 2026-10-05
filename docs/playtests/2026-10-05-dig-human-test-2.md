# IV · the dig, oberoende test 2 (v1.86.2)

Headless Chrome via Playwright, 1440x900, ljud av. Checkpoints iv-dig-start, iv-dig-machine, iv-dig-flesh, iv-dig-heart. Skärmdumpar i docs/playtests/dig-test2-shots/ (ej committade).

**Brasklapp:** jag hann inte 8 riktiga minuter från start. Det blev ca 3 minuter speltid (fem dyk, tre dödsfall) innan tidsrutan tvingade mig vidare, och sedan 1-2 minuter per checkpoint. Min styrning släpper tangenten ca 50 ms sent och hamnar oftast en ruta för långt. Ett tryck på 150 ms flyttade två rutor i en öppen tunnel, ett på 40 ms flyttade ingenting. En människa med tangentbord träffar nog bättre, men inte mycket bättre.

## 1. Dom: NÄSTAN
Slutet är nu ett riktigt slut och mörkret går att hitta hem i, men vägen hem dödar fortfarande, och kolonin tappar så fort att de första minuterna känns som straff i stället för upptäckt.

## 2. Bästa stunderna
- Första fyndet, +12 PARTS med texten "Finds are worth more than ore." Tydligt, och jag fattade direkt vad som lönar sig.
- Den streckade gula linjen hem när kraften börjar ta slut, och HOME-strecket på kraftmätaren. Det är precis vad jag behövde.
- Egna tunnlar syns som mörka rutor med kant, även i mörkret.
- BATTERY 1 (40 till 90, full laddning direkt) kändes som ett lyft.
- Lagren. Gatan, rosten ("The war is down here too."), kretskorten, köttet som färgar sovarna röda.
- Hjärtat: fyra slag med rösten ("It beats." / "Come home." / "Almost."), panelen försvinner, linjen skjuter upp genom schaktet, RISE, ett rött klot stiger genom alla lager, sedan V · UNITY. Det är ett slut.

## 3. Kvarn, döda och förvirrande stunder
- **0:30-1:00.** Malmen ligger en rad ovanför min tunnel och går inte att nå. "Up only through open ground." Regeln är rimlig, men jag missade på det sättet fyra gånger.
- **ca 1:40.** Första dödsfallet på väg hem. Spelet sa "Just enough power to fly home" och jag följde den streckade linjen, men tre rutor åt fel håll räckte för att dö. Kolonin rasade från 97 till 86 %.
- **ca 3:00.** Andra och tredje dödsfallet, på väg hem med 55 respektive 50 av 90 i kraft. Drönaren pendlade i en hörna mellan uppåt och åt sidan tills kraften var slut, och jag såg det inte förrän den blev bärgad. Rakt upp i ett schakt är billigt (21 rutor på ca 1 s för 12 kraft). Det är hörnen som dödar.
- **Kolonin.** 100 till 65 % på 109 sekunder speltid, med två dödsfall. Varje bärgning tar 10 %, och dräneringen växer. Efter tre minuter var jag stressad i stället för nyfiken.
- **Statusraden står kvar.** "Recovered. The cargo is gone." syntes fortfarande på 110 m under nästa dyk. "Up only through open ground..." stod kvar när jag redan var hemma. "It was not there." stod kvar genom hela köttlagret.
- **Verkstaden.** Rad för rad beskriver texten nästa nivå, inte den jag har: "Carries 34." medan lasten visar 0 / 22. Allt kostar 25 i början, så hela listan säger "Need 1 more." på en gång.
- **Ekonomin.** Malm ger 2 delar och lasten rymmer 8, så ett fullt dyk ger 16. Nästa batteri kostar 100. Kvarnen börjar efter första köpet.
- **700 m.** "Turn back" redan vid 104 av 180. Resan hem äter mer än halva batteriet, så varje dyk blir kort.
- **Hjärtat** är fortfarande avskuret längst ner i bild. RISE-knappen sitter till vänster om schaktet, inte i mitten.

## 4. Förste testarens topp 5
1. **Sväva i stället för att studsa: delvis.** Upp + sida har fått 250 ms minne, och rakt upp är snabbt. Men jag dog tre gånger i hörn på väg hem med gott om kraft kvar. Jag kan inte skilja ut hur mycket som var min styrning.
2. **Visa vägen hem: fixat.** Tunnlarna syns i mörkret, och den streckade linjen hem plus HOME-strecket är bra.
3. **Statusraden ska stämma: inte fixat.** Vissa rader försvinner, men "Recovered", "Up only..." och "It was not there." står kvar efter att de slutat gälla.
4. **Läsbar malm och mjukare 300 m-port: delvis.** Fynden säger nu att de är värda mer. Malmen är blå kristaller som fortfarande ser taggiga ut. Porten vid 300 m nådde jag inte.
5. **Ge hjärtat ett slut: nästan fixat.** Slagen, rösten, den dolda panelen och uppstigningen finns. Hjärtat är fortfarande halvt utanför bild och RISE sitter snett.

## 5. Topp 3 kvar att fixa
1. **Hörnen på väg hem.** Ett tryck uppåt mot en avsats ska inte kunna pendla bort hela batteriet. Låt drönaren hänga still tills sidan trycks, och visa kraften rinna (blinka mätaren) så att man märker det innan man dör.
2. **Mildare kolonistraff i början.** 10 % per bärgning plus en dränering som växer betyder 35 % borta på under två minuter. Låt de första dödsfallen kosta lasten, inte kolonin, eller vänta med dräneringen till första köpet.
3. **Statusraden.** Varje rad försvinner när den slutat gälla: dödsraden vid nästa dyk, "Up only..." när man rör sig. Centrera dessutom hjärtat och RISE-knappen.
