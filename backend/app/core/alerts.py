from typing import List, Dict
import datetime

class AlertSystem:
    def __init__(self):
        self.inbox: List[Dict] = []

    def add_alert(self, title: str, message: str, severity: str = "info"):
        """Severity: info, success, warning, critical"""
        alert = {
            "id": len(self.inbox) + 1,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "title": title,
            "message": message,
            "severity": severity,
            "read": False
        }
        self.inbox.insert(0, alert)  # Newest first
        return alert

    def get_alerts(self):
        return self.inbox

    def mark_read(self, alert_id: int):
        for a in self.inbox:
            if a["id"] == alert_id:
                a["read"] = True
                return True
        return False

    def mark_all_read(self):
        for a in self.inbox:
            a["read"] = True

    def clear(self):
        self.inbox = []

alert_system = AlertSystem()