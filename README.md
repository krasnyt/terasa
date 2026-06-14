# Plánovač pokládky terasy

Jednostránková webová aplikace pro interaktivní návrh pokládky dřevěné terasy z prken. Spočítá rozložení prken, řezný plán s minimalizací odpadu, podkladní hranoly, rektifikační terče a spotřebu spojovacího materiálu — vše se přepočítává živě při změně vstupů.

Aplikace běží jako statický web bez build kroku (čisté ES moduly).

## Spuštění

Stačí servírovat adresář libovolným statickým serverem, např.:

```bash
python3 -m http.server 8765
```

a otevřít <http://localhost:8765/>.

## Hlavní funkce

- **Dva režimy návrhu:**
  - **Automat** — vygeneruje pravidelný vzor pokládky s posunem spár a minimalizací odpadu.
  - **Ručně** — prkna lze definovat textově po řadách, nebo přetahovat, posouvat, zvětšovat a odebírat přímo ve výkresu (drag&drop se snapováním).
- **Sklad prken:** zadáním seznamu skladových prken (např. `1x2310; 21x2370; Xx2454`) se řezný plán optimalizuje vůči reálným délkám a kusům. Návrhová délka celých dílů se přitom řídí nejkratším skladovým prknem, aby každý díl šel uříznout z libovolného prkna.
- **Řezný plán** algoritmem first-fit-decreasing, s respektováním minimálního odřezku a tloušťky řezu (prořezu kotouče).
- **Podkladní hranoly:** automatický výpočet pozic hranolovníků (dvojice kolem spár, krajní odsazení), rektifikačních terčů, kotvících bodů vrutů a distančních podložek.
- **Zářezy/výklenky** u okrajů terasy (pro místa u oken/dveří) jako kontrolní vrstva pro hranoly.
- **Vizualizace** v SVG s milimetrovým měřítkem, kótami, indikátory pokrytí řad, měřicím nástrojem a přepínačem zobrazení Hranoly / Prkna / Oboje.
- **Výstupy:** spotřeba prken a drobného materiálu, celkový odpad v mm i %, řezný plán a poznámky/varování.
- **Export PDF** tiskových listů A4 (vstupy, výkres, výstup, řezný plán).
- **Uložení a sdílení:** stav se průběžně ukládá do `localStorage`; konfiguraci lze exportovat/importovat jako JSON.

## Vstupy (výběr)

Rozměry terasy a prkna, mezera mezi prkny, tloušťka řezu, minimální odřezek, seznam skladových prken, opakování vzoru spár, směr pokládky, odsazení hranolovníků a rektifikačních terčů, rozteč terčů. U každého vstupu je nápověda.

## Zdrojové soubory

| soubor | role |
|---|---|
| `index.html` | struktura stránky |
| `styles.css` | styly |
| `app.js` | vstupní bod, přepínání režimů, ukládání, orchestrace renderu |
| `config.js` | výchozí hodnoty, normalizace a (de)serializace konfigurace |
| `layout.js` | výpočet rozložení, sklad prken, řezný plán, hranoly a terče |
| `render.js` | vykreslení SVG, výstupů a PDF |
| `manual.js` | ruční režim (textový vstup, drag&drop, posun spár) |
| `favicon.svg` | favikona |

## Dokumentace

Podrobný a průběžně udržovaný popis veškeré funkcionality je v [AGENTS.md](AGENTS.md).
