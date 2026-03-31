"""
Rocket Crash Game - Main Application
Run with: python app.py
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn

# Import routes from service
from service.game_service import router as game_router
from service.config_service import settings, db_config

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Rocket Crash Game API with Database",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(game_router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Rocket Crash Game API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    print("=" * 50)
    print(f"🚀 {settings.APP_NAME}")
    print("=" * 50)
    print(f"📡 Server: http://{settings.API_HOST}:{settings.API_PORT}")
    print(f"📚 API Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")
    print(f"💾 Database: {db_config.DB_NAME} @ {db_config.DB_HOST}")
    print("=" * 50)
    print("Press CTRL+C to stop")
    print("=" * 50)
    
    uvicorn.run(
        app,
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )