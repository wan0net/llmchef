#!/usr/bin/env python3
import os
import sys
import shutil
import zipfile
import argparse
from urllib import error, request
from urllib.parse import urlparse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socket
import ipaddress

DEFAULT_RELEASE_URL = 'https://wan0.net/llmchef/release/latest.zip'


def resolve_release_url():
    raw_url = os.environ.get('LLMCHEF_RELEASE_URL')
    if not raw_url:
        return DEFAULT_RELEASE_URL
    if raw_url == DEFAULT_RELEASE_URL:
        return raw_url

    parsed = urlparse(raw_url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError('LLMCHEF_RELEASE_URL only supports http(s) loopback overrides.')

    hostname = parsed.hostname
    if not hostname:
        raise ValueError('LLMCHEF_RELEASE_URL must include a hostname.')

    if hostname == 'localhost':
        return raw_url

    try:
        if ipaddress.ip_address(hostname).is_loopback:
            return raw_url
    except ValueError:
        pass

    raise ValueError('LLMCHEF_RELEASE_URL must stay on the default release origin or a loopback host.')


class NoRedirectHandler(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download_release(release_url, zip_path):
    allow_redirects = release_url == DEFAULT_RELEASE_URL
    current_url = release_url
    opener = request.build_opener(NoRedirectHandler)

    for redirect_count in range(6):
        req = request.Request(current_url)
        try:
            with opener.open(req) as response, open(zip_path, 'wb') as target:
                shutil.copyfileobj(response, target)
                return
        except error.HTTPError as exc:
            if 300 <= exc.code < 400 and exc.headers.get('Location'):
                if not allow_redirects:
                    raise ValueError('Redirects are not allowed for LLMCHEF_RELEASE_URL overrides.') from exc
                current_url = request.urljoin(current_url, exc.headers['Location'])
                continue
            raise

    raise ValueError('Too many redirects while downloading LLMChef release.')

# Parse command line arguments
parser = argparse.ArgumentParser(description='Download and serve LLMChef')
parser.add_argument('port', nargs='?', type=int, default=3000, help='Port number to serve on')
parser.add_argument('--host', '-H', action='store_true', help='Allow external connections')
args = parser.parse_args()

# Create temp directory
release_url = resolve_release_url()
temp_dir = os.environ.get('LLMCHEF_RUNNER_APP_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'llmchef-app'))
os.makedirs(temp_dir, exist_ok=True)

# Change to temp directory
os.chdir(temp_dir)

# Download the zip file
print("Downloading LLMChef release...")
zip_path = os.path.join(temp_dir, 'llmchef.zip')
try:
    download_release(release_url, zip_path)
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
