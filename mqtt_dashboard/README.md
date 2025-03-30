# MQTT Client Dashboard

This project is a Node.js-based MQTT dashboard that allows you to connect to an MQTT broker, subscribe to topics, and display incoming messages in real time. The server makes the raw TCP MQTT connection and broadcasts messages to the client using Server-Sent Events (SSE). The web interface (client) provides a user-friendly dashboard with a connection form, pretty-printed JSON message output with syntax highlighting, and control buttons to clear, download, or copy the log.
