import { useState, useEffect, useRef, useCallback } from "react";

// ─── MOCK DATABASE (localStorage-backed for persistence) ─────────────────────
const DB_KEY = "cisco9300_portdb";

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDB(data) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch {}
}

// ─── MOCK DATA GENERATOR ─────────────────────────────────────────────────────
const VLANS = [1, 10, 20, 30, 100, 200];
const MODES = ["access", "trunk"];

function randomMac() {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join(":");
}

function generateEvents(status) {
  const events = [];
  let ts = Date.now() - 21 * 24 * 3600000;
  for (let i = 0; i < Math.floor(Math.random() * 10) + 2; i++) {
    ts += Math.random() * 8 * 3600000;
    events.push({ timestamp: ts, event: Math.random() > 0.5 ? "up" : "down" });
  }
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}

function generatePort(stackId, portNum) {
  const roll = Math.random();
  const status = roll > 0.35 ? "up" : roll > 0.15 ? "down" : "disabled";
  
  // unused = down for a long time with no recent activity
  const isUnused = status === "down" && Math.random() > 0.5;
  const unusedSince = isUnused 
    ? Date.now() - (Math.random() * 180 + 14) * 24 * 3600000 
    : null;
  
  const lastSeen = status === "up" 
    ? Date.now() - Math.random() * 3600000
    : isUnused
    ? unusedSince
    : Date.now() - Math.random() * 7 * 24 * 3600000;

  return {
    id: `Gi${stackId}/0/${portNum}`,
    stackId,
    portNum,
    status,
    isUnused,
    unusedSince,
    lastSeen,
    lastChanged: isUnused ? unusedSince : Date.now() - Math.random() * 7 * 24 * 3600000,
    vlan: VLANS[Math.floor(Math.random() * VLANS.length)],
    speed: ["10", "100", "1000"][Math.floor(Math.random() * 3)],
    poe: status === "up" && Math.random() > 0.45,
    poeWatts: status === "up" ? parseFloat((Math.random() * 30).toFixed(1)) : 0,
    mode: Math.random() > 0.25 ? "access" : "trunk",
    description: Math.random() > 0.55 ? ["Workstation", "IP Phone", "AP", "Server", "Printer", "Camera"][Math.floor(Math.random() * 6)] + `-${portNum}` : "",
    uptime: status === "up" ? Math.floor(Math.random() * 30 * 86400) : 0,
    errors: {
      rx: Math.floor(Math.random() * 80),
      tx: Math.floor(Math.random() * 30),
      crc: Math.floor(Math.random() * 8),
    },
    macTable: status === "up"
      ? Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
          mac: randomMac(),
          vlan: VLANS[Math.floor(Math.random() * VLANS.length)],
          type: "dynamic",
        }))
      : [],
    events: generateEvents(status),
    rxBytes: status === "up" ? Math.floor(Math.random() * 1e9) : 0,
    txBytes: status === "up" ? Math.floor(Math.random() * 8e8) : 0,
    rxRate: status === "up" ? Math.floor(Math.random() * 100) : 0,
    txRate: status === "up" ? Math.floor(Math.random() * 80) : 0,
  };
}

function generateSwitch(stackId) {
  return Array.from({ length: 48 }, (_, i) => generatePort(stackId, i + 1));
}

