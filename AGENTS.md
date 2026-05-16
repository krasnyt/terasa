# Funkcionality aplikace

Tento soubor je průběžný popis funkcí aplikace. Při každém přidání, změně nebo odebrání funkcionality se má aktualizovat spolu se zdrojovým kódem.

## Základ aplikace

- Jednostránková webová aplikace bez build kroku.
- Zdrojové soubory jsou `index.html`, `styles.css` a `app.js`.
- Aplikace slouží k interaktivnímu návrhu pokládky terasy z prken.
- Všechny vstupy se přepočítávají živě při změně hodnot.

## Vstupy

- Délka terasy v milimetrech.
- Šířka terasy v milimetrech.
- Délka skladového prkna v milimetrech.
- Šířka prkna v milimetrech.
- Mezera mezi prkny v milimetrech.
- Minimální použitelný odřezek v milimetrech.
- Počet řad, po kterých se má opakovat vzor spár (pouze v režimu Automat).
- Maximální rozteč sousedních hranolů v milimetrech (pouze v režimu Ideální, výchozí 1000 mm).
- Odsazení krajních hranolovníků od okraje terasy v milimetrech.
- U všech vstupů je ikona nápovědy s vysvětlivkou při hoveru, focusu nebo kliknutí.

## Návrh pokládky

Aplikace nabízí tři režimy přepínatelné segmentovaným tlačítkem „Automat" / „Ideální" / „Ručně" v panelu „Vzor pokládky".

### Automat

- Posun spár mezi řadami se dopočítá jako délka prkna dělená opakováním vzoru, aby byl vzor pravidelný a všechny řady měly stejnou množinu délek dílů.
- Cílem návrhu je vždy minimalizovat odpad — díly se skládají do skladových prken algoritmem first-fit-decreasing.
- Aplikace tvrdě respektuje minimální odřezek. Pokud by ve vzoru měl vzniknout díl kratší než minimální odřezek a nelze ho dorovnat zkrácením předchozího plného dílu, zobrazí se chyba a nic se nevykreslí.
- Pokud nelze vytvořit smysluplný vzor (opakování vzoru je 1 při více řadách, nebo by posun spár vyšel pod minimální odřezek), aplikace zobrazí chybu.
- Vstup „Opakování vzoru" je dostupný pouze v tomto režimu.

### Ideální

- Aplikace spočítá rozložení řezů tak, aby hranoly mohly být od sebe nejvýše „Max. rozteč hranolů" (výchozí 1000 mm).
- Spáry prken jsou vždy přímo pod hranoly — rozteč hranolů = délka dílu.
- **Žádné dvě sousední řady nemají spáry na stejných pozicích.** Liché řady jsou posunuty o `max(minOffcut, floor(maxSpan/2))` mm. Pokud posun nelze splnit (příliš malá rozteč), aplikace na to upozorní a použije jednotný vzor.
- Díly jsou řezány greedy algoritmem: každý díl je co nejdelší (min(délka prkna, max. rozteč)), přičemž se hlídá, aby poslední díl nebyl kratší než minimální odřezek. Pokud to nelze zajistit, zobrazí se chyba.
- Vstup „Max. rozteč hranolů" je dostupný pouze v tomto režimu.

### Ručně

- **Textový vstup řad:** Nad výkresem je textarea „Řady", kde každá řádka odpovídá jedné řadě terasy (řada 1 = první řádka). Délky prken se v rámci řady oddělují středníky (`;`), kolem středníků se ignoruje libovolný počet mezer. Příklad:
  ```
  2300; 2300; 400
  1000; 2300; 1700
  ```
  Při změně textu se prkna přepočítají a vykreslí v dané řadě těsně zleva, oddělená mezerou `Mezera`. Řádky bez čísel zůstanou prázdné, řádky nad rámec dostupných řad terasy se ignorují.
- **Drag&drop:** Vedle textarey lze stále přetahovat prkna z palety nad výkresem na konkrétní pozici a řadu. Délku kusu určuje vstup „Délka" v paletě — výchozí hodnota je délka skladového prkna, lze zadat libovolný kratší řez. Popisek chipu se aktualizuje živě. Po každém přetažení, změně velikosti nebo odebrání se obsah textarey přegeneruje z aktuálního stavu prken (sečteno po řadách, prkna seřazená podle pozice X; pozice X v rámci řady se v textu nereprezentuje, takže text je „lossy" reprezentací volně rozmístěných prken).
- **Snap:** Při přetahování se prkno automaticky přichytí k nejbližší hraně sousedního prkna (s mezerou) nebo k okraji terasy, pokud je kurzor blíže než ~22 px v SVG souřadnicích.
- Přetažením lze i přesouvat již umístěná prkna. Prkno se drží v místě úchopu — poloha levého kraje se přepočítává jako `kurzor − offset_úchopu`, takže prkno se pohybuje relativně bez skoku.
- **Změna velikosti:** Uchopením levého nebo pravého kraje prkna (do ~22 px od okraje v datových souřadnicích, včetně oblasti v mezeře mimo rect) lze prkno zmenšit nebo zvětšit. Minimum = min. odřezek, maximum = délka skladového prkna. Kurzor se při přiblížení ke kraji změní na `ew-resize`. Během tažení se zobrazuje tooltip s aktuální délkou.
- Kliknutí (pohyb < 8 px) na umístěné prkno ho odebere.
- **Přesah:** Prkno, které přesahuje mimo rozměry terasy, je zvýrazněno červeným okrajem a přesahující část je překryta červeným poloprůsvitným pruhem s popiskem (např. `+230 mm`). Varování na přesahy jsou také v sekci Poznámky.
- Ručně umístěná prkna se ukládají do localStorage.
- Vstup „Opakování vzoru" ani „Max. rozteč" v tomto režimu nejsou zobrazeny; ostatní vstupní parametry fungují normálně.

