const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ---------- tiny JSON-file "database" ----------
function ensureDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
}
function readDB() {
  ensureDB();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '{}'); }
  catch (e) { return {}; }
}
function writeDB(db) {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get a room's current state
app.get('/api/rooms/:code', (req, res) => {
  const db = readDB();
  const room = db[req.params.code];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// Create a new room (fails if the code is already taken)
app.post('/api/rooms/:code', (req, res) => {
  const db = readDB();
  if (db[req.params.code]) return res.status(409).json({ error: 'Room already exists' });
  const state = { ...req.body, lastUpdate: Date.now() };
  db[req.params.code] = state;
  writeDB(db);
  res.json(state);
});

// Update a room's state (used for joining, and for every move)
// Optional expectedLastUpdate guards against two writes clobbering each other.
app.put('/api/rooms/:code', (req, res) => {
  const db = readDB();
  const room = db[req.params.code];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { state, expectedLastUpdate } = req.body;
  if (typeof expectedLastUpdate === 'number' && room.lastUpdate !== expectedLastUpdate) {
    return res.status(409).json({ error: 'Conflict', current: room });
  }

  const updated = { ...state, lastUpdate: Date.now() };
  db[req.params.code] = updated;
  writeDB(db);
  res.json(updated);
});

// Serve the game for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Chess server running on port ${PORT}`);
});
