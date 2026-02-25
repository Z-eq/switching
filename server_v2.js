// ============================================================
// server_v2.js — Cisco 9300 Backend with Unused Port Tracking
// ============================================================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/cisco9300", {
  useNewUrlParser: true, useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"));

// ── Schema ────────────────────────────────────────────────────────────────────

const EventSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  event: { type: String, enum: ["up", "down", "disabled", "error"] },
  details: String,
});

const PortSchema = new mongoose.Schema({
  id: { type: String, required: true },        // Gi1/0/1
  stackId: { type: Number, default: 1 },
  portNum: Number,
  status: { type: String, enum: ["up", "down", "disabled"], default: "down" },

  // ── Unused port tracking ──────────────────────────────────────────────────
  isUnused: { type: Boolean, default: false },
  unusedSince: { type: Date, default: null },  // when port became inactive
  lastSeen: { type: Date, default: null },     // last time port was UP/active
  unusedThresholdDays: { type: Number, default: 14 }, // days before marked "unused"
  // ─────────────────────────────────────────────────────────────────────────

  vlan: { type: Number, default: 1 },
  speed: { type: String, default: "1000" },
  poe: { type: Boolean, default: false },
  poeWatts: { type: Number, default: 0 },
  mode: { type: String, enum: ["access", "trunk"], default: "access" },
  description: { type: String, default: "" },
  uptime: { type: Number, default: 0 },
  errors: {
    rx: { type: Number, default: 0 },
    tx: { type: Number, default: 0 },
    crc: { type: Number, default: 0 },
  },
  macTable: [{
    mac: String, vlan: Number, type: { type: String, default: "dynamic" },
  }],
  rxBytes: { type: Number, default: 0 },
  txBytes: { type: Number, default: 0 },
  rxRate: { type: Number, default: 0 },
  txRate: { type: Number, default: 0 },
  events: [EventSchema],
  lastChanged: { type: Date, default: Date.now },
});

// Virtual: unused duration in milliseconds
PortSchema.virtual("unusedDurationMs").get(function () {
  if (!this.isUnused || !this.unusedSince) return null;
  return Date.now() - this.unusedSince.getTime();
});

// Virtual: unused duration human-readable
PortSchema.virtual("unusedDurationHuman").get(function () {
  const ms = this.unusedDurationMs;
  if (!ms) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
});

// Method: update port status and handle unused tracking
PortSchema.methods.updateStatus = function (newStatus, details = "") {
  const oldStatus = this.status;
  this.status = newStatus;
  this.lastChanged = new Date();

  this.events.unshift({
    timestamp: new Date(),
    event: newStatus,
    details,
  });

  if (newStatus === "up") {
    // Port came back up — clear unused flags
    this.isUnused = false;
    this.unusedSince = null;
    this.lastSeen = new Date();
    this.uptime = 0;
  } else {
    // Port went down — check if it should be flagged as unused
    const daysSinceLastSeen = this.lastSeen
      ? (Date.now() - this.lastSeen.getTime()) / 86400000
      : 999;

    if (daysSinceLastSeen >= (this.unusedThresholdDays || 14)) {
      this.isUnused = true;
      this.unusedSince = this.unusedSince || this.lastSeen || new Date();
    }
    this.uptime = 0;
  }
};

const SwitchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  model: { type: String, default: "C9300-48P-E" },
  hostname: String,
  ipAddress: String,
  location: String,
  totalStacks: { type: Number, default: 1, min: 1, max: 5 },
  ports: [PortSchema],
  sysUptime: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Auto-scan for unused ports across all ports on save
SwitchSchema.pre("save", function (next) {
  const thresholdMs = 14 * 24 * 3600000;
  this.ports.forEach(port => {
    if (port.status !== "up" && port.lastSeen) {
      const sinceSeen = Date.now() - port.lastSeen.getTime();
      if (sinceSeen >= thresholdMs && !port.isUnused) {
        port.isUnused = true;
        port.unusedSince = port.unusedSince || port.lastSeen;
      }
    }
  });
  this.updatedAt = new Date();
  next();
});

const Switch = mongoose.model("Switch", SwitchSchema);

// ── Mock data ─────────────────────────────────────────────────────────────────
const VLANS = [1, 10, 20, 30, 100, 200];
function randomMac() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random()*256).toString(16).padStart(2,"0")).join(":");
}