### Společné

- Řady se počítají podle šířky prkna a mezery.
- Barva prken ve výkresu se řídí pozicí řady, aby byly řady vizuálně odlišitelné.
- **Indikátor pokrytí řady:** Vpravo od každé řady je v SVG vykreslený štítek pokrytí:
  - `✓ celá` (zelená) — prkna + povinné mezery mezi nimi přesně pokrývají celou délku terasy (tolerance ±0,5 mm a žádná díra větší než `Mezera`).
  - `−X mm` (červená) — v řadě chybí X mm prkna (krátká řada nebo díra uvnitř).
  - `+X mm` (oranžová) — v řadě přebývá X mm (prkna přesahují za pravý kraj terasy).
  - `prázdná` (šedá) — v řadě není žádné prkno.
  
  V režimech Automat a Ideální je vždy `✓ celá`, protože pokrytí je dáno konstrukcí. V ručním režimu se přepočítává živě podle textareu a drag&drop akcí.
- Vybraný režim a ručně umístěná prkna se ukládají do localStorage spolu s ostatními nastaveními.

## Podkladní hranoly

- Aplikace počítá pozice podkladních hranolovníků: hranol musí být pod každou sparou (místem, kde se setkají dva díly v jedné řadě) a navíc ve vzdálenosti dané vstupem „Odsazení krajních hranolovníků" od každého kraje terasy.
- Pozice hranolovníků jsou unikátní x-souřadnice přes všechny řady vzoru.
- Ve výkresu jsou hranolovníky zobrazeny jako svislé přerušované čáry v hnědo-oranžové barvě. Jsou vykresleny pod prkny, takže jsou viditelné pouze v mezerách mezi řadami — prkna je překrývají.
- Nad terasou jsou tick marky a kóty vzdáleností mezi všemi sousedními hranolovníky, včetně kót od okraje terasy k prvnímu a poslednímu hranolu.

## Vizualizace

- Hlavní výkres je vykreslený jako SVG.
- Terasa je zobrazena v měřítku podle zadaných rozměrů.
- Prkna jsou zobrazena jako samostatné díly v jednotlivých řadách.
- Mezery mezi řadami jsou vizuálně odlišené.
- Napojení prken ve stejné řadě je zvýrazněné dvojitou značkou, aby byly řezy dobře vidět.
- Výkres obsahuje kóty délky a šířky terasy.
- Výkres obsahuje detailní kóty šířky prkna a mezery.
- Kóty jsou umístěné mimo samotnou plochu pokládky, aby nepřekrývaly prkna.
- Pokud je poslední řada užší než celé prkno, výkres ukáže průsvitný pás s informací, o kolik by se terasa musela rozšířit, aby poslední prkno nebylo nutné podélně řezat.
- Při hoveru na díl prkna se prkno vizuálně zvýrazní (zesvětlení a bílý obrys), aby bylo zřejmé, na které prkno ukazatel míří.
- Při hoveru nebo kliknutí na díl prkna se zobrazí tooltip.
- Tooltip prkna má pevnou strukturu a šířku, aby údaje při přejíždění mezi prkny neodskakovaly.
- Tooltip prkna zobrazuje rozměr dílu, pozici levého horního rohu `[x;y]` vůči levému hornímu rohu terasy a číslo řady.

## Výstupy

Panel „Výstup" je rozdělen vodorovnou čárou na dvě sekce. Nad čárou je obecná spotřeba materiálu, pod čárou navazující drobný materiál (hranoly a spojovací prvky).

**Nad čárou:**
- Počet skladových prken potřebných k nákupu.
- Počet položených řad.
- Počet řezaných dílů.
- Celkový odpad v milimetrech a procentech.
- Pokrytá šířka terasy.

**Pod čárou:**
- Počet podkladních hranolovníků a jejich celková délka v metrech (počet × šířka terasy).
- Počet distančních podložek. Spočítá se po řadách jako `počet prken v řadě + 1` (každá spára mezi dvěma prkny + jedna podložka na každém kraji řady). Prázdné řady se nezapočítávají.
- Řezný plán pro jednotlivá skladová prkna.
- V řezném plánu má každé skladové prkno stejnou vizuální délku.
- Řezný plán ukazuje jednotlivé řezy a odpad pro každé skladové prkno.
- Poznámky a varování upozorňují na konflikty nebo doporučení v návrhu.
- Poznámky uvádějí aktuální šířku poslední řady a doporučenou šířku terasy bez podélného řezu posledního prkna.

## Technické chování

- Aplikace běží jako statický web.
- Lokálně ji lze spustit například přes `python3 -m http.server 8765`.
- Prohlížečová cache je obcházená verzemi u `styles.css` a `app.js`.
- Výchozí hodnoty všech vstupů jsou definované v objektu `DEFAULTS` v `app.js`. Při startu se načtou z `localStorage` (klíč `terasa-navrh`), při nedostupnosti se použijí `DEFAULTS`. Při každé změně vstupu se hodnoty po 5 sekundách automaticky uloží zpět.
- Git repozitář používá české texty commitů.
