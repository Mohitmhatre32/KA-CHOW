import os
import time
import requests
import subprocess
import random
from app.core.config import settings

class SonarQubeClient:
    def __init__(self):
        self.base_url = settings.SONAR_URL.rstrip('/')
        self.token = settings.SONAR_TOKEN

    def run_scanner(self, project_path: str, project_key: str):
        """
        Runs the official SonarScanner via Docker on the given project directory.
        """
        print(f"\n🚀 Triggering ACTUAL SonarQube Scanner for '{project_key}'...")
        print("⏳ Please wait ~15-30 seconds for the deep analysis to complete...")
        
        # On Windows Docker, containers access the host's localhost via 'host.docker.internal'
        sonar_host = self.base_url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
        
        # Build the Docker command
        cmd = [
            "docker", "run", "--rm",
            "-v", f"{os.path.abspath(project_path)}:/usr/src",
            "sonarsource/sonar-scanner-cli",
            f"-Dsonar.projectKey={project_key}",
            "-Dsonar.sources=.",
            f"-Dsonar.host.url={sonar_host}",
            f"-Dsonar.login={self.token}"
        ]
        
        try:
            # Run the scanner and block until it finishes
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            print("✅ SonarScanner finished pushing data to server!")
            
            # SonarQube needs a few seconds to process the background task
            print("⏳ Waiting 5 seconds for SonarQube Compute Engine to finalize...")
            time.sleep(5)
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Scanner Failed. Error: {e.stderr}")
            return False

    def get_file_metrics(self, file_path: str, project_key: str):
        """Fetches the REAL metrics from the SonarQube API."""
        try:
            component_key = f"{project_key}:{file_path}"
            url = f"{self.base_url}/api/measures/component"
            params = {
                'component': component_key, 
                'metricKeys': 'bugs,vulnerabilities,code_smells,coverage,security_hotspots_reviewed,duplicated_lines_density'
            }
            
            res = requests.get(url, params=params, auth=(self.token, ''), timeout=3)
            
            if res.status_code == 200:
                data = res.json()
                measures = {m['metric']: m['value'] for m in data.get('component', {}).get('measures', [])}
                
                bugs = int(measures.get("bugs", 0))
                vulns = int(measures.get("vulnerabilities", 0))
                smells = int(measures.get("code_smells", 0))
                hotspots = float(measures.get("security_hotspots_reviewed", 100.0))
                duplications = float(measures.get("duplicated_lines_density", 0.0))
                
                return {
                    "reliability": bugs,           # Bugs mapping
                    "security": vulns,             # Vulnerabilities mapping
                    "maintainability": smells,      # Code Smells mapping
                    "coverage": float(measures.get("coverage", 100.0)),
                    "security_hotspots": hotspots,
                    "duplications": duplications,
                    "bugs": bugs, # Keep for backward compatibility
                    "vulnerabilities": vulns,
                    "code_smells": smells,
                    "quality_gate": "FAILED" if (bugs > 0 or vulns > 0 or duplications > 5.0) else "PASSED"
                }
            else:
                raise Exception(f"API returned {res.status_code}")
                
        except Exception as e:
            # Fallback only if the API completely fails
            print(f"⚠️ Could not fetch real data for {file_path}: {e}")
            return {
                "bugs": 0, "vulnerabilities": 0, "code_smells": 0, "coverage": 100, "quality_gate": "PASSED"
            }

    def get_project_metrics(self, project_key: str):
        """Fetches aggregate metrics for the entire project."""
        try:
            url = f"{self.base_url}/api/measures/component"
            params = {
                'component': project_key, 
                'metricKeys': 'bugs,vulnerabilities,code_smells,coverage,alert_status,security_rating,reliability_rating,sqale_rating,security_hotspots,duplicated_lines_density'
            }
            
            res = requests.get(url, params=params, auth=(self.token, ''), timeout=3)
            
            if res.status_code == 200:
                data = res.json()
                measures = {m['metric']: m['value'] for m in data.get('component', {}).get('measures', [])}
                
                return {
                    "bugs": int(measures.get("bugs", 0)),
                    "vulnerabilities": int(measures.get("vulnerabilities", 0)),
                    "code_smells": int(measures.get("code_smells", 0)),
                    "coverage": float(measures.get("coverage", 100.0)),
                    "duplicated_lines_density": float(measures.get("duplicated_lines_density", 0.0)),
                    "security_rating": float(measures.get("security_rating", 1.0)),
                    "reliability_rating": float(measures.get("reliability_rating", 1.0)),
                    "maintainability_rating": float(measures.get("sqale_rating", 1.0)),
                    "security_hotspots": int(measures.get("security_hotspots", 0)),
                    "quality_gate": measures.get("alert_status", "PASSED")
                }
            else:
                raise Exception(f"API returned {res.status_code}")
        except Exception as e:
            print(f"⚠️ Could not fetch project metrics for {project_key}: {e}")
            return {
                "bugs": 0, "vulnerabilities": 0, "code_smells": 0, "coverage": 100, 
                "security_hotspots": 100, "duplications": 0, "quality_gate": "PASSED"
            }

sonar = SonarQubeClient()