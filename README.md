# SaltyNotes

Eine einfache Notizblock-App für Checklisten, Dokumentation und Brainstorming.
Läuft als installierbare Web-App (PWA) direkt im Browser – auch offline –
und ist für Android-Tablets mit Samsung OneUI (z. B. Galaxy Tab S10 Lite)
optimiert.

## Bereiche

- **Checkliste** – To-do-Listen mit abhakbaren Kästchen.
- **Dokumentation** – *Dokumentation* und *Anleitung* mit Text, Tabellen und
  Listen (kleiner Rich-Text-Editor mit Toolbar).
- **Brainstorming** – *Sammlung* (blanko, linierte Seite für freien Text) und
  *Mindmap* (verschiebbare Knoten in Rechteck-, Ellipsen- oder Rautenform,
  frei verbindbar mit Linien).

Alle Inhalte werden ausschließlich lokal im Browser gespeichert
(`localStorage`) – es gibt keinen Server, kein Konto, kein Tracking.

## Installation auf dem Galaxy Tab S10 Lite (oder jedem Android-Tablet)

1. Die Dateien dieses Ordners auf einen beliebigen Webspace/Server legen
   (oder lokal z. B. mit `npx serve .` starten) und `index.html` im Browser
   öffnen. Chrome und Samsung Internet funktionieren beide.
2. Im Browsermenü **„Zum Startbildschirm hinzufügen“** bzw.
   **„App installieren“** wählen.
3. SaltyNotes erscheint danach als eigenes App-Icon und startet im
   Vollbild-Modus (ohne Adressleiste) – inklusive Offline-Nutzung durch den
   eingebauten Service Worker.

## Projektstruktur

```
index.html              Grundgerüst + Sidebar-Navigation
styles.css              Notizblock-Design (Creme/Braun, Bevan-Schrift)
app.js                  Gesamte App-Logik (Zustand, Rendering, Speicherung)
manifest.webmanifest    PWA-Manifest (Icon, Name, Startseite)
sw.js                   Service Worker für Offline-Nutzung
fonts/                  Lokal eingebettete Schriftdatei (Bevan, OFL-Lizenz)
icons/                  App-Icons (generiert über scripts/make_icons.py)
```

## Hinweis zur Schrift

Die vom Nutzer gewünschte Schrift „Britannic Bold“ ist eine proprietäre
Monotype-Schrift ohne freie Lizenz und kann daher nicht mit ausgeliefert
werden. Als optisch naheliegender, frei lizenzierter Ersatz (Google Fonts,
OFL) kommt **Bevan** zum Einsatz – eine ähnlich kräftige Slab-Serif, die für
Überschriften, Buttons und die Navigation verwendet wird.
