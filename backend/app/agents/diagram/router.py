import logging
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from .models import DiagramRequest, DiagramResponse
from .service import diagram_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/generate", response_model=DiagramResponse, summary="Generate an architecture or process flow diagram")
def generate_diagram(request: DiagramRequest):
    """
    Analyzes the indexed repository graph and uses LLM to generate Mermaid.js markdown.
    """
    try:
        if not request.repo_url:
            raise HTTPException(status_code=400, detail="Repository URL is required")
            
        result = diagram_service.generate_diagram(request)
        return result
    except FileNotFoundError as e:
        logger.error(f"Not found error in diagram generation: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.error(f"Value error in diagram generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in diagram generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error generation diagram")
