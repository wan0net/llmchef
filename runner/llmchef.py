#!/usr/bin/env python3
import os
import sys
import shutil
import zipfile
import argparse
from urllib import request
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socket

# Parse command line arguments
parser = argparse.ArgumentParser(description='Download and serve LLMChef')
parser.add_argument('port', nargs='?', type=int, default=3000, help='Port number to serve on')
parser.add_argument('--host', '-H', action='store_true', help='Allow external connections')
args = parser.parse_args()

# Create temp directory
release_url = os.environ.get('LLMCHEF_RELEASE_URL', 'https://wan0.net/llmchef/release/latest.zip')
temp_dir = os.environ.get('LLMCHEF_RUNNER_APP_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'llmchef-app'))
os.makedirs(temp_dir, exist_ok=True)

# Change to temp directory
os.chdir(temp_dir)

# Download the zip file
print("Downloading LLMChef release...")
zip_path = os.path.join(temp_dir, 'llmchef.zip')
try:
    request.urlretrieve(release_url, zip_path)  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
    print("Download complete. Extracting...")

    # Extract the zip file
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)

    # Remove the zip file
    os.remove(zip_path)
    print("Extraction complete.")

    # Serve the files
    class SPAHandler(SimpleHTTPRequestHandler):
        def do_GET(self):
            if not os.path.exists(self.translate_path(self.path)):
                self.path = '/index.html'
            return SimpleHTTPRequestHandler.do_GET(self)

    host = '0.0.0.0' if args.host else 'localhost'
    server = HTTPServer((host, args.port), SPAHandler)

    hostname = socket.gethostname()
    ip = socket.gethostbyname(hostname)
    access_message = f"http://{ip}:{args.port} (accessible from other devices)" if args.host else f"http://localhost:{args.port} (local access only)"
    print(f"LLMChef is running at {access_message}")

    server.serve_forever()

except Exception as e:
    if os.path.exists(zip_path):
        os.remove(zip_path)
    print(f"Error: {e}")
    sys.exit(1)
