# Funkcionality aplikace

Tento soubor je průběžný popis funkcí aplikace. Při každém přidání, změně nebo odebrání funkcionality se má aktualizovat spolu se zdrojovým kódem.

## Základ aplikace

- Jednostránková webová aplikace bez build kroku.
- Zdrojové soubory jsou `index.html`, `styles.css`, `app.js`, `config.js`, `layout.js`, `render.js`, `manual.js` a `favicon.svg`.
- JavaScript běží jako ES moduly bez build kroku. `app.js` je vstupní bod pro inicializaci, přepínání režimů, ukládání a hlavní render orchestraci.
- Aplikace slouží k interaktivnímu návrhu pokládky terasy z prken.
- Všechny vstupy se přepočítávají živě při změně hodnot.
- Prohlížeč používá SVG faviconu s motivem terasových prken.

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
- Odsazení rektifikačních terčů od krajů každého úseku podkladního hranolu v milimetrech (výchozí 300 mm).
- Preferovaná rozteč rektifikačních terčů pod jedním hranolem v milimetrech (výchozí 500 mm).
- U všech vstupů je ikona nápovědy s vysvětlivkou při hoveru, focusu nebo kliknutí.
- Volitelné obdélníkové zářezy/výklenky u okrajů terasy pro místa u oken nebo dveří. Každý zářez má název, stranu (horní/dolní), vzdálenost od levého kraje, šířku a hloubku v milimetrech. Hloubka se zadává směrem ven od základního obdélníku terasy.
- Panel „Zářezy" je sbalitelný. Ve sbaleném stavu ukazuje počet zadaných zářezů a tlačítko pro přidání, aby panel „Výstup" zůstával v levém sloupci rychle dostupný.

## Návrh pokládky

Aplikace nabízí tři režimy přepínatelné segmentovaným tlačítkem „Automat" / „Ideální" / „Ručně" v panelu „Vzor pokládky". Panel „Vzor pokládky" je sbalitelný stejně jako panel „Zářezy".

- V režimech Automat a Ideální je dostupné tlačítko „Přenést aktuální návrh do ručního režimu". Tlačítko zkopíruje právě spočítané díly do ručního režimu, nahradí dosavadní ručně umístěná prkna a přepne aplikaci do režimu Ručně. Pokud aktuální automatický návrh nejde sestavit, tlačítko je vypnuté.

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
- Vybraný režim, ručně umístěná prkna a zadané zářezy se ukládají do localStorage spolu s ostatními nastaveními.

## Podkladní hranoly

- Aplikace počítá pozice podkladních hranolovníků: hranol musí být pod každou sparou (místem, kde se setkají dva díly v jedné řadě) a navíc ve vzdálenosti dané vstupem „Odsazení krajních hranolovníků" od každého kraje terasy.
- Pozice hranolovníků jsou unikátní x-souřadnice přes všechny řady vzoru.
- Pokud je zadaný zářez, hranolovník v jeho X rozsahu se prodlouží ven od základního obdélníku terasy podle hloubky zářezu. Kóty mezi hranolovníky zůstávají podle X souřadnic, ale celková délka hranolů vychází ze skutečných úseků včetně prodloužení do zářezu.
- Ve výkresu jsou hranolovníky zobrazeny jako svislé přerušované čáry v hnědo-oranžové barvě. Jsou vykresleny pod prkny, takže jsou viditelné pouze v mezerách mezi řadami — prkna je překrývají.
- **Kotvící body vrutů:** v každém průniku prkna s hranolem jsou na prkně dvě malé černé tečky (jeden vrut u horního, druhý u dolního okraje prkna). Tečky odpovídají dvěma vrutům, kterými je prkno přichycené k hranolu. Když hranol leží přesně ve spáře dvou prken (resp. v mezeře mezi nimi, do vzdálenosti `Mezera` od kraje prkna), patří k oběma sousedním prknům — body se posunou o `edgeInset` (≈ 18 mm) dovnitř od kraje příslušného prkna, takže ve spáře jsou viditelné celkem **4 body** (2 vlevo od osy hranolu pro levé prkno, 2 vpravo pro pravé prkno). Stejnou tolerancí `±Mezera` se řídí i počítání vrutů ve výstupu, aby vizualizace a číslo souhlasily.
- **Rektifikační terče:** pod každým úsekem podkladního hranolu se vykreslí modré značky terčů. První a poslední terč úseku jsou od jeho krajů odsazené podle vstupu „Odsazení rektifikačních terčů"; mezi nimi se terče rovnoměrně rozloží tak, aby nepřekročily vstup „Rozteč rektifikačních terčů". Pokud je úsek kratší než dvojnásobek odsazení, vykreslí se jeden terč uprostřed úseku.
- Nad terasou jsou tick marky a kóty vzdáleností mezi všemi sousedními hranolovníky, včetně kót od okraje terasy k prvnímu a poslednímu hranolu.

## Vizualizace

