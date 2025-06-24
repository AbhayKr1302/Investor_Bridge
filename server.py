#!/usr/bin/env python3
import http.server
import socketserver
import os
import re

class ConfigurableHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            # Read the index.html file
            with open('index.html', 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace placeholders with actual environment variables
            firebase_api_key = os.environ.get('FIREBASE_API_KEY', '')
            firebase_project_id = os.environ.get('FIREBASE_PROJECT_ID', '')
            firebase_app_id = os.environ.get('FIREBASE_APP_ID', '')
            
            content = content.replace('FIREBASE_API_KEY_PLACEHOLDER', firebase_api_key)
            content = content.replace('FIREBASE_PROJECT_ID_PLACEHOLDER', firebase_project_id)
            content = content.replace('FIREBASE_APP_ID_PLACEHOLDER', firebase_app_id)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
        else:
            # For all other files, use default behavior
            super().do_GET()

if __name__ == "__main__":
    PORT = 5000
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), ConfigurableHTTPRequestHandler) as httpd:
            print(f"Server running at http://0.0.0.0:{PORT}/")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Port {PORT} is already in use. Trying port 8000...")
            PORT = 8000
            try:
                with socketserver.TCPServer(("0.0.0.0", PORT), ConfigurableHTTPRequestHandler) as httpd:
                    print(f"Server running at http://0.0.0.0:{PORT}/")
                    httpd.serve_forever()
            except OSError:
                print("Both ports 5000 and 8000 are in use. Please check running processes.")
                exit(1)
        else:
            raise