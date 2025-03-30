const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let serverProcess;

// Use process.env.PORT if set, otherwise default to 5200
const port = process.env.PORT || "5200";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the web interface via HTTP from the server using the selected port
  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startServer() {
  // Adjust the path if your server.mjs is in a different folder
  const serverPath = path.join(__dirname, "..", "src", "server.mjs");
  // Spawn the Node.js server process with PORT set accordingly
  serverProcess = spawn("node", [serverPath], {
    stdio: "inherit",
    env: { ...process.env, PORT: port },
  });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`Server process exited with code ${code} and signal ${signal}`);
  });
}

app.on("ready", () => {
  startServer();
  // Wait 1 second for the server to start before creating the window
  setTimeout(createWindow, 1000);
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Ensure the server process is killed when the app exits
process.on("exit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
