"""
Alerts System — in-process event bus for surfacing agent activity to the frontend.
Thread-safe append-only log; frontend polls GET /api/alerts.
"""
from datetime import datetime
from typing import List, Optional
import threading

class Alert:
    _id_counter = 0
    _lock = threading.Lock()

    def __init__(self, title: str, message: str, severity: str = "info"):
        with Alert._lock:
            Alert._id_counter += 1
            self.id = Alert._id_counter
        self.title = title
        self.message = message
        # severity: "info" | "success" | "warning" | "error"
        self.severity = severity
        self.timestamp = datetime.utcnow().isoformat() + "Z"
        self.read = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "read": self.read,
        }


class AlertSystem:
    def __init__(self, max_alerts: int = 100):
        self._alerts: List[Alert] = []
        self._lock = threading.Lock()
        self._max = max_alerts

    def add_alert(self, title: str, message: str, severity: str = "info") -> Alert:
        alert = Alert(title=title, message=message, severity=severity)
        with self._lock:
            self._alerts.append(alert)
            # Rolling window so we don't accumulate forever
            if len(self._alerts) > self._max:
                self._alerts = self._alerts[-self._max:]
        return alert

    def get_alerts(self) -> List[dict]:
        with self._lock:
            return [a.to_dict() for a in reversed(self._alerts)]

    def mark_read(self, alert_id: int) -> bool:
        with self._lock:
            for a in self._alerts:
                if a.id == alert_id:
                    a.read = True
                    return True
        return False

    def mark_all_read(self):
        with self._lock:
            for a in self._alerts:
                a.read = True

    def clear(self):
        with self._lock:
            self._alerts.clear()

    @property
    def unread_count(self) -> int:
        with self._lock:
            return sum(1 for a in self._alerts if not a.read)


# Singleton — imported everywhere
alert_system = AlertSystem()
