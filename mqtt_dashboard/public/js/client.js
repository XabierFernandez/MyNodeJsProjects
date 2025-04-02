// Global array to store historical MQTT data (each message as an object)
const historicalData = [];

// Global variables to store chart property paths for continuous updating
window.chartXPath = null;
window.chartYPath = null;

// SSE Setup: Listen to /events for real-time messages
const eventSource = new EventSource("/events");
const messagesDiv = document.getElementById("messages");

eventSource.onmessage = function (e) {
  const { topic, jsonString, props } = parseTopicAndPayload(e.data);
  let dataObj;
  try {
    dataObj = JSON.parse(jsonString);
  } catch (err) {
    console.error("JSON parse error:", err);
    dataObj = { text: jsonString };
  }
  if (!dataObj.receivedTime) {
    dataObj.receivedTime = Date.now();
  }
  historicalData.push(dataObj);

  // Build HTML for display
  let displayedTopic = topic
    ? `<div class="topic-label">Topic: <span class="topic-name">${topic}</span></div>`
    : "";
  let messageHTML = dataObj.text ? dataObj.text : syntaxHighlight(dataObj);
  let propsHTML = "";
  if (props) {
    try {
      const parsedProps = JSON.parse(props);
      propsHTML = `<div class="props-label">Properties: <pre class="json-output">${syntaxHighlight(parsedProps)}</pre></div>`;
    } catch (err) {
      propsHTML = `<div class="props-label">Properties: ${props}</div>`;
    }
  }
  const time = new Date().toLocaleTimeString();
  const fullHTML = `
    <div class="message">
      <div class="timestamp">${time}</div>
      ${displayedTopic}
      <pre class="json-output">${messageHTML}</pre>
      ${propsHTML}
    </div>
  `;
  messagesDiv.innerHTML += fullHTML;

  // If chart is plotted, update it continuously with the new data point.
  if (
    window.myChart &&
    window.chartXPath != null &&
    window.chartYPath != null
  ) {
    let newX = getValueByPath(dataObj, window.chartXPath);
    let newY = getValueByPath(dataObj, window.chartYPath);
    // If newX or newY is an array, take the first element
    if (Array.isArray(newX)) newX = newX[0];
    if (Array.isArray(newY)) newY = newY[0];
    if (newX !== null && newY !== null) {
      window.myChart.data.labels.push(new Date(newX));
      window.myChart.data.datasets[0].data.push(newY);
      window.myChart.update();
    }
  }
};

// Helper: Parse "Topic", "Message", and optional "Props" from SSE data
function parseTopicAndPayload(data) {
  const match = data.match(
    /^Topic:\s+(.+?)\s+\|\s+Message:\s+(.*?)(\s+\|\s+Props:\s+(.*))?$/,
  );
  if (match) {
    return {
      topic: match[1],
      jsonString: match[2],
      props: match[4] || "",
    };
  }
  return { topic: null, jsonString: data, props: "" };
}

// Helper: Syntax highlight JSON content
function syntaxHighlight(json) {
  if (typeof json !== "string") {
    json = JSON.stringify(json, null, 2);
  }
  json = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|\b-?\d+(\.\d+)?\b)/g,
    function (match) {
      let cls = "number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "key" : "string";
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

/**
 * getValueByPath:
 * - If path is empty or "current", returns item.receivedTime.
 * - If path contains a dot (e.g. "/Test/wave.ts"), then:
 *     * Splits the path into two parts: the array property and the sub-property.
 *     * Returns an array of values for that sub-property from each element.
 * - Otherwise, returns item[path].
 * Numeric strings are converted to numbers.
 */
function getValueByPath(item, path) {
  if (!path || path === "current") {
    return item.receivedTime;
  }
  path = path.trim();
  const dotIndex = path.indexOf(".");
  if (dotIndex !== -1) {
    const arrProp = path.substring(0, dotIndex).trim();
    const subProp = path.substring(dotIndex + 1).trim();
    const arrVal = item[arrProp];
    if (!Array.isArray(arrVal) || arrVal.length === 0) {
      return null;
    }
    return arrVal.map((elem) => {
      let val = elem[subProp];
      if (typeof val === "string" && /^\d+$/.test(val)) {
        return Number(val);
      }
      return val;
    });
  } else {
    let val = item[path] || null;
    if (typeof val === "string" && /^\d+$/.test(val)) {
      val = Number(val);
    }
    return val;
  }
}

// Connect button handler
document.getElementById("connectBtn").addEventListener("click", () => {
  const data = {
    brokerUrl: document.getElementById("brokerUrl").value,
    brokerPort: document.getElementById("brokerPort").value,
    topic: document.getElementById("topic").value,
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    qos: document.getElementById("qos").value,
    tls: document.getElementById("tlsToggle").checked,
    mqttVersion: document.getElementById("mqttVersion").value,
  };
  if (data.tls) {
    data.ca = "";
    data.cert = "";
    data.key = "";
  }
  fetch("/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((json) => console.log("Connect:", json))
    .catch((err) => console.error(err));
});

// Disconnect button handler
document.getElementById("disconnectBtn").addEventListener("click", () => {
  fetch("/disconnect", { method: "POST" })
    .then((res) => res.json())
    .then((json) => console.log("Disconnect:", json))
    .catch((err) => console.error(err));
});

// Clear Output button handler
document.getElementById("clearBtn").addEventListener("click", () => {
  messagesDiv.innerHTML = "";
});

// Download Output button handler
document.getElementById("downloadBtn").addEventListener("click", () => {
  const text = messagesDiv.innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mqtt_messages.txt";
  link.click();
  URL.revokeObjectURL(url);
});

// Copy to Clipboard button handler
document.getElementById("copyBtn").addEventListener("click", () => {
  const text = messagesDiv.innerText;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const notification = document.getElementById("notification");
      notification.textContent = "Copied to clipboard!";
      setTimeout(() => {
        notification.textContent = "";
      }, 3000);
    })
    .catch((err) => console.error("Copy failed", err));
});