- Hlavní výkres je vykreslený jako SVG.
- Terasa je zobrazena v měřítku podle zadaných rozměrů.
- Zářezy jsou ve výkresu vykreslené jako průsvitné šrafované obdélníky zvenku připojené k horní nebo dolní hraně terasy s popiskem rozměru. V první verzi slouží jako kontrolní vrstva pro hranoly; automatické ani ruční rozložení prken se podle nich zatím neřeže.
- **Velikost plátna se přizpůsobuje terase:** drawing-frame nemá pevnou minimální výšku, SVG si přes `style.aspectRatio = viewWidth / viewHeight` určí výšku podle poměru viewBoxu, takže nad ani pod terasou nevzniká zbytečný prázdný prostor a sekce řezného plánu + poznámky jsou hned pod kresbou.
- Vertikální padding uvnitř SVG (prostor pro horní/dolní kóty) se počítá samostatně pro horní okraj (`max(180, pad*0.4)`) a dolní okraj (`max(240, pad*0.45, boardWidth+90)`), aby byl prostor pro kóty co nejtěsnější, ale stále dostatečný pro štítky a pro pás celého posledního prkna.
- Prkna jsou zobrazena jako samostatné díly v jednotlivých řadách.
- Mezery mezi řadami jsou vizuálně odlišené.
- Napojení prken ve stejné řadě je zvýrazněné dvojitou značkou, aby byly řezy dobře vidět.
- Dvojitá značka spáry se vykresluje v automatickém, ideálním i ručním režimu.
- Výkres obsahuje kóty délky a šířky terasy.
- Výkres obsahuje detailní kóty šířky prkna a mezery.
- Kóty jsou umístěné mimo samotnou plochu pokládky, aby nepřekrývaly prkna.
- Pokud je poslední řada užší než celé prkno, výkres ukáže průsvitný pás s informací, o kolik by se terasa musela rozšířit, aby poslední prkno nebylo nutné podélně řezat.
- Při hoveru na díl prkna se prkno vizuálně zvýrazní (zesvětlení a bílý obrys), aby bylo zřejmé, na které prkno ukazatel míří.
- Při hoveru nebo kliknutí na díl prkna se zobrazí tooltip.
- Tooltip prkna má pevnou strukturu a šířku, aby údaje při přejíždění mezi prkny neodskakovaly.
- Tooltip prkna zobrazuje rozměr dílu, pozici levého horního rohu `[x;y]` vůči levému hornímu rohu terasy a číslo řady.
- Tlačítko „Metr" v hlavičce výkresu zapne měřicí režim. První klik do SVG nastaví počáteční bod, pohyb myši ukazuje náhled a druhý klik zobrazí přímou vzdálenost dvou libovolných bodů v milimetrech. Další klik v aktivním režimu začne nové měření; klávesa Escape režim vypne.

## Výstupy

Panel „Výstup" je sbalitelný a rozdělen vodorovnou čárou na dvě sekce. Nad čárou je obecná spotřeba materiálu, pod čárou navazující drobný materiál (hranoly a spojovací prvky).

V hlavičce výkresu je tlačítko „Export PDF". Po kliknutí aplikace sestaví tiskový list A4 na šířku s aktuálním režimem, vstupními hodnotami, výkresem, výstupem, řezným plánem a poznámkami. Řezný plán se v PDF při sestavení rozdělí do 1–4 samostatných sloupců podle počtu skladových prken; pruhy řezů se v PDF generují jako inline SVG, aby se zobrazily i při tisku bez CSS pozadí. Celý obsah se před otevřením tiskového dialogu zmenší tak, aby se vešel na jednu stránku; PDF se uloží přes systémovou volbu tisku „Uložit jako PDF".

**Nad čárou:**
- Počet skladových prken potřebných k nákupu.
- Počet položených řad.
- Počet řezaných dílů.
- Celkový odpad v milimetrech a procentech.
- Pokrytá šířka terasy.

**Pod čárou:**
- Počet podkladních hranolovníků a jejich celková délka v metrech. U zadaných zářezů je délka počítaná jako součet skutečných úseků včetně prodloužení do zářezů, ne jako počet × celá šířka terasy.
- Počet rektifikačních terčů pod podkladními hranoly.
- Počet distančních podložek. Spočítá se po řadách jako `počet prken v řadě + 1` (každá spára mezi dvěma prkny + jedna podložka na každém kraji řady). Prázdné řady se nezapočítávají.
- Počet vrutů. Pro každé prkno se sečte počet podkladních hranolů, které pod ním procházejí (včetně hranolů na obou koncích prkna na spáře), a vynásobí se dvěma (dva vruty na každý záchyt). Výsledek se navýší o 10 % rezervu a zaokrouhlí nahoru na celé desítky. Ve výpisu je vidět základní počet i procento rezervy.
- Řezný plán pro jednotlivá skladová prkna.
- V řezném plánu má každé skladové prkno stejnou vizuální délku.
- Řezný plán ukazuje jednotlivé řezy a odpad pro každé skladové prkno.
- Řezný plán se nestrouhá do vlastního scroll okénka — vykreslí všechna prkna pod sebou. Pokud jich je hodně, scrolluje se celá stránka.
- Poznámky a varování upozorňují na konflikty nebo doporučení v návrhu.
- Poznámky uvádějí aktuální šířku poslední řady a doporučenou šířku terasy bez podélného řezu posledního prkna.

## Technické chování

- Aplikace běží jako statický web.
- Lokálně ji lze spustit například přes `python3 -m http.server 8765`.
- Prohlížečová cache je obcházená verzemi u `styles.css` a `app.js`.
- Výchozí hodnoty všech vstupů jsou definované v objektu `DEFAULTS` v `config.js`. Při startu se načtou z `localStorage` (klíč `terasa-navrh`), při nedostupnosti se použijí `DEFAULTS`. Při každé změně vstupu se hodnoty po 5 sekundách automaticky uloží zpět.
- Git repozitář používá české texty commitů.