function initDB() {
  const existing = loadDB();
  if (existing) return existing;
  const db = { stacks: { 1: generateSwitch(1) }, createdAt: Date.now() };
  saveDB(db);
  return db;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function formatDuration(ms) {
  if (!ms || ms < 0) return "0m";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes > 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatTs(ts) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function unusedColor(ms) {
  const days = ms / 86400000;
  if (days > 90) return "#ff6b35";
  if (days > 30) return "#ffd740";
  if (days > 14) return "#aed581";
  return "#78909c";
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700;900&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #050c14; }
  ::-webkit-scrollbar-thumb { background: #1a3a5c; border-radius: 2px; }

  @keyframes pulse-green {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px #00e676, 0 0 12px #00e67644; }
    50% { opacity: 0.7; box-shadow: 0 0 3px #00e676; }
  }
  @keyframes pulse-amber {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes blink-red {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes chassis-glow {
    0%, 100% { box-shadow: 0 0 40px #1a73e810, 0 8px 48px #000c; }
    50% { box-shadow: 0 0 60px #1a73e820, 0 8px 48px #000c; }
  }
`;

// ─── RJ45 PORT COMPONENT ──────────────────────────────────────────────────────
function RJ45Port({ port, selected, onClick }) {
  const [activity, setActivity] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (port.status === "up") {
      intervalRef.current = setInterval(() => {
        setActivity(true);
        setTimeout(() => setActivity(false), 80 + Math.random() * 120);
      }, 600 + Math.random() * 1800);
    }
    return () => clearInterval(intervalRef.current);
  }, [port.status]);

  const isUp = port.status === "up";
  const isDown = port.status === "down";
  const isDisabled = port.status === "disabled";
  const isUnused = port.isUnused;

  // Port body colors
  const portBg = selected
    ? "linear-gradient(180deg, #1565c0 0%, #0d47a1 100%)"
    : isDisabled
    ? "linear-gradient(180deg, #1a1a1f 0%, #111115 100%)"
    : "linear-gradient(180deg, #1c2a1c 0%, #111811 100%)";

  const borderColor = selected
    ? "#42a5f5"
    : isUp
    ? "#2e7d32"
    : isDisabled
    ? "#1e1e25"
    : isUnused
    ? "#3d2b00"
    : "#1a2a1a";

  // LED colors
  const led1Color = isUp ? "#00e676" : isDown ? "#ff1744" : "#263238";
  const led2Color = isUp && activity ? "#ffd740" : isUp ? "#1b5e20" : "#1a1a1f";

  return (
    <div
      onClick={onClick}
      title={`${port.id}${port.description ? " — " + port.description : ""} | ${port.status.toUpperCase()}${isUnused ? " | UNUSED " + formatDuration(Date.now() - port.unusedSince) : ""}`}
      style={{
        width: 32,
        height: 44,
        background: portBg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 3px 3px",
        gap: 3,
        position: "relative",
        transition: "border-color 0.2s, transform 0.1s",
        transform: selected ? "scale(1.08)" : "scale(1)",
        boxShadow: selected
          ? "0 0 12px #42a5f588, 0 2px 8px #000a"
          : isUp
          ? "0 0 4px #00e67618, 0 2px 6px #000a"
          : "0 2px 4px #0008",
      }}
    >
      {/* Dual LED indicators (top) */}
      <div style={{ display: "flex", gap: 3 }}>
        {/* Link LED */}
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: led1Color,
          boxShadow: isUp ? `0 0 5px ${led1Color}` : "none",
          animation: isUp ? "pulse-green 2s ease-in-out infinite" : isDown ? "blink-red 2s ease-in-out infinite" : "none",
          transition: "background 0.3s",
        }} />
        {/* Activity LED */}
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: led2Color,
          boxShadow: activity ? "0 0 5px #ffd740" : "none",
          transition: "background 0.08s",
        }} />
      </div>

      {/* RJ45 socket body */}
      <div style={{
        width: 24,
        height: 20,
        background: isDisabled
          ? "#0a0a0d"
          : selected
          ? "#0d2a5a"
          : "#050d08",
        border: `1px solid ${isUp ? "#1b4020" : isDisabled ? "#111" : "#101810"}`,
        borderRadius: 2,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 2,
        overflow: "hidden",
      }}>
        {/* 8 pin contacts inside RJ45 */}
        <div style={{ display: "flex", gap: 1.5 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{
              width: 1.5,
              height: isUp ? 8 + (i % 2) * 3 : 6,
              background: isUp
                ? i % 2 === 0 ? "#c8a828" : "#a08820"
                : "#1a1a1a",
              borderRadius: "1px 1px 0 0",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        {/* Socket inner shadow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(180deg, #000a 0%, transparent 100%)",
        }} />
      </div>

      {/* Unused indicator strip */}
      {isUnused && (
        <div style={{
          position: "absolute", bottom: 2, left: 2, right: 2,
          height: 2, borderRadius: 1,
          background: unusedColor(Date.now() - port.unusedSince),
          boxShadow: `0 0 4px ${unusedColor(Date.now() - port.unusedSince)}`,
        }} />
      )}

      {/* PoE dot */}
      {port.poe && (
        <div style={{
          position: "absolute", top: 2, right: 2,
          width: 4, height: 4, borderRadius: "50%",
          background: "#ffd740",
          boxShadow: "0 0 4px #ffd740",
        }} />
      )}
    </div>
  );
}

// ─── SFP PORT ─────────────────────────────────────────────────────────────────
function SFPPort({ index, active }) {
  return (
    <div style={{
      width: 36,
      height: 20,
      background: active
        ? "linear-gradient(90deg, #0d2010 0%, #071408 100%)"
        : "linear-gradient(90deg, #111115 0%, #0a0a0d 100%)",
      border: `1px solid ${active ? "#2e7d32" : "#1e1e25"}`,
      borderRadius: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 4px",
      boxShadow: active ? "0 0 6px #00e67618" : "none",
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: active ? "#00e676" : "#1a2a1a",
        boxShadow: active ? "0 0 4px #00e676" : "none",
        animation: active ? "pulse-green 3s ease-in-out infinite" : "none",
      }} />
      <div style={{
        width: 18, height: 10,
        background: active ? "#051008" : "#0a0a0d",
        border: `1px solid ${active ? "#1b4020" : "#111"}`,
        borderRadius: 1,
      }} />
    </div>
  );
}

// ─── MINI TRAFFIC GRAPH ───────────────────────────────────────────────────────
function TrafficGraph({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: "#37474f", fontSize: 9 }}>{label}</span>
        <span style={{ color, fontSize: 9 }}>{value} Mbps</span>
      </div>
      <div style={{ height: 4, background: "#0d1b2a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 2, transition: "width 1s",
        }} />
      </div>
    </div>
  );
}

// ─── PORT DETAIL PANEL ────────────────────────────────────────────────────────
function PortDetail({ port, onClose }) {
  const now = Date.now();
  const unusedDuration = port.isUnused ? now - port.unusedSince : null;
  const lastSeenAgo = port.lastSeen ? now - port.lastSeen : null;

  return (
    <div style={{
      background: "linear-gradient(160deg, #08121e 0%, #060d18 100%)",
      border: "1px solid #1a3a5c",
      borderRadius: 8,
      padding: 20,
      fontFamily: "'Share Tech Mono', monospace",
      color: "#90a4ae",
      fontSize: 11,
      animation: "slide-in 0.2s ease-out",
      boxShadow: "0 12px 48px #000c, 0 0 1px #1a73e822",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#e3f2fd", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
            {port.id}
          </div>
          <div style={{ color: "#455a64", fontSize: 10, marginTop: 2 }}>
            {port.description || "No description"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={port.status} />
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #1e3a5f", color: "#546e7a",
            borderRadius: 4, cursor: "pointer", padding: "4px 10px", fontSize: 12,
            fontFamily: "monospace",
          }}>✕</button>
        </div>
      </div>

      {/* UNUSED ALERT */}
      {port.isUnused && (
        <div style={{
          background: "linear-gradient(90deg, #3d200008, #ff6b3508)",
          border: `1px solid ${unusedColor(unusedDuration)}44`,
          borderRadius: 6, padding: "10px 14px", marginBottom: 14,
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <div style={{ fontSize: 20 }}>⚠</div>
          <div>
            <div style={{ color: unusedColor(unusedDuration), fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
              PORT UNUSED
            </div>
            <div style={{ color: "#78909c", fontSize: 10, marginTop: 2 }}>
              No activity detected for{" "}
              <span style={{ color: unusedColor(unusedDuration), fontWeight: "bold" }}>
                {formatDuration(unusedDuration)}
              </span>
              {" "}— since {formatTs(port.unusedSince)}
            </div>
            <div style={{ color: "#455a64", fontSize: 10, marginTop: 1 }}>
              Consider disabling or reclaiming this port
            </div>
          </div>
        </div>
      )}

      {/* Last seen (for down ports) */}
      {port.status === "down" && !port.isUnused && lastSeenAgo && (
        <div style={{
          background: "#ff174408", border: "1px solid #ff174422",
          borderRadius: 6, padding: "8px 14px", marginBottom: 14,
          color: "#ef5350", fontSize: 10,
        }}>
          Port went DOWN {formatDuration(lastSeenAgo)} ago — {formatTs(port.lastSeen)}
        </div>
      )}

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
        {[
          ["SPEED", `${port.speed} Mbps`, "#90caf9"],
          ["VLAN", port.vlan, "#ce93d8"],
          ["MODE", port.mode.toUpperCase(), "#ffd740"],
          ["PoE", port.poe ? `${port.poeWatts}W` : "Off", port.poe ? "#ffd740" : "#37474f"],
          ["UPTIME", port.status === "up" ? formatDuration(port.uptime * 1000) : "—", "#80cbc4"],
          ["LAST CHG", formatDuration(now - port.lastChanged) + " ago", "#a5d6a7"],
        ].map(([l, v, c]) => (
          <div key={l} style={{
            background: "#060d18", border: "1px solid #0d1e30",
            borderRadius: 4, padding: "6px 8px",
          }}>
            <div style={{ color: "#263238", fontSize: 9, marginBottom: 2 }}>{l}</div>
            <div style={{ color: c, fontWeight: "bold", fontSize: 12 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Traffic */}
      {port.status === "up" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#263238", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>THROUGHPUT</div>
          <div style={{ background: "#060d18", border: "1px solid #0d1e30", borderRadius: 4, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            <TrafficGraph label="RX" value={port.rxRate} max={1000} color="#4fc3f7" />
            <TrafficGraph label="TX" value={port.txRate} max={1000} color="#81c784" />
            <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
              <div style={{ color: "#263238", fontSize: 9 }}>Total RX: <span style={{ color: "#4fc3f7" }}>{formatBytes(port.rxBytes)}</span></div>
              <div style={{ color: "#263238", fontSize: 9 }}>Total TX: <span style={{ color: "#81c784" }}>{formatBytes(port.txBytes)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: "#263238", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>ERROR COUNTERS</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["RX ERR", port.errors.rx], ["TX ERR", port.errors.tx], ["CRC", port.errors.crc]].map(([l, v]) => (
            <div key={l} style={{
              flex: 1, background: v > 0 ? "#1a040488" : "#060d18",
              border: `1px solid ${v > 0 ? "#ff174433" : "#0d1e30"}`,
              borderRadius: 4, padding: "6px 8px", textAlign: "center",
            }}>
              <div style={{ color: "#263238", fontSize: 9 }}>{l}</div>
              <div style={{ color: v > 0 ? "#ff5252" : "#37474f", fontSize: 14, fontWeight: "bold" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MAC Table */}
      {port.macTable.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#263238", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
            MAC ADDRESS TABLE ({port.macTable.length} entries)
          </div>
          <div style={{ background: "#040a10", border: "1px solid #0d1e30", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 50px 60px",
              padding: "4px 8px", background: "#060d18",
              color: "#1e3a5f", fontSize: 9, letterSpacing: 1,
              borderBottom: "1px solid #0d1e30",
            }}>
              <span>MAC</span><span>VLAN</span><span>TYPE</span>
            </div>
            {port.macTable.map((e, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 50px 60px",
                padding: "4px 8px", borderTop: i > 0 ? "1px solid #060d18" : "none",
              }}>
                <span style={{ color: "#4db6ac", fontFamily: "monospace" }}>{e.mac}</span>
                <span style={{ color: "#90caf9" }}>{e.vlan}</span>
                <span style={{ color: "#ffd740" }}>{e.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event History */}
      <div>
        <div style={{ color: "#263238", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
          PORT EVENT HISTORY
        </div>
        <div style={{
          maxHeight: 150, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {port.events.slice(0, 15).map((ev, i) => {
            const ago = Date.now() - ev.timestamp;
            return (
              <div key={i} style={{
                display: "flex", gap: 8, alignItems: "center",
                background: "#040a10", border: "1px solid #060d18",
                borderRadius: 3, padding: "3px 8px",
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: ev.event === "up" ? "#00e676" : "#ff1744",
                }} />
                <span style={{ color: "#1e3a5f", fontSize: 9, flex: 1 }}>
                  {formatTs(ev.timestamp)}
                </span>
                <span style={{ color: "#455a64", fontSize: 9 }}>
                  {formatDuration(ago)} ago
                </span>
                <span style={{
                  color: ev.event === "up" ? "#00e676" : "#ff5252",
                  fontSize: 9, fontWeight: "bold",
                }}>{ev.event.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    up: ["#00e676", "#00e67622"],
    down: ["#ff1744", "#ff174422"],
    disabled: ["#546e7a", "#546e7a22"],
  };
  const [fg, bg] = map[status] || map.disabled;
  return (
    <div style={{
      background: bg, border: `1px solid ${fg}`,
      borderRadius: 4, padding: "3px 10px",
      color: fg, fontSize: 10, fontWeight: "bold",
      fontFamily: "monospace", letterSpacing: 1,
    }}>{status.toUpperCase()}</div>
  );
}

// ─── SWITCH CHASSIS ───────────────────────────────────────────────────────────
function SwitchChassis({ stackId, ports, selectedPort, onPortClick }) {
  // Interleave: col 0 = port 1 (top) + port 2 (bottom), col 1 = port 3+4 ...
  const columns = Array.from({ length: 24 }, (_, col) => [
    ports[col * 2],
    ports[col * 2 + 1],
  ]);

  const up = ports.filter(p => p.status === "up").length;
  const unused = ports.filter(p => p.isUnused).length;

  return (
    <div style={{
      background: "linear-gradient(180deg, #232326 0%, #1a1a1d 30%, #141416 70%, #111113 100%)",
      border: "2px solid #2d2d32",
      borderRadius: 8,
      marginBottom: 6,
      boxShadow: "0 6px 32px #000d, inset 0 1px 0 #3a3a3e33, inset 0 -1px 0 #00000066",
      animation: "chassis-glow 6s ease-in-out infinite",
      overflow: "hidden",
    }}>
      {/* Top strip - branding bar */}
      <div style={{
        background: "linear-gradient(90deg, #1a1a1d 0%, #1e1e22 50%, #1a1a1d 100%)",
        borderBottom: "1px solid #2d2d32",
        padding: "6px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: "#1565c0", fontSize: 16, fontWeight: 900, letterSpacing: 3,
            textShadow: "0 0 20px #1565c044",
          }}>CISCO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={{ color: "#455a64", fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2 }}>
              CATALYST 9300-48P-E
            </div>
            <div style={{ color: "#1e3a5f", fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>
              STACK MEMBER {stackId}
            </div>
          </div>
        </div>

        {/* System LEDs */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            ["SYST", "#00e676", true, "pulse-green 2s ease-in-out infinite"],
            ["STAT", "#ffd740", true, "pulse-amber 3s ease-in-out infinite"],
            ["DUPLX", "#00e676", true, null],
            ["SPEED", "#ffd740", true, null],
            ["PoE", "#ffd740", true, null],
          ].map(([label, color, on, anim]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: on ? color : "#1a1a1f",
                boxShadow: on ? `0 0 6px ${color}, 0 0 12px ${color}44` : "none",
                animation: anim || "none",
              }} />
              <div style={{ color: "#263238", fontSize: 6, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Right stats */}
        <div style={{ display: "flex", gap: 8, fontFamily: "'Share Tech Mono', monospace" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#00e676", fontSize: 11, fontWeight: "bold" }}>{up}/{ports.length}</div>
            <div style={{ color: "#263238", fontSize: 7 }}>PORTS UP</div>
          </div>
          {unused > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#ff6b35", fontSize: 11, fontWeight: "bold" }}>{unused}</div>
              <div style={{ color: "#263238", fontSize: 7 }}>UNUSED</div>
            </div>
          )}
        </div>
      </div>

      {/* Main port area */}
      <div style={{
        padding: "10px 14px 8px",
        display: "flex", gap: 10, alignItems: "center",
      }}>
        {/* 48 ports split into 4 groups of 12 columns (= 24 ports each group) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
          {Array.from({ length: 4 }, (_, groupIdx) => {
            // Each group = 12 columns. Column col in group = overall col (groupIdx*12 + col)
            const groupCols = Array.from({ length: 12 }, (_, c) => columns[groupIdx * 12 + c]);
            const firstPortNum = groupIdx * 24 + 1;
            const lastPortNum  = groupIdx * 24 + 24;
            return (
              <div key={groupIdx} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {/* The group block */}
                <div style={{
                  background: "linear-gradient(180deg, #161618 0%, #111113 100%)",
                  border: "1px solid #222226",
                  borderRadius: 4,
                  padding: "5px 5px 4px",
                  boxShadow: "inset 0 1px 0 #2a2a2e22, inset 0 -1px 0 #00000044",
                }}>
                  {/* Top port-number labels */}
                  <div style={{ display: "flex", gap: 2, marginBottom: 3 }}>
                    {groupCols.map((pair, c) => (
                      <div key={c} style={{
                        width: 32, textAlign: "center",
                        color: "#1e2d3d", fontSize: 7,
                        fontFamily: "'Share Tech Mono', monospace",
                      }}>
                        {groupIdx * 24 + c * 2 + 1}
                      </div>
                    ))}
                  </div>

                  {/* Top row */}
                  <div style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                    {groupCols.map(([top] = [], c) => top ? (
                      <RJ45Port
                        key={top.id}
                        port={top}
                        selected={selectedPort?.id === top.id}
                        onClick={() => onPortClick(top)}
                      />
                    ) : <div key={c} style={{ width: 32 }} />)}
                  </div>

                  {/* Bottom row */}
                  <div style={{ display: "flex", gap: 2, marginBottom: 3 }}>
                    {groupCols.map(([, bottom] = [], c) => bottom ? (
                      <RJ45Port
                        key={bottom.id}
                        port={bottom}
                        selected={selectedPort?.id === bottom.id}
                        onClick={() => onPortClick(bottom)}
                      />
                    ) : <div key={c} style={{ width: 32 }} />)}
                  </div>

                  {/* Bottom port-number labels */}
                  <div style={{ display: "flex", gap: 2 }}>
                    {groupCols.map((pair, c) => (
                      <div key={c} style={{
                        width: 32, textAlign: "center",
                        color: "#1e2d3d", fontSize: 7,
                        fontFamily: "'Share Tech Mono', monospace",
                      }}>
                        {groupIdx * 24 + c * 2 + 2}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Separator groove between groups (not after last group) */}
                {groupIdx < 3 && (
                  <div style={{
                    width: 10, alignSelf: "stretch",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: 2, height: "70%",
                      background: "linear-gradient(180deg, transparent 0%, #0a0a0d 20%, #222226 50%, #0a0a0d 80%, transparent 100%)",
                      borderRadius: 1,
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SFP+ uplinks */}
        <div style={{
          borderLeft: "1px solid #1e1e25",
          paddingLeft: 10,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ color: "#1e2a3a", fontSize: 7, fontFamily: "'Share Tech Mono', monospace", marginBottom: 2, letterSpacing: 1 }}>
            SFP+
          </div>
          {[true, true, false, false].map((active, i) => (
            <SFPPort key={i} index={i + 1} active={active} />
          ))}
        </div>

        {/* Console/Mgmt panel */}
        <div style={{
          borderLeft: "1px solid #1e1e25",
          paddingLeft: 10,
          display: "flex", flexDirection: "column", gap: 5,
        }}>
          {[
            { label: "CONSOLE", color: "#37474f" },
            { label: "USB", color: "#37474f" },
            { label: "MGMT", color: "#1565c0" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: 20, height: 14,
                background: "#0a0a0d",
                border: `1px solid ${color}44`,
                borderRadius: 2,
              }} />
              <div style={{ color: "#1e2a3a", fontSize: 6, fontFamily: "'Share Tech Mono', monospace" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Power indicator */}
        <div style={{
          borderLeft: "1px solid #1e1e25",
          paddingLeft: 10,
          display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
        }}>
          <div style={{ color: "#1e2a3a", fontSize: 6, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>PWR</div>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#00e676",
            boxShadow: "0 0 8px #00e676, 0 0 16px #00e67644",
            animation: "pulse-green 3s ease-in-out infinite",
          }} />
          <div style={{ color: "#263238", fontSize: 6, fontFamily: "'Share Tech Mono', monospace" }}>ON</div>
        </div>
      </div>

      {/* Bottom label strip */}
      <div style={{
        background: "#0f0f12",
        borderTop: "1px solid #1e1e22",
        padding: "4px 14px",
        display: "flex", justifyContent: "space-between",
      }}>
        <div style={{ color: "#1e2a3a", fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>
          WS-C9300-48P | 48x GE RJ45 PoE+ | 4x 10G SFP+ | 802.3at | CISCO IOS-XE
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            ["UP", ports.filter(p => p.status === "up").length, "#00e676"],
            ["DOWN", ports.filter(p => p.status === "down").length, "#ff5252"],
            ["UNUSED", unused, "#ff6b35"],
            ["PoE", ports.filter(p => p.poe).length, "#ffd740"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />
              <span style={{ color: "#1e2a3a", fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>{l}: </span>
              <span style={{ color: c, fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────
function StatsBar({ allPorts }) {
  const now = Date.now();
  const up = allPorts.filter(p => p.status === "up").length;
  const down = allPorts.filter(p => p.status === "down").length;
  const disabled = allPorts.filter(p => p.status === "disabled").length;
  const unused = allPorts.filter(p => p.isUnused).length;
  const poe = allPorts.filter(p => p.poe).length;
  const poeW = allPorts.reduce((s, p) => s + Number(p.poeWatts), 0);
  const poePct = ((poeW / 480) * 100).toFixed(0);

  return (
    <div style={{
      background: "linear-gradient(90deg, #040a10 0%, #060d18 50%, #040a10 100%)",
      border: "1px solid #0d1e30",
      borderRadius: 8, padding: "12px 16px", marginBottom: 14,
      display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8,
    }}>
      {[
        ["ACTIVE", up, "#00e676"],
        ["DOWN", down, "#ff5252"],
        ["DISABLED", disabled, "#546e7a"],
        ["UNUSED", unused, "#ff6b35"],
        ["PoE PORTS", poe, "#ffd740"],
        ["PoE LOAD", `${poeW.toFixed(0)}W`, "#ff9100"],
        ["TOTAL", allPorts.length, "#64b5f6"],
      ].map(([label, val, color]) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div style={{ color: "#1e3a5f", fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ color, fontSize: 22, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, lineHeight: 1 }}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── UNUSED PORTS TABLE ───────────────────────────────────────────────────────
function UnusedPortsTable({ allPorts, onPortClick }) {
  const unused = allPorts
    .filter(p => p.isUnused)
    .sort((a, b) => a.unusedSince - b.unusedSince);

  if (unused.length === 0) return null;

  return (
    <div style={{
      background: "#040a10", border: "1px solid #2d1500",
      borderRadius: 8, overflow: "hidden", marginTop: 14,
    }}>
      <div style={{
        background: "linear-gradient(90deg, #1a0800 0%, #200e00 100%)",
        padding: "8px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #2d1500",
      }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#ff6b35", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
          ⚠ UNUSED PORTS REPORT
        </div>
        <div style={{ color: "#3d1500", fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
          {unused.length} ports with no recent activity
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "100px 80px 200px 120px 80px",
        padding: "4px 14px", background: "#060d18",
        color: "#1e3a5f", fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
        letterSpacing: 1, borderBottom: "1px solid #0d1e30",
      }}>
        <span>PORT</span><span>VLAN</span><span>UNUSED FOR</span><span>SINCE</span><span>ACTION</span>
      </div>
      {unused.map(port => {
        const dur = Date.now() - port.unusedSince;
        const color = unusedColor(dur);
        return (
          <div key={port.id}
            style={{
              display: "grid",
              gridTemplateColumns: "100px 80px 200px 120px 80px",
              padding: "6px 14px", borderTop: "1px solid #0a0f14",
              cursor: "pointer", transition: "background 0.1s",
              fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            }}
            onClick={() => onPortClick(port)}
            onMouseEnter={e => e.currentTarget.style.background = "#060d18"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ color: "#64b5f6" }}>{port.id}</span>
            <span style={{ color: "#90a4ae" }}>{port.vlan}</span>
            <span style={{ color, fontWeight: "bold" }}>{formatDuration(dur)}</span>
            <span style={{ color: "#455a64", fontSize: 9 }}>{new Date(port.unusedSince).toLocaleDateString()}</span>
            <span style={{ color: "#1e3a5f" }}>→ VIEW</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function CiscoSwitch9300() {
  const [stacks, setStacks] = useState(() => {
    const db = initDB();
    return db.stacks;
  });
  const [activeStacks, setActiveStacks] = useState([1]);
  const [selectedPort, setSelectedPort] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("chassis"); // chassis | unused | table

  // Persist to "DB" on every stacks change
  useEffect(() => {
    saveDB({ stacks, updatedAt: Date.now() });
  }, [stacks]);

  // Live simulation: port activity and uptime increments
  useEffect(() => {
    const interval = setInterval(() => {
      setStacks(prev => {
        const next = { ...prev };
        activeStacks.forEach(sid => {
          if (!next[sid]) return;
          next[sid] = next[sid].map(port => {
            // Random rare flap
            if (Math.random() > 0.998) {
              const newStatus = port.status === "up" ? "down" : "up";
              const now = Date.now();
              const newPort = {
                ...port,
                status: newStatus,
                lastChanged: now,
                lastSeen: now,
                uptime: newStatus === "up" ? 0 : port.uptime,
                isUnused: newStatus === "down",
                unusedSince: newStatus === "down" ? now : null,
                events: [{ timestamp: now, event: newStatus }, ...port.events].slice(0, 30),
              };
              return newPort;
            }
            // Increment uptime for up ports
            if (port.status === "up") {
              return { ...port, uptime: port.uptime + 5 };
            }
            return port;
          });
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [activeStacks]);

  // Update selected port reference
  useEffect(() => {
    if (selectedPort) {
      const allPorts = activeStacks.flatMap(sid => stacks[sid] || []);
      const updated = allPorts.find(p => p.id === selectedPort.id);
      if (updated) setSelectedPort(updated);
    }
  }, [stacks]);

  const allPorts = activeStacks.flatMap(sid => stacks[sid] || []);

  const addStack = () => {
    const ids = Object.keys(stacks).map(Number);
    const nextId = Math.max(...ids) + 1;
    if (nextId <= 5) {
      setStacks(prev => ({ ...prev, [nextId]: generateSwitch(nextId) }));
      setActiveStacks(prev => [...prev, nextId]);
    }
  };

  const handlePortClick = (port) => {
    setSelectedPort(prev => prev?.id === port.id ? null : port);
  };

  const filteredPorts = allPorts.filter(p => {
    if (filter === "unused") return p.isUnused;
    if (filter !== "all" && p.status !== filter) return false;
    if (search && !p.id.toLowerCase().includes(search.toLowerCase()) &&
        !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 20%, #060e1a 0%, #030810 50%, #020508 100%)",
      padding: "20px 16px 32px",
    }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "#1565c0", fontSize: 28, fontWeight: 900, letterSpacing: 4,
              textShadow: "0 0 30px #1565c055",
            }}>CISCO</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "#64b5f6", fontSize: 18, fontWeight: 600, letterSpacing: 3,
            }}>Catalyst 9300 Series</div>
          </div>
          <div style={{ color: "#1e3a5f", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2, marginTop: 2 }}>
            NETWORK SWITCH MANAGEMENT INTERFACE // STACK TOPOLOGY // LIVE VIEW
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {Object.keys(stacks).map(sid => (
            <button key={sid}
              onClick={() => setActiveStacks(prev =>
                prev.includes(Number(sid))
                  ? prev.length > 1 ? prev.filter(s => s !== Number(sid)) : prev
                  : [...prev, Number(sid)]
              )}
              style={{
                background: activeStacks.includes(Number(sid)) ? "#0d2a5a" : "#060d18",
                border: `1px solid ${activeStacks.includes(Number(sid)) ? "#1565c0" : "#0d1e30"}`,
                color: activeStacks.includes(Number(sid)) ? "#64b5f6" : "#1e3a5f",
                borderRadius: 4, padding: "5px 14px", cursor: "pointer",
                fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
                transition: "all 0.2s",
              }}>STACK {sid}</button>
          ))}
          {Object.keys(stacks).length < 5 && (
            <button onClick={addStack} style={{
              background: "none", border: "1px dashed #0d1e30",
              color: "#1e3a5f", borderRadius: 4, padding: "5px 14px",
              cursor: "pointer", fontSize: 10, fontFamily: "'Share Tech Mono', monospace",
            }}>+ STACK</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsBar allPorts={allPorts} />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[
          ["chassis", "CHASSIS VIEW"],
          ["unused", `UNUSED PORTS (${allPorts.filter(p => p.isUnused).length})`],
          ["table", "PORT TABLE"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? "#0d2a5a" : "transparent",
            border: `1px solid ${tab === key ? "#1565c0" : "#0d1e30"}`,
            color: tab === key ? "#64b5f6" : "#1e3a5f",
            borderRadius: 4, padding: "5px 14px", cursor: "pointer",
            fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
          }}>{label}</button>
        ))}

        {/* Filter (only in table view) */}
        {tab === "table" && (
          <>
            <div style={{ flex: 1 }} />
            {["all", "up", "down", "disabled", "unused"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? "#0d1e3a" : "transparent",
                border: `1px solid ${filter === f ? "#1a73e8" : "#0d1e30"}`,
                color: filter === f ? "#64b5f6" : "#1e3a5f",
                borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
              }}>{f.toUpperCase()}</button>
            ))}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                background: "#060d18", border: "1px solid #0d1e30",
                color: "#90caf9", borderRadius: 4, padding: "4px 10px",
                fontSize: 10, fontFamily: "'Share Tech Mono', monospace",
                outline: "none", width: 160,
              }}
            />
          </>
        )}
      </div>

      {/* Main content */}
      {tab === "chassis" && (
        <>
          {activeStacks.map(sid => (
            <SwitchChassis
              key={sid}
              stackId={sid}
              ports={stacks[sid] || []}
              selectedPort={selectedPort}
              onPortClick={handlePortClick}
            />
          ))}
          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
            {[
              ["UP / Active", "#00e676"],
              ["DOWN", "#ff1744"],
              ["DISABLED", "#263238"],
              ["UNUSED (14–30d)", "#aed581"],
              ["UNUSED (30–90d)", "#ffd740"],
              ["UNUSED (90d+)", "#ff6b35"],
              ["PoE Powered", "#ffd740"],
            ].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                <span style={{ color: "#1e3a5f", fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>{l}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "unused" && (
        <UnusedPortsTable allPorts={allPorts} onPortClick={handlePortClick} />
      )}

      {tab === "table" && (
        <div style={{
          background: "#040a10", border: "1px solid #0d1e30",
          borderRadius: 8, overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "110px 70px 60px 60px 60px 80px 100px 1fr",
            padding: "6px 14px", background: "#060d18",
            color: "#1e3a5f", fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 1, borderBottom: "1px solid #0d1e30",
          }}>
            <span>PORT</span><span>STATUS</span><span>VLAN</span><span>SPEED</span>
            <span>MODE</span><span>PoE</span><span>UPTIME/UNUSED</span><span>DESCRIPTION</span>
          </div>
          {filteredPorts.map(port => {
            const isUnused = port.isUnused;
            const unusedDur = isUnused ? Date.now() - port.unusedSince : null;
            return (
              <div key={port.id}
                onClick={() => handlePortClick(port)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 70px 60px 60px 60px 80px 100px 1fr",
                  padding: "5px 14px", borderTop: "1px solid #06090f",
                  cursor: "pointer", fontSize: 10,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: selectedPort?.id === port.id ? "#060d18" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (selectedPort?.id !== port.id) e.currentTarget.style.background = "#040a10"; }}
                onMouseLeave={e => { if (selectedPort?.id !== port.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color: "#4fc3f7" }}>{port.id}</span>
                <span style={{ color: port.status === "up" ? "#00e676" : port.status === "down" ? "#ff5252" : "#37474f" }}>
                  {port.status.toUpperCase()}
                </span>
                <span style={{ color: "#90a4ae" }}>{port.vlan}</span>
                <span style={{ color: "#78909c" }}>{port.speed}M</span>
                <span style={{ color: "#ffd74088" }}>{port.mode}</span>
                <span style={{ color: port.poe ? "#ffd740" : "#1e3a5f" }}>{port.poe ? `${port.poeWatts}W` : "—"}</span>
                <span style={{ color: isUnused ? unusedColor(unusedDur) : "#546e7a" }}>
                  {isUnused
                    ? `⚠ ${formatDuration(unusedDur)}`
                    : port.status === "up"
                    ? formatDuration(port.uptime * 1000)
                    : "—"}
                </span>
                <span style={{ color: "#263238" }}>{port.description || "—"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected port detail */}
      {selectedPort && (
        <div style={{ marginTop: 16, animation: "slide-in 0.2s ease-out" }}>
          <PortDetail port={selectedPort} onClose={() => setSelectedPort(null)} />
        </div>
      )}

      <div style={{
        marginTop: 24, borderTop: "1px solid #060d18",
        paddingTop: 10, color: "#0d1e30", fontSize: 8,
        fontFamily: "'Share Tech Mono', monospace", textAlign: "center", letterSpacing: 2,
      }}>
        CISCO CATALYST 9300 SWITCH SIMULATOR // PORT HISTORY STORED IN LOCALSTORAGE DB // SNMP · RESTCONF · SSH READY
      </div>
    </div>
  );
}