function makePorts(stackId) {
  return Array.from({ length: 48 }, (_, i) => {
    const portNum = i + 1;
    const roll = Math.random();
    const status = roll > 0.35 ? "up" : roll > 0.15 ? "down" : "disabled";
    const isUnused = status === "down" && Math.random() > 0.45;
    const unusedDaysAgo = isUnused ? (Math.random() * 180 + 14) : 0;
    const lastSeenDaysAgo = isUnused ? unusedDaysAgo : (status === "up" ? 0 : Math.random() * 7);

    return {
      id: `Gi${stackId}/0/${portNum}`,
      stackId, portNum, status,
      isUnused,
      unusedSince: isUnused ? new Date(Date.now() - unusedDaysAgo * 86400000) : null,
      lastSeen: status === "up" ? new Date() : new Date(Date.now() - lastSeenDaysAgo * 86400000),
      lastChanged: new Date(Date.now() - Math.random() * 30 * 86400000),
      vlan: VLANS[Math.floor(Math.random() * VLANS.length)],
      speed: ["10","100","1000"][Math.floor(Math.random()*3)],
      poe: status === "up" && Math.random() > 0.45,
      poeWatts: status === "up" ? parseFloat((Math.random()*30).toFixed(1)) : 0,
      mode: Math.random() > 0.3 ? "access" : "trunk",
      description: Math.random() > 0.5
        ? ["Workstation","IP Phone","AP","Server","Printer","Camera"][Math.floor(Math.random()*6)] + `-${portNum}`
        : "",
      uptime: status === "up" ? Math.floor(Math.random() * 30 * 86400) : 0,
      errors: { rx: Math.floor(Math.random()*80), tx: Math.floor(Math.random()*30), crc: Math.floor(Math.random()*8) },
      macTable: status === "up"
        ? Array.from({ length: Math.floor(Math.random()*3)+1 }, () => ({ mac: randomMac(), vlan: VLANS[Math.floor(Math.random()*VLANS.length)], type: "dynamic" }))
        : [],
      rxBytes: status === "up" ? Math.floor(Math.random()*1e9) : 0,
      txBytes: status === "up" ? Math.floor(Math.random()*8e8) : 0,
      rxRate: status === "up" ? Math.floor(Math.random()*100) : 0,
      txRate: status === "up" ? Math.floor(Math.random()*80) : 0,
      events: [{ event: status, timestamp: new Date(Date.now() - Math.random()*7*86400000), details: "Initial state" }],
    };
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET all switches
app.get("/api/switches", async (req, res) => {
  const switches = await Switch.find({}, "-ports");
  res.json(switches);
});

// POST create switch
app.post("/api/switches", async (req, res) => {
  try {
    const { name, hostname, ipAddress, location, totalStacks = 1 } = req.body;
    const ports = [];
    for (let s = 1; s <= totalStacks; s++) ports.push(...makePorts(s));
    const sw = new Switch({ name, hostname, ipAddress, location, totalStacks, ports });
    await sw.save();
    res.status(201).json(sw);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET switch with all ports
app.get("/api/switches/:id", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  res.json(sw);
});

// GET all ports (filterable)
app.get("/api/switches/:id/ports", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  let ports = sw.ports;
  const { status, vlan, stack, unused } = req.query;
  if (status) ports = ports.filter(p => p.status === status);
  if (vlan) ports = ports.filter(p => p.vlan === parseInt(vlan));
  if (stack) ports = ports.filter(p => p.stackId === parseInt(stack));
  if (unused === "true") ports = ports.filter(p => p.isUnused);
  res.json(ports.map(p => ({
    ...p.toObject({ virtuals: true }),
    unusedDurationMs: p.unusedDurationMs,
    unusedDurationHuman: p.unusedDurationHuman,
  })));
});

// GET single port
app.get("/api/switches/:id/ports/:portId", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  const port = sw.ports.find(p => p.id === req.params.portId);
  if (!port) return res.status(404).json({ error: "Port not found" });
  res.json({
    ...port.toObject({ virtuals: true }),
    unusedDurationMs: port.unusedDurationMs,
    unusedDurationHuman: port.unusedDurationHuman,
  });
});

// PATCH update port status
app.patch("/api/switches/:id/ports/:portId", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  const port = sw.ports.find(p => p.id === req.params.portId);
  if (!port) return res.status(404).json({ error: "Port not found" });

  const { status, vlan, mode, description, poe, speed } = req.body;

  if (status && status !== port.status) {
    port.updateStatus(status, req.body.details || "Manual change via API");
  }
  if (vlan !== undefined) port.vlan = vlan;
  if (mode !== undefined) port.mode = mode;
  if (description !== undefined) port.description = description;
  if (poe !== undefined) port.poe = poe;
  if (speed !== undefined) port.speed = speed;

  await sw.save();
  res.json({
    ...port.toObject({ virtuals: true }),
    unusedDurationMs: port.unusedDurationMs,
    unusedDurationHuman: port.unusedDurationHuman,
  });
});

// ── GET unused ports report ───────────────────────────────────────────────────
app.get("/api/switches/:id/unused", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });

  const minDays = parseInt(req.query.minDays) || 0;
  const unused = sw.ports
    .filter(p => p.isUnused)
    .filter(p => {
      if (!minDays || !p.unusedSince) return true;
      return (Date.now() - p.unusedSince.getTime()) >= minDays * 86400000;
    })
    .sort((a, b) => a.unusedSince - b.unusedSince)
    .map(p => ({
      id: p.id,
      stackId: p.stackId,
      portNum: p.portNum,
      vlan: p.vlan,
      description: p.description,
      unusedSince: p.unusedSince,
      lastSeen: p.lastSeen,
      unusedDurationMs: p.unusedDurationMs,
      unusedDurationHuman: p.unusedDurationHuman,
      unusedDays: p.unusedDurationMs ? Math.floor(p.unusedDurationMs / 86400000) : null,
    }));

  res.json({
    switchId: sw._id,
    switchName: sw.name,
    totalPorts: sw.ports.length,
    unusedCount: unused.length,
    unusedPercent: ((unused.length / sw.ports.length) * 100).toFixed(1),
    unusedPorts: unused,
  });
});

