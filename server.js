
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

function joinRoom(roomId, ws) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const peers = rooms.get(roomId);
  peers.add(ws);
  ws.roomId = roomId;
  ws.send(JSON.stringify({ type: "room-info", peers: peers.size }));
  peers.forEach(client => {
    if (client !== ws && client.readyState === 1) {
      client.send(JSON.stringify({ type: "peer-joined" }));
    }
  });
}

function leaveRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const peers = rooms.get(roomId);
  if (!peers) return;
  peers.delete(ws);
  peers.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "peer-left" }));
    }
  });
  if (peers.size === 0) rooms.delete(roomId);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.type === "join" && msg.room) {
      joinRoom(msg.room, ws);
      return;
    }
    if (["offer", "answer", "ice"].includes(msg.type) && ws.roomId) {
      const peers = rooms.get(ws.roomId);
      if (!peers) return;
      peers.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      });
    }
  });
  ws.on("close", () => {
    leaveRoom(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`➡️  Server running on http://localhost:${PORT}`);
});
