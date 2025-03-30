// public/js/client.js
// We do NOT import mqtt with ES modules, because it's loaded globally from the CDN.

let client = null;
let messagesContainer = null;

// Helper function to log messages in the UI and browser console
function appendMessage(msg) {
  console.log(msg); // log to browser console
  if (!messagesContainer) {
    messagesContainer = document.getElementById("messages");
  }
  const timestamp = new Date().toISOString();
  messagesContainer.innerHTML += `<pre>[${timestamp}] ${msg}</pre>`;
}

// Connect to the MQTT broker using WebSockets
export function initializeMQTT(
  brokerUrl,
  brokerPort,
  topic,
  username,
  password,
  qos,
) {
  if (!messagesContainer) {
    messagesContainer = document.getElementById("messages");
  }

  // Build connection options
  const options = {};
  if (username) options.username = username;
  if (password) options.password = password;

  // For WebSockets, your brokerUrl must start with ws:// or wss://
  // e.g. "ws://broker.hivemq.com"
  // Add port if provided
  const connectUrl = brokerPort ? `${brokerUrl}:${brokerPort}` : brokerUrl;

  appendMessage(`Connecting to: ${connectUrl} ...`);

  // Use the global mqtt object from the CDN
  client = mqtt.connect(connectUrl, options);

  // On successful connection, subscribe
  client.on("connect", () => {
    appendMessage(`Connected to broker at ${connectUrl}`);
    client.subscribe(topic, { qos }, (err) => {
      if (err) {
        appendMessage(`Subscription error: ${err.message}`);
      } else {
        appendMessage(`Subscribed to topic: ${topic} (QoS: ${qos})`);
      }
    });
  });

  // Display incoming messages
  client.on("message", (topic, message) => {
    appendMessage(`Topic: ${topic} | Message: ${message.toString()}`);
  });

  // Log any errors
  client.on("error", (err) => {
    appendMessage(`MQTT Error: ${err.message}`);
  });
}

// Disconnect from the MQTT broker
export function disconnectMQTT() {
  if (client) {
    client.end(() => {
      appendMessage("Disconnected from MQTT broker.");
      client = null;
    });
  } else {
    appendMessage("No active MQTT connection to disconnect.");
  }
}

// Clear the messages display
export function clearOutput() {
  if (!messagesContainer) {
    messagesContainer = document.getElementById("messages");
  }
  messagesContainer.innerHTML = "";
  appendMessage("Cleared output.");
}

// Save the output to local storage
export function saveOutput() {
  if (!messagesContainer) {
    messagesContainer = document.getElementById("messages");
  }
  const text = messagesContainer.innerText;
  localStorage.setItem("mqttMessages", text);
  appendMessage("Messages saved to local storage.");
}

// Download the output as a text file
export function downloadOutput() {
  if (!messagesContainer) {
    messagesContainer = document.getElementById("messages");
  }
  const text = messagesContainer.innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "mqtt_messages.txt";
  link.click();
  URL.revokeObjectURL(url);

  appendMessage("Messages downloaded as mqtt_messages.txt.");
}
