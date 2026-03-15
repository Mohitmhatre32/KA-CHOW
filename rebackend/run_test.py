import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.agents.architect.service import architect_service

try:
    res = architect_service.analyze_impact(
        project_name="arch_ai_gen_1babb671_1773569096",
        target_file="root",
        proposed_change="What if I change the datatype from int to string?"
    )
    import json
    # Print the raw Pydantic model response
    print(json.dumps([node.model_dump() for node in res.impacted_files], indent=2))
except Exception as e:
    print(f"Error: {e}")