// Plot Chart button handler
document.getElementById("plotBtn").addEventListener("click", () => {
  const xPath = document.getElementById("xField").value.trim();
  const yPath = document.getElementById("yField").value.trim();

  // Store chart property paths globally for continuous updates
  window.chartXPath = xPath === "" ? "current" : xPath;
  window.chartYPath = yPath === "" ? "value" : yPath;

  // Build data points from historicalData
  const dataPoints = [];
  historicalData.forEach((item) => {
    const rawX = getValueByPath(item, window.chartXPath);
    const rawY = getValueByPath(item, window.chartYPath);
    if (Array.isArray(rawX) && Array.isArray(rawY)) {
      const len = Math.min(rawX.length, rawY.length);
      for (let i = 0; i < len; i++) {
        if (rawX[i] !== null && rawY[i] !== null) {
          dataPoints.push({ x: rawX[i], y: rawY[i] });
        }
      }
    } else if (Array.isArray(rawX)) {
      rawX.forEach((xVal) => {
        if (xVal !== null && rawY !== null) {
          dataPoints.push({ x: xVal, y: rawY });
        }
      });
    } else if (Array.isArray(rawY)) {
      rawY.forEach((yVal) => {
        if (rawX !== null && yVal !== null) {
          dataPoints.push({ x: rawX, y: yVal });
        }
      });
    } else {
      if (rawX !== null && rawY !== null) {
        dataPoints.push({ x: rawX, y: rawY });
      }
    }
  });

  // Sort data points by x (time)
  dataPoints.sort((a, b) => a.x - b.x);

  // Prepare labels and data for Chart.js
  const labels = dataPoints.map((pt) => new Date(pt.x));
  const yValues = dataPoints.map((pt) => pt.y);

  const ctx = document.getElementById("dataChart").getContext("2d");
  if (window.myChart) {
    window.myChart.destroy();
  }

  window.myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: `Plot of ${window.chartYPath} vs. ${window.chartXPath === "current" ? "Received Time" : window.chartXPath}`,
          data: yValues,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          fill: false,
          tension: 0.1,
        },
      ],
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "MMM d, yyyy, h:mm:ss a",
            displayFormats: {
              millisecond: "h:mm:ss.SSS a",
              second: "h:mm:ss a",
              minute: "h:mm a",
              hour: "hA",
              day: "MMM d",
              week: "MMM d",
              month: "MMM yyyy",
              quarter: "QQQ - yyyy",
              year: "yyyy",
            },
          },
          title: {
            display: true,
            text:
              window.chartXPath === "current"
                ? "Received Time"
                : window.chartXPath,
          },
        },
        y: {
          title: {
            display: true,
            text: window.chartYPath,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
            },
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "x",
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: "x",
          },
        },
      },
    },
  });
});

// Export Data (CSV) button handler
document.getElementById("exportBtn").addEventListener("click", () => {
  if (historicalData.length === 0) return;
  const headers = Object.keys(historicalData[0]).join(",");
  let csv = headers + "\n";
  historicalData.forEach((item) => {
    const row = Object.values(item).join(",");
    csv += row + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "historical_data.csv";
  link.click();
  URL.revokeObjectURL(url);
});
