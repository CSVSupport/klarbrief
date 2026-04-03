# KlarBrief — Behördenbriefe einfach erklärt

KI-gestützte Analyse und Übersetzung amtlicher Schreiben in einfaches Deutsch.

## Deployment auf Vercel

### Schritt 1: Repository erstellen

```bash
cd klarbrief-project
git init
git add .
git commit -m "Initial commit: KlarBrief v1.0"
```

Auf GitHub ein neues Repository erstellen (z.B. `klarbrief`) und pushen:

```bash
git remote add origin https://github.com/DEIN-USERNAME/klarbrief.git
git branch -M main
git push -u origin main
```

### Schritt 2: Vercel verbinden

1. Gehe zu [vercel.com](https://vercel.com) und logge dich ein
2. Klicke **"Add New Project"**
3. Importiere das GitHub-Repository `klarbrief`
4. Framework Preset: **Vite** (wird automatisch erkannt)
5. Klicke **Deploy**

### Schritt 3: Custom Domain (optional)

1. In Vercel → Project Settings → Domains
2. Domain `klarbrief.de` hinzufügen
3. DNS-Einträge bei deinem Provider setzen:
   - **A-Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`

### Lokale Entwicklung

```bash
npm install
npm run dev
```

Öffne http://localhost:5173

### Build

```bash
npm run build
```

Output in `/dist` — bereit für Deployment.

## Technologie

- **Frontend**: React 18 + Vite
- **KI**: Anthropic Claude API (Sonnet 4)
- **Styling**: Inline CSS (Zero-Bundle)
- **Icons**: Lucide React
- **Hosting**: Vercel
- **SEO**: Structured Data, Open Graph, Sitemap

## Betreiber

ETONI UG (haftungsbeschränkt)  
Kiefernweg 1, 53474 Bad Neuenahr-Ahrweiler  
info@csv-support.de
