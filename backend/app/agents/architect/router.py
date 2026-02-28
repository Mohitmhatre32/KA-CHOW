from fastapi import APIRouter, HTTPException
from .models import ArchitectRequest, ArchitectResponse, ImpactAnalysisRequest, ImpactResult
from .service import architect

router = APIRouter()

@router.post("/scaffold", response_model=ArchitectResponse)
async def scaffold_project(request: ArchitectRequest):
    try:
        return architect.design_and_build(request.requirements)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-impact", response_model=ImpactResult)
async def analyze_impact(request: ImpactAnalysisRequest):
    try:
        return architect.analyze_impact(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))