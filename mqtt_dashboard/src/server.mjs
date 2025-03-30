// server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../public")));

// Parse JSON bodies (for /connect and /disconnect)
app.use(bodyParser.json());

// SSE clients array
const SSEClients = [];

// SSE endpoint – clients connect here to receive messages
app.get("/events", (req, res) => {
  console.log("[SSE] Client connected");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  SSEClients.push(res);

  req.on("close", () => {
    console.log("[SSE] Client disconnected");
    const index = SSEClients.indexOf(res);
    if (index >= 0) {
      SSEClients.splice(index, 1);
    }
  });
});

// Function to broadcast a message to all SSE clients
function broadcastMessage(message) {
  console.log("[Broadcast]", message);
  SSEClients.forEach((client) => {
    client.write(`data: ${message}\n\n`);
  });
}

// Global MQTT client reference
let mqttClient = null;

// POST /connect – Initiates the MQTT connection
app.post("/connect", (req, res) => {
  const { brokerUrl, brokerPort, topic, username, password, qos } = req.body;

  // If we already have a client, prevent multiple connections
  if (mqttClient) {
    return res.status(400).json({ error: "Already connected" });
  }

  // Build the MQTT URL (e.g., mqtt://datasim.n3uron.com:1883)
  let connectUrl = brokerUrl;
  if (!connectUrl.startsWith("mqtt://") && !connectUrl.startsWith("tcp://")) {
    connectUrl = "mqtt://" + connectUrl;
  }
  if (brokerPort) {
    connectUrl += `:${brokerPort}`;
  }

  const options = {};
  if (username) options.username = username;
  if (password) options.password = password;

  broadcastMessage(`Connecting to: ${connectUrl} ...`);

  mqttClient = mqtt.connect(connectUrl, options);

  mqttClient.on("connect", () => {
    broadcastMessage(`Connected to broker at ${connectUrl}`);
    mqttClient.subscribe(topic, { qos: Number(qos) }, (err) => {
      if (err) {
        broadcastMessage(`Subscription error: ${err.message}`);
      } else {
        broadcastMessage(`Subscribed to topic: ${topic} (QoS: ${qos})`);
      }
    });
  });

  mqttClient.on("message", (t, message) => {
    broadcastMessage(`Topic: ${t} | Message: ${message.toString()}`);
  });

  mqttClient.on("error", (err) => {
    broadcastMessage(`MQTT Error: ${err.message}`);
  });

  return res.json({ status: "Connecting" });
});

// POST /disconnect – Ends the MQTT connection
app.post("/disconnect", (req, res) => {
  if (mqttClient) {
    mqttClient.end(() => {
      broadcastMessage("Disconnected from MQTT broker.");
      mqttClient = null;
    });
    return res.json({ status: "Disconnecting" });
  } else {
    return res.status(400).json({ error: "Not connected" });
  }
});

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
