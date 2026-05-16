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
- Počet řad, po kterých se má opakovat vzor spár.
- U všech vstupů je ikona nápovědy s vysvětlivkou při hoveru, focusu nebo kliknutí.

## Návrh pokládky

- Aplikace automaticky navrhne rozložení prken podle rozměrů terasy, rozměrů prkna, mezery a nastavení vzoru.
- Posun spár mezi řadami se vždy dopočítá jako délka prkna dělená opakováním vzoru, aby byl vzor pravidelný a všechny řady měly stejnou množinu délek dílů (kvůli minimalizaci odpadu při skládání skladových prken).
- Cílem návrhu je vždy minimalizovat odpad — díly se skládají do skladových prken algoritmem first-fit-decreasing.
- Aplikace tvrdě respektuje minimální odřezek. Pokud by ve vzoru měl vzniknout díl kratší než minimální odřezek a nelze ho dorovnat zkrácením předchozího plného dílu, zobrazí se chyba a žádný výkres ani řezný plán se nevykreslí.
- Pokud nelze vytvořit smysluplný vzor (např. opakování vzoru je 1 při více řadách, nebo by posun spár vyšel pod minimální odřezek), aplikace zobrazí chybu a nic nevykreslí.
- Řady se počítají podle šířky prkna a mezery.
- Barva prken ve výkresu se řídí pozicí řady ve vzoru, aby byl opakující se vzor lépe čitelný.

## Podkladní hranoly

- Aplikace počítá pozice podkladních hranolovníků: hranol musí být pod každou sparou (místem, kde se setkají dva díly v jedné řadě) a navíc přibližně 200 mm od každého kraje terasy.
- Pozice hranolovníků jsou unikátní x-souřadnice přes všechny řady vzoru.
- Ve výkresu jsou hranolovníky zobrazeny jako svislé přerušované čáry v hnědo-oranžové barvě přes celou šířku terasy.
- Nad terasou jsou kóty vzdáleností mezi sousedními hranolovníky.
- V souhrnu je uveden celkový počet hranolovníků.

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
- Při hoveru nebo kliknutí na díl prkna se zobrazí tooltip.
- Tooltip prkna má pevnou strukturu a šířku, aby údaje při přejíždění mezi prkny neodskakovaly.
- Tooltip prkna zobrazuje rozměr dílu, pozici levého horního rohu `[x;y]` vůči levému hornímu rohu terasy a číslo řady.

## Výstupy

- Počet skladových prken potřebných k nákupu.
- Počet položených řad.
- Počet řezaných dílů.
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
- Git repozitář používá české texty commitů.