// POST mark port as reviewed (clears unused flag)
app.post("/api/switches/:id/ports/:portId/reviewed", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  const port = sw.ports.find(p => p.id === req.params.portId);
  if (!port) return res.status(404).json({ error: "Port not found" });

  port.isUnused = false;
  port.unusedSince = null;
  port.events.unshift({
    timestamp: new Date(),
    event: "down",
    details: `Marked as reviewed by ${req.body.reviewedBy || "admin"}`,
  });
  await sw.save();
  res.json({ message: "Port marked as reviewed", port });
});

// POST scan all ports and auto-flag unused ones
app.post("/api/switches/:id/scan-unused", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  const thresholdDays = parseInt(req.body.thresholdDays) || 14;
  const thresholdMs = thresholdDays * 86400000;
  let flagged = 0;

  sw.ports.forEach(port => {
    if (port.status !== "up" && port.lastSeen) {
      const sinceSeen = Date.now() - port.lastSeen.getTime();
      if (sinceSeen >= thresholdMs && !port.isUnused) {
        port.isUnused = true;
        port.unusedSince = port.unusedSince || port.lastSeen;
        flagged++;
      }
    }
    // Clear unused flag if port is up
    if (port.status === "up" && port.isUnused) {
      port.isUnused = false;
      port.unusedSince = null;
    }
  });

  await sw.save();
  res.json({ message: `Scan complete`, flagged, thresholdDays });
});

// GET switch stats including unused breakdown
app.get("/api/switches/:id/stats", async (req, res) => {
  const sw = await Switch.findById(req.params.id);
  if (!sw) return res.status(404).json({ error: "Not found" });
  const now = Date.now();

  const unusedPorts = sw.ports.filter(p => p.isUnused);
  const unusedBuckets = {
    "14-30d": unusedPorts.filter(p => { const d = (now - p.unusedSince) / 86400000; return d >= 14 && d < 30; }).length,
    "30-90d": unusedPorts.filter(p => { const d = (now - p.unusedSince) / 86400000; return d >= 30 && d < 90; }).length,
    "90d+": unusedPorts.filter(p => { const d = (now - p.unusedSince) / 86400000; return d >= 90; }).length,
  };

  res.json({
    total: sw.ports.length,
    up: sw.ports.filter(p => p.status === "up").length,
    down: sw.ports.filter(p => p.status === "down").length,
    disabled: sw.ports.filter(p => p.status === "disabled").length,
    unused: unusedPorts.length,
    unusedBuckets,
    poeActive: sw.ports.filter(p => p.poe).length,
    totalPoeWatts: sw.ports.reduce((s, p) => s + p.poeWatts, 0).toFixed(1),
    vlanBreakdown: [...new Set(sw.ports.map(p => p.vlan))].sort((a, b) => a - b).map(vlan => ({
      vlan, count: sw.ports.filter(p => p.vlan === vlan).length,
    })),
  });
});

// POST seed
app.post("/api/seed", async (req, res) => {
  await Switch.deleteMany({});
  const sw = new Switch({
    name: "SW-CORE-01",
    hostname: "core-sw1.lab.local",
    ipAddress: "192.168.1.1",
    location: "Server Room A",
    totalStacks: 2,
    ports: [...makePorts(1), ...makePorts(2)],
  });
  await sw.save();

  const unusedCount = sw.ports.filter(p => p.isUnused).length;
  res.json({
    message: "Seeded",
    switchId: sw._id,
    ports: sw.ports.length,
    unused: unusedCount,
  });
});

// SNMP / RESTCONF / SSH stubs (same as before)
app.post("/api/switches/:id/sync/snmp", (req, res) =>
  res.json({ stub: true, message: "Install net-snmp, poll OID 1.3.6.1.2.1.2.2.1.8 for ifOperStatus, update lastSeen on UP" })
);
app.post("/api/switches/:id/sync/restconf", (req, res) =>
  res.json({ stub: true, message: "GET /restconf/data/ietf-interfaces:interfaces — update lastSeen from admin-state" })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
