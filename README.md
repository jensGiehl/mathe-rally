# Mathe-Rally

Ein Kopfrechen-Spiel für die Klassen 1 bis 4: Fahre durch eine bunte Landschaft, löse Aufgaben und steuere auf die richtige der drei Antwortspuren. Eine falsche Antwort beendet die Fahrt mit einem Crash und einer gesplitterten Windschutzscheibe. Anschließend kannst du deine Punkte mit Namen und Datum in der Highscore speichern.

## Spielen

1. Wähle eine oder mehrere Rechenarten, den Zahlenraum und die Geschwindigkeit.
2. Starte die Rally und fahre auf die Spur mit der richtigen Antwort.
3. Nutze den Turbo, wenn du die Antwort schon weißt.
4. Speichere nach dem Crash deinen Namen in der Highscore und versuche es erneut.

| Steuerung | Aktion |
| --- | --- |
| Pfeil links / rechts | Eine Spur nach links / rechts wechseln |
| Pfeil nach oben | Mit einem kurzen Turbo bis zur Aufgabe vorspringen |
| P oder Escape | Spiel pausieren / fortsetzen |
| Bildschirmtasten | Spurwechsel und Turbo auf Smartphone und Tablet |
| Ton-Schalter | Spieleffekte ein- oder ausschalten |
| Hintergrundmusik | Leise Musik unabhängig von den Spieleffekten zuschalten |

Das Spiel passt sich an kleine und große Bildschirme an. Auf dem Smartphone lässt es sich mit den Daumen bedienen. Ab der 10. Aufgabe steigt das Tempo langsam an.

Im Fenstermodus steht die Aufgabe ab Tabletbreite direkt unter der Statusanzeige, damit mehr von der Strecke sichtbar bleibt.

Die dezente Hintergrundmusik lässt sich in den Einstellungen separat zuschalten und ist standardmäßig ausgeschaltet. Die Auswahl wird lokal auf dem Gerät gespeichert. Die Musik spielt nur während der Fahrt, pausiert bei einer Spielpause oder beim Wechsel in einen anderen Browser-Tab und endet mit dem Spiel. Sie wird direkt im Browser über Web Audio erzeugt; Musikdownloads und externe Dienste sind dafür nicht erforderlich. Der Ton-Schalter in der Fahransicht steuert weiterhin die Spieleffekte unabhängig davon.

## Aufgaben und Punkte

- **Kleines Einmaleins:** Faktoren von 1 bis 10.
- **Plus:** Kopfrechenaufgaben im gewählten Zahlenraum.
- **Minus:** Kopfrechenaufgaben ohne negative Ergebnisse.
- **Geteilt:** Umkehraufgaben zum kleinen Einmaleins, ohne Rest und ohne Division durch null.
- **Zahlenräume:** bis 20, bis 100 oder bis 1.000 für Plus und Minus.
- **Geschwindigkeit:** entspannt, normal oder schnell. Ein höheres Starttempo erhöht den Punkte-Boost.

Es gibt immer drei unterschiedliche Antwortmöglichkeiten mit genau einer richtigen Lösung. Aufgaben und Auswertung werden auf dem Server verwaltet; der Browser übermittelt keinen frei wählbaren Punktestand.

| Starttempo | Zeit pro Aufgabe zu Beginn | Punkte-Boost |
| --- | --- | --- |
| Entspannt | 10 Sekunden | × 1 |
| Normal | 8 Sekunden | × 1,5 |
| Schnell | 6 Sekunden | × 2 |

Eine richtige Antwort bringt 250 Streckenmeter, der abschließende Crash 200. Für jede Aufgabe werden `Streckenmeter × Punkte-Boost × Tempofaktor` auf ganze Punkte gerundet und zum Ergebnis addiert. Der Tempofaktor beträgt für die ersten neun Aufgaben 1 und steigt ab Aufgabe 10 jeweils um 0,025 bis höchstens 2; die Zeit bis zur Antwort wird durch diesen Faktor geteilt. Eine richtige Antwort auf „Normal“ bringt zu Beginn also 375 Punkte. Der Turbo überspringt die Anfahrt und hat keinen Punkteabzug.

