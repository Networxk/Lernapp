# Lernkarten – Leitner-PWA

Karteikarten-App als Progressive Web App, optimiert fürs iPhone. Reines HTML/CSS/JavaScript, keine Frameworks, kein Build-Schritt.

## Funktionen
- Stapel anlegen, umbenennen, löschen; Karten (Vorder-/Rückseite) anlegen, bearbeiten, löschen
- Lernmodus: Karte antippen zum Umdrehen, dann „Gewusst“ / „Nicht gewusst“
- Leitner-System mit 5 Fächern – wieder fällig nach: Fach 1 sofort, 2 → 1 Tag, 3 → 3 Tage, 4 → 7 Tage, 5 → 14 Tage
  (Intervalle anpassbar in `app.js`, `BOX_INTERVAL_DAYS`)
- Speicherung lokal in IndexedDB, Backup als JSON-Export/-Import (ersetzen oder zusammenführen)
- Komplett offline dank Service Worker, Dark Mode automatisch nach Systemeinstellung

## Dateien
| Datei | Zweck |
|---|---|
| `index.html` | App-Gerüst, iOS-Meta-Tags, Dialoge |
| `styles.css` | Layout, Dark Mode, Safe-Areas fürs iPhone |
| `app.js` | Oberfläche, Lernmodus, Leitner-Logik, Export/Import |
| `db.js` | IndexedDB-Zugriff |
| `sw.js` | Service Worker (Offline-Cache) |
| `manifest.webmanifest`, `icons/` | Web-App-Manifest und App-Icons |

## Veröffentlichen mit GitHub Pages
Repository → **Settings → Pages** → *Build and deployment*: Source **Deploy from a branch**,
Branch auswählen, Ordner **/ (root)** → **Save**. Nach ca. 1 Minute ist die App unter
`https://<benutzername>.github.io/Lernapp/` erreichbar.

**Updates:** Nach Änderungen an Dateien in `sw.js` die `CACHE_VERSION` erhöhen (z. B. `lernkarten-v2`),
sonst liefert der Service Worker weiter die alte Version aus.

## Lokal testen
```bash
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen.
