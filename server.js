const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// ---------- Mongo config ----------
// Set MONGODB_URI in your environment (e.g. a MongoDB Atlas connection string).
// Falls back to a local MongoDB instance for local dev.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'two_square_chess';

// The game no longer uses per-game room codes — everyone plays the same
// fixed, persistent game, identified by this id.
const GAME_ID = 'mychess';

let gamesCollection;

function freshState() {
  return {
    _id: GAME_ID,
    board: [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ],
    turn: 'white',
    whiteId: null,
    blackId: null,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmoveClock: 0,
    captured: { white: [], black: [] },
    status: 'playing',
    winner: null,
    lastUpdate: Date.now()
  };
}

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  gamesCollection = db.collection('games');
  await gamesCollection.createIndex({ _id: 1 });
  console.log(`Connected to MongoDB (${MONGODB_DB})`);
}

// ---------- realtime broadcast ----------
function broadcastState(state) {
  const payload = JSON.stringify({ type: 'state', state });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

wss.on('connection', async (ws) => {
  try {
    let game = await gamesCollection.findOne({ _id: GAME_ID });
    if (!game) {
      game = freshState();
      await gamesCollection.insertOne(game);
    }
    ws.send(JSON.stringify({ type: 'state', state: game }));
  } catch (e) {
    console.error('WS initial state error:', e);
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get the current (single, fixed) game state — auto-creates it on first access.
app.get('/api/game', async (req, res) => {
  try {
    let game = await gamesCollection.findOne({ _id: GAME_ID });
    if (!game) {
      game = freshState();
      await gamesCollection.insertOne(game);
    }
    res.json(game);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update the game state (used for claiming/leaving a seat and for every move).
// Optional expectedLastUpdate guards against two writes clobbering each other.
app.put('/api/game', async (req, res) => {
  try {
    const { state, expectedLastUpdate } = req.body;
    let game = await gamesCollection.findOne({ _id: GAME_ID });
    if (!game) {
      game = freshState();
      await gamesCollection.insertOne(game);
    }

    if (typeof expectedLastUpdate === 'number' && game.lastUpdate !== expectedLastUpdate) {
      return res.status(409).json({ error: 'Conflict', current: game });
    }

    const updated = { ...state, _id: GAME_ID, lastUpdate: Date.now() };
    await gamesCollection.replaceOne({ _id: GAME_ID }, updated, { upsert: true });
    broadcastState(updated);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Reset the board back to a fresh game. Same fixed id — no new code to share.
app.post('/api/game/reset', async (req, res) => {
  try {
    const fresh = freshState();
    await gamesCollection.replaceOne({ _id: GAME_ID }, fresh, { upsert: true });
    broadcastState(fresh);
    res.json(fresh);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve the game for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Chess server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
