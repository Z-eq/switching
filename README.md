# 🖥️ Cisco Catalyst 9300 Switch Simulator

A realistic, interactive simulation of a Cisco Catalyst 9300 48-port network switch — built with React + Vite.

**[Live Demo →](https://your-project.vercel.app)**

---

## ✨ Features

- Realistic 48-port RJ45 front panel with 4×12 port groups
- Dual LED per port (link + activity) with live blinking simulation
- PoE indicator, port status (up / down / disabled)
- **Unused port detection** — flags ports inactive for 14+ days with color-coded duration
- Click any port for full details: uptime, errors, MAC table, event history
- Up to 5 stacked switches (Gi1/0/1 → Gi5/0/48)
- Port state persisted in localStorage across sessions
- Unused Ports Report tab + filterable Port Table

---

## 🚀 Deploy to Vercel (step by step)

### 1. Clone or download this project

```bash
git clone https://github.com/YOUR_USERNAME/cisco9300-sim.git
cd cisco9300-sim
```

### 2. Push to GitHub (if not already)

```bash
git init
git add .
git commit -m "Initial commit — Cisco 9300 switch simulator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cisco9300-sim.git
git push -u origin main
```

### 3. Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub
2. Click **"Add New Project"**
3. Import your **cisco9300-sim** repository
4. Vercel auto-detects Vite — no config needed
5. Click **Deploy** ✅

That's it. Vercel will give you a live URL in ~30 seconds.

---

## 💻 Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for production

```bash
npm run build
npm run preview
```

---

## 📁 Project structure

```
cisco9300-sim/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          ← Full switch simulator component
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Global reset styles
├── index.html
├── vite.config.js
├── package.json
└── .gitignore
```

---

## 🔌 Backend (optional)

A full Node.js + Express + MongoDB backend is included separately (`server_v2.js`) for:
- Persisting port state to MongoDB
- REST API for port management
- SNMP / RESTCONF / SSH integration stubs

The frontend works standalone with localStorage — no backend required for Vercel deployment.

---

## 📡 Future: Connect to a real Cisco switch

| Method | Package | Command |
|--------|---------|---------|
| SNMP | `net-snmp` | Poll `1.3.6.1.2.1.2.2.1.8` (ifOperStatus) |
| RESTCONF | `axios` | `GET /restconf/data/ietf-interfaces:interfaces` |
| SSH | `ssh2` | `show interfaces status` |
