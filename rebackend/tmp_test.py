import os
import json
import sys

# add parent directory to path
sys.path.append('c:\\Users\\HP\\OneDrive\\Desktop\\College\\Extra\\KA-CHOW\\rebackend')

# mock settings
from app.core.config import settings
settings.REPO_STORAGE_PATH = "c:\\Users\\HP\\OneDrive\\Desktop\\College\\Extra\\KA-CHOW\\rebackend\\_storage"

from app.agents.architect.service import architect_service

try:
    # Need to make sure project exists or just mock graph_data
    res = architect_service.analyze_impact(
        project_name="test_project",
        target_file="root",
        proposed_change="What if I change the datatype from int to string for user id?"
    )
    print(res.json())
except Exception as e:
    print(f"Error: {e}")
