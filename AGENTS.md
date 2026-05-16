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
- Posun spár mezi řadami v milimetrech.
- Počet řad, po kterých se má opakovat vzor spár.
- Seznam délek dílů pro ruční skládání.
- U všech vstupů je ikona nápovědy s vysvětlivkou při hoveru, focusu nebo kliknutí.

## Automatický režim

- Aplikace automaticky navrhne rozložení prken podle rozměrů terasy, rozměrů prkna, mezery a nastavení vzoru.
- Řady se počítají podle šířky prkna a mezery.
- Vzor spár se snaží být pravidelný a vizuálně čitelný.
- Pokud zadaný posun spár způsobí stejné sousední řady, aplikace použije bezpečný pravidelný posun, pokud ho lze vytvořit.
- Pokud nelze vytvořit vzor bez stejných sousedních řad, aplikace zobrazí chybu a nevykreslí zavádějící řezný plán.
- Aplikace hlídá minimální délku odřezku a upozorňuje na příliš krátké díly.
- Barva prken ve výkresu se řídí pozicí řady ve vzoru, aby byl opakující se vzor lépe čitelný.

## Ruční režim

- Uživatel může zadat vlastní délky dílů jako seznam čísel.
- Zadané díly se vytvoří v zásobníku.
- Díly lze přetahovat do řad terasy.
- Ručně nepoložené díly zůstávají mimo terasu v zásobníku.
- Aplikace umí vrátit ruční díly zpět do zásobníku.
- Aplikace upozorňuje na překryvy ručně položených dílů ve stejné řadě.
- Aplikace ukazuje přibližné pokrytí plochy ručně položenými díly.

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