Die Highscore zeigt die ersten drei Plätze und, falls dein Ergebnis weiter unten steht, eine Auslassung bis zu deinem Rang. Bei einem Platz in den Top 3 gibt es Konfetti. Der zuletzt verwendete Name wird ein Jahr lang in einem Cookie auf diesem Gerät gespeichert und beim nächsten Eintragen vorausgefüllt.

## Lokal starten

Voraussetzung ist ein **JDK 27**, beispielsweise Eclipse Temurin. Maven wird über den mitgelieferten Maven Wrapper geladen; eine separate Maven-Installation ist nicht nötig. Beim ersten Build ist eine Internetverbindung erforderlich.

Prüfe mit `java -version`, ob dein Terminal Java 27 verwendet. Falls mehrere JDKs installiert sind, setze `JAVA_HOME` auf dein JDK-27-Verzeichnis und ergänze dessen `bin`-Ordner am Anfang von `PATH`. Unter PowerShell beispielsweise (Pfad anpassen):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-27'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

Windows / PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

Linux / macOS:

```bash
chmod +x mvnw
./mvnw spring-boot:run
```

Öffne danach [http://localhost:8080](http://localhost:8080).

Tests und ausführbare JAR-Datei erstellen:

```powershell
.\mvnw.cmd clean verify
```

Unter Linux / macOS lautet der entsprechende Befehl `./mvnw clean verify`. Die ausführbare JAR-Datei lässt sich anschließend so starten:

```bash
java -jar target/mathe-rally-1.0.0.jar
```

## Daten und Konfiguration

Die Highscores werden lokal in `./data/mathe-rally.mv.db` gespeichert. Der Ordner wird bei Bedarf angelegt. Laufende Spiele liegen im Arbeitsspeicher und enden bei einem Neustart; bereits gespeicherte Highscores bleiben erhalten. Eine Spielsession läuft zwei Stunden nach der letzten Antwort ab.

| Umgebungsvariable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `8080` | HTTP-Port der Anwendung |
| `MATHE_RALLY_DATA_DIR` | `./data` | Verzeichnis der H2-Datenbank |
| `MATHE_RALLY_DB_PASSWORD` | leer | Passwort für die eingebettete Datenbank |

Wird ein Datenbankpasswort gesetzt, muss beim nächsten Start derselben Datenbank wieder dasselbe Passwort verwendet werden. Im Container entspricht das Standardverzeichnis `/app/data`.

Ein Name besteht aus 1 bis 24 Zeichen. Erlaubt sind Buchstaben, Ziffern, Leerzeichen und die Zeichen `.`, `_`, `'` und `-`. Pro Spiel lässt sich ein Ergebnis einmal speichern. Bei Punktegleichstand entscheiden gelöste Aufgaben, die Strecke und danach der frühere Eintrag über die Reihenfolge.

## Docker

Der mehrstufige Build kompiliert und testet mit JDK 27. Das fertige Image enthält die Java-27-Laufzeit und startet als Benutzer mit UID/GID `10001`. Auf dem Host genügt Docker; Java und Maven müssen dort nicht installiert sein.

### Image lokal bauen und verwenden

```bash
docker build --pull -t mathe-rally:local .
docker run -d --name mathe-rally --pull=never -p 8089:8080 -v mathe-rally-data:/app/data mathe-rally:local
```

Das Spiel ist dann unter [http://localhost:8089](http://localhost:8089) erreichbar. **8089 ist der Port am Host**, `8080` ist der Port der Anwendung im Container. Das Docker-Volume `mathe-rally-data` enthält die Datenbank und bewahrt die Highscores auch beim Ersetzen des Containers auf.

### Veröffentlichtes Image aktualisieren und starten

Es ist kein bereits veröffentlichtes Projekt-Image vorausgesetzt. Ersetze `ghcr.io/dein-name/mathe-rally:latest` durch deine eigene Registry-Adresse. Melde dich zunächst an deiner Registry an und veröffentliche dein Image, zum Beispiel mit `docker build -t ghcr.io/dein-name/mathe-rally:latest .` und `docker push ghcr.io/dein-name/mathe-rally:latest`.

Das folgende Bash-Skript lädt bei jedem Start die aktuelle Version aus dieser Registry:

```bash
IMAGE=ghcr.io/dein-name/mathe-rally:latest

docker rm -f mathe-rally 2>/dev/null

docker run -d \
  --name mathe-rally \
  --pull=always \
  -p 8089:8080 \
  -v mathe-rally-data:/app/data \
  "$IMAGE"
```

Auch hier ist **8089 der Host-Port**. Das Volume bleibt beim Entfernen des Containers erhalten. `--pull=always` benötigt ein tatsächlich veröffentlichtes Image; für das lokal gebaute Image verwende das vorherige Beispiel mit `--pull=never`.

### Datenbank in einen Host-Ordner einbinden

Alternativ zum benannten Volume kannst du einen Ordner des Hosts nach `/app/data` einbinden. Der Ordner muss für UID/GID `10001` schreibbar sein.

Linux:

```bash
mkdir -p data
sudo chown 10001:10001 data
docker run -d --name mathe-rally --pull=never -p 8089:8080 --mount "type=bind,source=$(pwd)/data,target=/app/data" mathe-rally:local
```

Windows / PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path .\data | Out-Null
docker run -d --name mathe-rally --pull=never -p 8089:8080 --mount "type=bind,source=$PWD/data,target=/app/data" mathe-rally:local
```

Verwende jeweils nur einen Container mit derselben eingebetteten Datenbank. Für ein Backup stoppe den Container und sichere den Inhalt des Volumes bzw. des eingebundenen Ordners. Für Eingabe- oder Ausgabeordner sind keine weiteren Mounts nötig.

## Technik

- Java 27 und Maven mit UTF-8 für Quellcode, Ressourcen und Ausgabe.
- Spring Boot 4.1.1; das Spring-Boot-Banner ist deaktiviert.
- Bootstrap 5.3.8 als WebJar, ohne CDN-Abhängigkeit.
- HTML, CSS und JavaScript mit Canvas für die Fahransicht; kein Node-Build erforderlich.
- Lokal gebündelte Schriften DM Sans und Outfit mit beiliegenden OFL-Lizenzen; keine externen Schrift-Anfragen.
- Eingebettete H2-Datenbank für dauerhaft gespeicherte Highscores.
- Basispaket `de.agiehl`.

Die offiziellen [Eclipse-Temurin-Images](https://hub.docker.com/_/eclipse-temurin) liefern die Java-27-Basis für die beiden Docker-Buildstufen.

## Prüfung

`./mvnw verify` prüft unter anderem die vier Aufgabentypen, eindeutige Antwortmöglichkeiten, Punkte und Tempoanstieg, Eingabevalidierung, wiederholbare Antworten ohne doppelte Punkte sowie Highscore-Sortierung und Datenbank-Persistenz. Zusätzlich wurden Desktop- und Smartphone-Oberfläche, Tastaturpause, Turbo, Crash, Namens-Vorausfüllung und die Anzeige des eigenen Rangs unterhalb der Top 3 im Browser geprüft.

Die Punkteberechnung erfolgt auf dem Server. Antwortzeiten werden dort nicht erzwungen; die Highscore ist für ein gemeinsames Lernspiel gedacht und bietet keinen Schutz vor automatisiertem Spielen. Der Docker-Build ist vorbereitet, wurde in dieser Entwicklungsumgebung ohne Docker jedoch nicht ausgeführt.
