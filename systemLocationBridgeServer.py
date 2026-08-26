import sys
import json
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

activeProcess = None
activeProcessLock = threading.Lock()

def terminateActiveSimulation():
    global activeProcess
    if activeProcess is not None:
        try:
            activeProcess.terminate()
            activeProcess.wait(timeout=2)
        except Exception:
            try:
                activeProcess.kill()
            except Exception:
                pass
        activeProcess = None

class LocationBridgeRequestHandler(BaseHTTPRequestHandler):
    def _sendCorsHeaders(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._sendCorsHeaders()
        self.end_headers()

    def do_POST(self):
        global activeProcess
        if self.path == "/set-location":
            contentLength = int(self.headers.get("Content-Length", 0))
            requestBody = self.rfile.read(contentLength).decode("utf-8")
            data = json.loads(requestBody)
            latitude = float(data["latitude"])
            longitude = float(data["longitude"])

            with activeProcessLock:
                terminateActiveSimulation()
                command = [
                    sys.executable,
                    "-m",
                    "pymobiledevice3",
                    "developer",
                    "dvt",
                    "simulate-location",
                    "set",
                    "--userspace",
                    str(latitude),
                    str(longitude)
                ]
                activeProcess = subprocess.Popen(
                    command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )

            responsePayload = {"status": "success", "latitude": latitude, "longitude": longitude}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._sendCorsHeaders()
            self.end_headers()
            self.wfile.write(json.dumps(responsePayload).encode("utf-8"))

        elif self.path == "/reset-location":
            with activeProcessLock:
                terminateActiveSimulation()
                command = [
                    sys.executable,
                    "-m",
                    "pymobiledevice3",
                    "developer",
                    "dvt",
                    "simulate-location",
                    "clear",
                    "--userspace"
                ]
                subprocess.run(command, capture_output=True, timeout=5)

            responsePayload = {"status": "reset"}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._sendCorsHeaders()
            self.end_headers()
            self.wfile.write(json.dumps(responsePayload).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def runServer(port=8082):
    serverAddress = ("", port)
    httpd = HTTPServer(serverAddress, LocationBridgeRequestHandler)
    print(f"System location bridge server active on port {port}")
    httpd.serve_forever()

if __name__ == "__main__":
    runServer()
