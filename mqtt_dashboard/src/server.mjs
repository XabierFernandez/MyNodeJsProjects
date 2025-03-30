// server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.json());

// Array to hold SSE client responses
const SSEClients = [];

// SSE endpoint: clients connect here to receive messages
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
    if (index !== -1) SSEClients.splice(index, 1);
  });
});

// Helper function to broadcast a message to all SSE clients
function broadcastMessage(message) {
  console.log("[Broadcast]", message);
  SSEClients.forEach((client) => {
    client.write(`data: ${message}\n\n`);
  });
}

let mqttClient = null;

// POST /connect: Establish the MQTT connection
app.post("/connect", (req, res) => {
  const {
    brokerUrl,
    brokerPort,
    topic,
    username,
    password,
    qos,
    tls,
    ca,
    cert,
    key,
    mqttVersion,
  } = req.body;

  if (mqttClient) {
    return res.status(400).json({ error: "Already connected" });
  }

  // Build connection URL based on TLS toggle and protocol selection
  let connectUrl = brokerUrl;
  if (tls) {
    if (!connectUrl.startsWith("mqtts://")) {
      connectUrl = "mqtts://" + connectUrl;
    }
  } else {
    if (!connectUrl.startsWith("mqtt://") && !connectUrl.startsWith("tcp://")) {
      connectUrl = "mqtt://" + connectUrl;
    }
  }
  if (brokerPort) {
    connectUrl += ":" + brokerPort;
  }

  // Set up connection options, including MQTT version if 5 is selected.
  const options = {};
  if (username) options.username = username;
  if (password) options.password = password;
  if (mqttVersion === "5") {
    options.protocolVersion = 5;
  } else {
    // MQTT.js default for MQTT 3.1.1 is protocolVersion 4
    options.protocolVersion = 4;
  }
  if (tls) {
    if (ca) options.ca = ca;
    if (cert) options.cert = cert;
    if (key) options.key = key;
  }

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

  mqttClient.on("message", (topic, message, packet) => {
    let propsStr = "";
    if (packet.properties) {
      // Convert the properties object to a JSON string.
      propsStr = " | Props: " + JSON.stringify(packet.properties);
    }
    // Broadcast message with properties appended
    broadcastMessage(
      `Topic: ${topic} | Message: ${message.toString()}${propsStr}`,
    );
  });

  mqttClient.on("error", (err) => {
    broadcastMessage(`MQTT Error: ${err.message}`);
  });

  return res.json({ status: "Connecting" });
});

// POST /disconnect: End the MQTT connection
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

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Export a function to start the server programmatically
export function startServer(port = process.env.PORT || 5200) {
  const server = app.listen(port, () => {
    console.log(`[Server] Running on http://localhost:${port}`);
  });
  return server;
}

// If this file is run directly, start the server automatically.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
