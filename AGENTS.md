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

- Uživatel přetáhne prkna (délky = délka skladového prkna) z palety nad výkresem na požadovanou pozici a řadu.
- **Snap:** Při přetahování se prkno automaticky přichytí k nejbližší hraně sousedního prkna (s mezerou) nebo k okraji terasy, pokud je kurzor blíže než ~22 px v SVG souřadnicích.
- Přetažením lze i přesouvat již umístěná prkna.
- Kliknutí (pohyb < 8 px) na umístěné prkno ho odebere.
- **Přesah:** Prkno, které přesahuje mimo rozměry terasy, je zvýrazněno červeným okrajem a přesahující část je překryta červeným poloprůsvitným pruhem s popiskem (např. `+230 mm`). Varování na přesahy jsou také v sekci Poznámky.
- Ručně umístěná prkna se ukládají do localStorage.
- Vstup „Opakování vzoru" ani „Max. rozteč" v tomto režimu nejsou zobrazeny; ostatní vstupní parametry fungují normálně.

### Společné

- Řady se počítají podle šířky prkna a mezery.
- Barva prken ve výkresu se řídí pozicí řady, aby byly řady vizuálně odlišitelné.
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

- Počet skladových prken potřebných k nákupu.
- Počet položených řad.
- Počet řezaných dílů.
- Počet podkladních hranolovníků a jejich celková délka v metrech (počet × šířka terasy).
- Celkový odpad v milimetrech a procentech.
- Pokrytá šířka terasy.
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
