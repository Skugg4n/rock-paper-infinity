# IV · the vault, mänskligt speltest 2026-10-05 (v1.86.0, ?deep=vault)

Headless Chrome 1440×900, ljud av, riktiga klick, realtid. Ingen paus i spelet mellan bilderna.
Akt I från `iv-vault-start` ca 7 min (inklusive första natten), sedan `turn` 2,5 min, `cold` 5 min (nådde RISE), `night` 1,5 min, `flesh` 1 min.
Bilder: `docs/playtests/vault-test-shots/001–106` (tid t = sekunder sedan start står i loggen nedan).

## 1. Dom

**NÄSTAN.** Stämningen och skräckglidningen bär, men mittpartiet är en klickkvarn utan riktiga val, och det mörka valet kostar ingenting, så det blir aldrig ett val.

## 2. De tre bästa ögonblicken

1. **"Level 2 is one."** (090, t≈835) Hela andra våningen blir kött, CRT:n säger det torrt, och översta raden tänds med gul ram. Jag fattade direkt vart det här tog vägen och ville dit. Bästa ögonblicket i akten.
2. **Nattens CRT-rader** (039–051, 075–088): "I counted them again. 210." → "I do not count them any more." → "It is warm down here now." → "Woke: everyone is here." Rösten blir långsamt kallare och den bär skräcken bättre än bilderna.
3. **Taket som vittrar.** Staden ovanför går från tända fönster (001) till svarta stumpar (038) när första natten börjar. Världen svarar utan ett ord.

Hedersomnämnande: Wake 10 mitt i natten (099) ger rad "What is that under the floor?" och tänder rummen igen. Bra, men det finns ingen anledning att göra det.

## 3. Bara titta eller förvirrad

| Tid | Bild | Vad | Hur länge |
|---|---|---|---|
| t≈220–240 | 029–032 | Akt I: rum går sönder ("They broke the bar") snabbare än jag hinner reparera, utan att jag förstår varför. Röda kryss över hälften av rummen. | ca 20 s |
| t≈240–290 | 033–037 | Söva folk: SLEEP 10 en gång per klick, 5 klick per kapsel, ca 20 klick för alla. SLEEP ALL dyker upp först senare och inte alltid. | 50 s ren klickkvarn |
| t≈300–330 | 038–041 | Första natten: "POD 54 FAILED" rullar, Power rött 20, fyra nya knappar (BURY, RECLAIM, CUT POWER, sen TAKE ONE). Ingen säger vad de gör, hover visar inget. Jag tryckte på måfå. | 30 s förvirring |
| t≈400–450 | 050–053 | Natten efter första vattarna: inget att göra, bara titta på "POD FAILED". | ca 50 s bara titta |
| t≈455–470 | 054–055 | `turn` börjar med svart CRT och en hel bygglist med "Dig a place first." på varje kort. Vad gör jag först? | 15 s |
| t≈485 | 057 | Klickade en klagobubbla: +1 malm, humöret rasade ändå 30 % → 14 %. Bubblorna känns meningslösa när det mörknar. | |
| t≈500–550 | 058–063 | Humör 0 % och det händer ingenting synligt. Är det game over? Nej. Då betyder siffran inget. | ca 50 s |
| t≈760–805 | 084–088 | Klickade på översta raden innan våning 2 var full: ingen knapp, ingen förklaring. Att köttet bara klättrar från en full våning lärde jag mig genom att den gula ramen råkade dyka upp. | ca 30 s |
| t≈846–874 | 091–092 | Efter sista "grow into": bara vänta på 100 % med ▶▶. | ca 30 s bara titta |
| t≈915–926 | 096–097 | Natt-checkpoint: klickar tom plats på nivå 3, panelen säger "Rock. Solid rock." utan DIG-knapp. Cryo Bay-kortet säger samtidigt "Dig a place on level 2 or 3." Omöjlig instruktion. | 10 s, irriterande |

## 4. Känsla av att uppnå något

**Ja:** gräva en plats och se rummet byggas och lysa (akt I), "Level 2 is one", RISE-knappen som pulserar rött vid 100 % Body (092).
**Nej:**
- Önskebubblorna. +1 malm per klick (uppmätt), inget tack som syns, ingen märkbar effekt på humöret. Jag slutade bry mig efter två minuter.
- Söva folk. Det är administration, inte ett beslut.
- RISE → svart skärm "V · UNITY · TO COME" direkt (093–094). Ingen uppstigning, ingen bild av den stora invånaren. Klimaxen saknas, slutet känns som en laddningsskärm.
- Humör 0 % utan följd tar udden av hela akt I-krisen.

## 5. Den mörka vändningen

Stämningen landar, mekaniken gör det inte.
- **TAKE ONE** ger ca 150 biomassa per person direkt (1 645 → 1 802, bild 048→049) och kostar inget som syns: alla sover, humöret är "-", ingen klagar, ingen siffra blir röd. Kapslarna dör ändå av strömbrist. Så valet är "gratis resurs" och jag tryckte fyra gånger utan att tveka. Det ska svida.
- **RECLAIM** är samma sak fast för redan döda. Skillnaden mot TAKE ONE syns inte på knapparna (båda röda, samma storlek).
- **BURY** och **CUT POWER**: tryckte båda, såg ingen skillnad alls (076–077). Vet fortfarande inte vad de gör.
- **GROW INTO** på en full kryokapsel med 175 sovande (086–087) är det starkaste mörka valet, men det är bara ett pris i biomassa. Ingen rad säger vad som händer med dem förrän efteråt ("75 sleepers are here now").
- Gult streckad ram betyder olika saker: "går att växa in i" (083, 090), "ström/kapsel i nöd" (039), "rum som klagar" (058). Samma signal, tre betydelser.

## 6. Topp 5 att fixa

1. **Ge TAKE ONE ett synligt pris.** T.ex. väck grannkapslarna: "3 woke. They saw." och humöret går från "-" till ett tal som faller, eller Watcher-rader som minns namnet. Så länge det inte kostar något är det ingen grandmapocalypse, bara en knapp som ger biomassa.
2. **Ersätt SLEEP 10 ×5 med en åtgärd per kapsel** (SLEEP 50 / "Fill") och visa SLEEP ALL alltid när det finns plats. 20 klick för att söva alla är den tråkigaste minuten i akten.
3. **En rad på varje nattknapp vid hover eller under knappen:** "Bury · frees the pod", "Reclaim · the dead become biomass", "Take one · a sleeper becomes biomass", "Cut power · pods fail faster, power +X". Utan det är natten gissning.
4. **Laga natt-motsägelsen:** antingen gräv på natten, eller låt Cryo Bay-kortet säga "Night: no digging" i stället för "Dig a place". Samma sak för översta raden innan våningen under är full: "The body grows up from a full floor."
5. **RISE behöver en uppstigning.** 5–10 sekunder där köttet sväller genom taket och staden ovanför innan "V · UNITY". Och låt humör 0 % i akt I få en följd (upplopp, rum stängs) eller ta bort siffran.

Bonus, småsaker: RISE-knappen ligger över Vat-kortet (092). "Here" som etikett är kryptiskt, "In the body" säger vad det är. Residents 0 / Here 175 i slutet läses som att alla är döda och ingen är kvar, vilket kanske är meningen men ser ut som en bugg.
