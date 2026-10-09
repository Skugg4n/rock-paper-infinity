# Vault, speltest 3 (v1.86.5), 2026-10-05

Oberoende testare, headless Chrome 1440x900, ljud av. Start från `iv-vault-start`, hela akten spelad med riktiga klick, inga hopp till cold/night. Bubblor klickades av ett skript med ~1-2 s reaktionstid. Akt I ca 14 min realtid (dag 0-151), natten ca 6,5 min, RISE till V · UNITY vid 21 min. Skärmdumpar: `docs/playtests/vault-test3-shots/` (001-048). Inga JS-fel.

## 1) Dom: VÄRT ATT SPELA

Varför flesh-vändningen sker begriper man nu, och historien bär. Svagheten är att natten saknar motstånd: när hjärtat väl slår finns ingen brist, och mörka val som TAKE ONE och CUT POWER behöver aldrig användas.

## 2) Frågorna

**A. Förstod jag VARFÖR kolonin blir kött, och när?** Ja. Det klickade vid nattens början (ca 14:00): "THE SURFACE WILL NOT RECOVER / THEY CANNOT LIVE UP THERE / SOMETHING STRONGER COULD / GOAL: GET THEM TO THE SURFACE." Raderna "They would be safer inside something stronger" och "Lungs. The air up there is poison. Not to us." förklarar sedan varje organ. Man blir kött för att ta sig upp. Det är inte längre "biomassa allt för att".

**B. Visste jag vad jag skulle göra i natten? Kändes organvalet som ett val?** Mestadels ja. Checklistan HEART/LUNGS/SKIN/STOMACH/INSIDE n/m är det bästa i versionen. Den gula streckade rutan visar var köttet kan växa härnäst. Organmenyn är tydlig, med pris, en rad om vad varje organ gör och "Needs a heart first". Första valet var ett riktigt val: kapslarna dog, strömmen låg på 35 och var röd, och jag tog HEART. Då slutade kapslarna dö (19:00), och den kopplingen kändes. Efter det var valet tomt: biomassan växte från 420 till 8 400 och jag valde STOMACH överallt utan att tänka. Två ställen där jag inte visste vad jag skulle göra: (1) natt 1 innan jag hittade RECLAIM i kryopanelen, eftersom inget pekar dit (ca 30 s); (2) "Skin, only on the top level" fast översta våningen bara har rum. Att våningen under måste vara full syns bara om man klickar på en sten ("The body grows up from a full floor").

**C. Förberedde uppbyggnaden vändningen?** Ja, bra. Steken (dag 50, "Nobody asks from what."), dag 100 "SURFACE REPORT: NOT RECOVERING", "The steak tastes different tonight.", vägningen "Sleeper 41. 81 kg." och sedan "POD 41 FAILED. MR HALE IS DEAD." Den sista raden gav en rysning, för man har sett hans nummer förut. Köttlabbet är det första som blir kött, och det känns logiskt. Det enda som kommer från ingenstans är humörraset: 100 % till 37 % på en dag (dag 100) och 0 % på dag 115. Allt går sönder och inget jag bygger hjälper. Det fungerar som berättelse, men spelmässigt är dag 100-150 ca 4 min av maktlös väntan.

**D. Är det roligt?** Ja, svart och torrt. Bäst: "They sell games to each other: 3 ore a day.", "Computer, how long does a mine take?", "COMPUTER.", "Who programmed this thing?", "Someone tried the shaft. They fell.", "I counted them. 218." / "I do not count them any more.", "Woke: everyone is here." Tjatet på Computer är en vinst.

## 3) Bästa stunderna
- Mr Hales båge: steken, vägningen, "POD 41 FAILED. MR HALE IS DEAD." (dag 50 till natt 1)
- Målet på CRT:n i bärnsten och checklistan som bockas av i rött
- Grafiken: köttet äter rummen våning för våning, schaktet blir en ådra, RISE skjuter röda trådar upp mot ytan
- Hjärtat stoppar kapseldöden direkt: ett synligt orsak/verkan-ögonblick

## 4) Döda eller förvirrande stunder (tid från start)
- 10:00-14:00: humör 0 %, rum går sönder ett efter ett, uppgraderingar hjälper inte. Väntan tills alla sover.
- 14:20: natt 1, kapslar dör, oklart vad man ska göra. RECLAIM ligger gömd i kryobayens panel.
- 14:30-16:00: "POD xx FAILED" spammar CRT:n och knuffar ut berättarraderna. Samma kapsel dör två gånger: POD 54 och POD 35 visas två gånger var.
- 16:00-20:30: ingen brist. Biomassan växer snabbare än jag hinner spendera (2 000, 5 800, 8 400). TAKE ONE, CUT POWER, WAKE 10 och BURY användes aldrig.
- Kryobayens panel på natten har 8 knappar (fem organ plus WAKE/TAKE ONE/CUT POWER) i en lång lista.
- När checklistan är klar fryser tiden: fyra rum står kvar som "growing in", och hydroponik och allrum förblir mänskliga (body 75 %). Det gör inget, men det ser ofärdigt ut.
- Sidopanelen: RESIDENTS går 196, 150, 0 medan IN THE BODY står längst ner i grått. "Residents 0" läses först som att alla dött.
- Byggkorten kapar texten vid 1440 px bredd ("Grows real me...", "The meat lab, grown up...").
- V · UNITY "TO COME": själva RISE-ögonblicket är kort (ca 4 s), sedan svart.

## 5) Topp 3 att fixa
1. **Ge natten en brist efter hjärtat.** Låt organen kosta eller äta biomassa per år, eller låt INSIDE kräva ett mörkt val (TAKE ONE, CUT POWER). Just nu är natten ett enda långt klick på STOMACH.
2. **Peka på RECLAIM första gången kapslarna dör**, till exempel med en gul ram på kryobayen och en rad på CRT:n som "The dead could be useful." Samla dessutom "POD xx FAILED" till en räknare så att berättarraderna får stå kvar. Rätta dubbla kapselnummer.
3. **Gör dag 100-150 till något att göra.** Låt spelaren söva folk tidigare (kryo direkt vid vändningen med en tydlig knapp), eller låt rummen man reparerar hålla humöret uppe en stund. Fyra minuter av "They broke the X" medan man väntar är för långt.
