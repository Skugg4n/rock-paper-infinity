# IV · the vault, test 4 (v1.87.0), ny spelare

Datum 2026-10-06. En headless Chrome (playwright), 1440x900, ljud av. Körning 1 från `iv-vault-start` med riktiga klick: akt I 18 min (▶ i 15 min, ▶▶ från dag ~130), natten 7,5 min, RISE → V · UNITY. Körning 2 från `iv-vault-night` (3 min), STOMACH som första organ. Bubblor besvarades av en hjälpare efter 2,5 s (som en vaken människa), allt annat för hand. Skärmdumpar i `docs/playtests/vault-test4-shots/` (45 st, ej committade). Inga JS-fel.

## 1. Dom: NÄSTAN
Mjukstarten och köttets skäl bär nu, men natten har en riktig fastkörning ("full floor") som jag bara kom ur genom att läsa koden, och vändningen dag 100 saknar en stopp-ruta.

## 2. Mjukstarten
Lär ut utan att tråka. Rutorna kommer en i taget, en mening var, och visar alltid nästa handling (gräv, bygg, klicka bubblan, bygg biograf). Kortet som glider in samtidigt som rutan är bra.
Förvirrande:
- **Rutorna beter sig olika.** Första rutan ("Click the rock") lät mig klicka berget medan den var uppe. Biograf-rutan (dag 10) blockerade grävandet tyst tills jag tryckte OK, trots att kortet sa "Dig a place first". Motor-rutan (dag 50) blockerade klick på andra rum tyst, och gruvans klick visade i stället hydroponikens infobox.
- **"Build her a cinema"**: "her" är Mrs Vance, vars bubbla sitter i en banderoll över schaktet, inte vid något rum.
- **Malm förklaras först dag ~120** ("Ore pays for everything"). I 120 dagar betalade jag med malm utan att se någon malmmätare.
- **Vändningen dag 100 har ingen ruta.** GOAL byter tyst till KEEP THEM QUIET, Cryo Bay-kortet dyker upp, humöret rasar från 85 till 30 % på ungefär 10 s ▶ och till 0 % inom en minut. Det var kryobayens infobox ("They sleep in the pods. They stop asking.") som lärde mig sova, inte en ruta.

## 3. Två röster
Bubblorna fungerar som röst: ikon i rummet, text vid hover, ringen syns, "Thank you. Finally." som svar. Men:
- **CRT:n är inte längre "bara viktigt".** Efter vändningen fylls den av "The cinema/gym/bar/garden is boring now", "Overwhelming wishes for...", "Sleeper 41. 65 kg." och "Someone tried the shaft. They fell." åtta gånger i rad. Systemrösten drunknar i loggskräp.
- Den grå loggen under CRT:n (ca 11 px) blir en tredje röst och går inte att läsa i farten.
- Namngivna önskemål sitter i banderollen över schaktet, inte där personen bor.
- Önskemål som inte går att uppfylla: "A pool. I was promised a pool." (inget poolkort finns), "I want to speak to whoever runs this place", "Who is in charge down here?". De kostar bara humör.
- Mängden: hjälparen klickade 245 bubblor på 18 minuter, alltså en var 4-5 s. För en människa blir det ett klickarbete.

## 4. Köttet steg för steg
Ja, jag förstod varför. Ordningen bar: SLEEP 50 → "pods are fed by the meat lab" → POD 41 / MR HALE IS DEAD + "meat lab is empty" med RECLAIM MR HALE redan öppen → "The meat lab grew. Warm is power." → GOAL: GET THEM TO THE SURFACE → "Start with a heart." Mr Hale-bågen håller fortfarande.
Glapp:
- "Start with a heart" kommer när biomassan är 82 och hjärtat kostar 250. Svaret (RECLAIM 4 DEAD) ligger i kryobayen och nämns inte.
- **Malmen töms tyst i natten**, från 1 029 till 0 på ca 30 s ▶▶. Ingen rad förklarar det och raden under malmen är tom.
- **Fastkörningen:** vid år ~2 300 sa varje berg "The body grows up from a full floor". Golvet kunde inte bli fullt eftersom två kryobayer stod i vägen. GROW INTO på en kryobay syns först när RECLAIM N DEAD är gjort (en knapp i taget). Jag hittade det genom att läsa koden. En ny spelare hade gett upp här.
- Körning 2 (`iv-vault-night`): rutan "The meat lab is empty" kom när inget köttlabb fanns på kartan. Labbet dök upp på våning 3 först efter rutorna. Det kan vara en checkpoint-artefakt.

## 5. Organen
Före → efter i menyn är tydligt ("Power 19 → 59. The pods stop failing.", "Biomass +0.2 → +1.2 a year"). Hjärtat räddar synligt strömmen. Men:
- Det finns ingen brist. En RECLAIM gav +500, en senare +1 400, och biomassan låg på 1 400-3 000 resten av natten.
- STOMACH ger +1 biomassa/år, medan en enda död ger ~120. Magen känns meningslös.
- LUNGS "twice as fast" märktes inte.
- Körning 2 med STOMACH först: inget dåligt hände (ström 34 räckte, biomassa 1 172). **Valet av första organ spelar ingen roll.**

## 6. Rummen
Namnskyltarna hjälper. Biograf (duk), trädgård (träd under lampa), hydroponik, sviter (sängrutnät), kryo (kapslar) och köttlabb känns igen direkt. Rött kryss = trasigt är glasklart. Gruva och motorrum är lika varandra. Skyltarna är ca 9 px, och i köttet klipps de ("HEAR", "STOM", "H ART").
Infoboxen täcker grannrum, ibland just det rum rutan pratar om (köttlabbet vid "meat lab is empty"). Panelen svämmar över på natten när checklistan kommer: ASLEEP/YEAR klipps nederst (skärmdump 035, 036).

## 7. Döda eller förvirrande stunder
| Tid (spel) | Vad |
|---|---|
| dag 10 | Biograf-rutan blockerar grävandet tyst |
| dag 50 | Motor-rutan blockerar andra rum tyst, fel infobox |
| dag 90 | Pool-önskemål utan kort ("Typical.") |
| dag 100-160 | Vändningen utan ruta, humör 85→0 på ~1 min, CRT-spam "tried the shaft" |
| dag 116, 132 | "They broke the meat lab" två gånger, och det är just labbet som matar kapslarna, utan varning |
| natt år 300-1 000 | Malmen töms till 0 utan förklaring |
| natt år ~2 300 | Fast: "full floor", GROW INTO gömd bakom RECLAIM (ca 2 min) |
| natt | Panelen klipps nederst |

## 8. Topp 3
1. **Kryobayen i natten:** visa GROW INTO bredvid RECLAIM, och skriv på berget vad som saknas ("Fill level 3. The cryo bays can be taken too."). Det är aktens enda riktiga fastkörning.
2. **Vändningen:** en ruta dag 100 ("They will never be happy again. Put them to sleep.") och ett långsammare humörfall. Håll CRT:n för systemet: flytta "boring now", "tried the shaft" och "Sleeper N kg" till loggen, eller slå ihop dem till en rad.
3. **Brist i natten, så att organvalet betyder något:** mindre biomassa per död (eller mindre per RECLAIM), magen värd att bygga, och en rad som säger vart malmen tar vägen.
