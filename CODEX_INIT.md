# Codex init

## Projekt

- Staticka jednostrankova webova aplikace bez build kroku.
- Hlavni soubory: `index.html`, `styles.css`, `app.js`, `config.js`, `layout.js`, `render.js`, `manual.js`, `favicon.svg`.
- JavaScript bezi jako ES moduly primo v prohlizeci.

## Spusteni serveru

Pouzij obycejny staticky HTTP server z korene projektu:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Pokud je port `8000` obsazeny, vezmi dalsi volny port, napr. `8001`.

URL:

```text
http://127.0.0.1:8000/
```

## Poznamky pro agenta

- Pri pozadavku "spust server" neni potreba znovu zjistovat typ projektu.
- Neexistuje `package.json`, build krok ani dependency install.
- Detailni popis funkcionality je v `AGENTS.md`.
