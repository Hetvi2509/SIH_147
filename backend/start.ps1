# SR-Mamba AMC Backend — Startup Script
# Run this from the SIH_Frontend directory

Write-Host "Starting SR-Mamba AMC Backend..." -ForegroundColor Cyan

# Install dependencies if needed
pip install -r backend/requirements.txt

# Start the FastAPI server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
