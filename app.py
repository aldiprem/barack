from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any
import random
import math
import secrets
from datetime import datetime, timedelta
import json

app = FastAPI(title="Rocket Crash Game API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Game state
class GameState:
    def __init__(self):
        self.active_games = {}  # game_id -> game_data
        self.game_history = []   # list of completed games
        
game_state = GameState()

# ============ CRASH POINT GENERATOR ============
def generate_crash_point() -> float:
    """
    Generate random crash point dengan probabilitas:
    - 70% crash di 1.0x - 2.0x
    - 20% crash di 2.0x - 5.0x
    - 8% crash di 5.0x - 10.0x
    - 2% crash di atas 10.0x
    """
    r = random.random()
    
    if r < 0.70:  # 70% - Low multiplier (1.0x - 2.0x)
        # Exponential distribution biased toward low values
        crash = 1.0 + (random.expovariate(3.0) * 0.8)
        crash = min(crash, 2.0)
        
    elif r < 0.90:  # 20% - Medium multiplier (2.0x - 5.0x)
        crash = 2.0 + (random.expovariate(1.5) * 1.5)
        crash = min(crash, 5.0)
        
    elif r < 0.98:  # 8% - High multiplier (5.0x - 10.0x)
        crash = 5.0 + (random.expovariate(0.8) * 2.5)
        crash = min(crash, 10.0)
        
    else:  # 2% - Very high multiplier (10.0x - 50.0x)
        crash = 10.0 + (random.expovariate(0.2) * 15.0)
        crash = min(crash, 50.0)
    
    # Round to 2 decimal places
    return round(crash, 2)

# ============ PYDANTIC MODELS ============
class BetRequest(BaseModel):
    bet_amount: float
    user_id: Optional[str] = "anonymous"

class CashoutRequest(BaseModel):
    game_id: str

class GameResult(BaseModel):
    game_id: str
    crash_point: float
    cashed_out_at: Optional[float] = None
    bet_amount: float
    won_amount: Optional[float] = None
    status: str  # 'active', 'crashed', 'cashed_out'

# ============ GAME ROUTES ============

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "active_games": len(game_state.active_games)
    }

@app.post("/api/game/start")
async def start_game(bet: BetRequest):
    """Start a new game"""
    if bet.bet_amount <= 0:
        raise HTTPException(status_code=400, detail="Bet amount must be greater than 0")
    
    # Generate crash point
    crash_point = generate_crash_point()
    
    # Create game ID
    game_id = secrets.token_hex(16)
    
    # Store game state
    game_state.active_games[game_id] = {
        "game_id": game_id,
        "bet_amount": bet.bet_amount,
        "crash_point": crash_point,
        "start_time": datetime.now(),
        "current_multiplier": 1.0,
        "status": "active",
        "user_id": bet.user_id,
        "cashed_out": False
    }
    
    return {
        "game_id": game_id,
        "bet_amount": bet.bet_amount,
        "message": "Game started. Rocket is launching! 🚀"
    }

@app.get("/api/game/state/{game_id}")
async def get_game_state(game_id: str):
    """Get current game state with real-time multiplier"""
    if game_id not in game_state.active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = game_state.active_games[game_id]
    
    # If game already crashed or cashed out, return final state
    if game["status"] != "active":
        return {
            "game_id": game_id,
            "status": game["status"],
            "crash_point": game["crash_point"],
            "current_multiplier": game.get("current_multiplier", game["crash_point"]),
            "cashed_out_at": game.get("cashed_out_at"),
            "bet_amount": game["bet_amount"],
            "won_amount": game.get("won_amount")
        }
    
    # Calculate current multiplier based on time elapsed
    elapsed = (datetime.now() - game["start_time"]).total_seconds()
    
    # Multiplier increases exponentially with time
    # Formula: multiplier = 1 + (time * 0.8) ^ 1.2
    if elapsed < 0.1:
        current_multiplier = 1.0
    else:
        current_multiplier = 1.0 + (elapsed * 0.8) ** 1.2
    
    # Check if game crashed
    if current_multiplier >= game["crash_point"]:
        game["status"] = "crashed"
        game["current_multiplier"] = game["crash_point"]
        
        # Move to history
        result = {
            "game_id": game_id,
            "crash_point": game["crash_point"],
            "bet_amount": game["bet_amount"],
            "status": "crashed",
            "timestamp": datetime.now().isoformat()
        }
        game_state.game_history.insert(0, result)
        
        # Keep only last 50 games
        game_state.game_history = game_state.game_history[:50]
        
        return {
            "game_id": game_id,
            "status": "crashed",
            "crash_point": game["crash_point"],
            "current_multiplier": game["crash_point"],
            "bet_amount": game["bet_amount"],
            "won_amount": 0
        }
    
    game["current_multiplier"] = round(current_multiplier, 2)
    
    return {
        "game_id": game_id,
        "status": "active",
        "crash_point": game["crash_point"],
        "current_multiplier": round(current_multiplier, 2),
        "bet_amount": game["bet_amount"]
    }

@app.post("/api/game/cashout")
async def cashout(request: CashoutRequest):
    """Cash out current game"""
    if request.game_id not in game_state.active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = game_state.active_games[request.game_id]
    
    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game already finished")
    
    # Get current multiplier
    elapsed = (datetime.now() - game["start_time"]).total_seconds()
    if elapsed < 0.1:
        current_multiplier = 1.0
    else:
        current_multiplier = 1.0 + (elapsed * 0.8) ** 1.2
    
    current_multiplier = round(current_multiplier, 2)
    
    # Check if game crashed before cashout
    if current_multiplier >= game["crash_point"]:
        game["status"] = "crashed"
        return {
            "success": False,
            "message": "Game crashed before you could cash out!",
            "crash_point": game["crash_point"],
            "current_multiplier": game["crash_point"]
        }
    
    # Cash out successful
    won_amount = game["bet_amount"] * current_multiplier
    game["status"] = "cashed_out"
    game["cashed_out_at"] = current_multiplier
    game["won_amount"] = won_amount
    
    # Move to history
    result = {
        "game_id": request.game_id,
        "crash_point": game["crash_point"],
        "cashed_out_at": current_multiplier,
        "bet_amount": game["bet_amount"],
        "won_amount": won_amount,
        "status": "cashed_out",
        "timestamp": datetime.now().isoformat()
    }
    game_state.game_history.insert(0, result)
    game_state.game_history = game_state.game_history[:50]
    
    # Remove from active games
    del game_state.active_games[request.game_id]
    
    return {
        "success": True,
        "game_id": request.game_id,
        "cashed_out_at": current_multiplier,
        "bet_amount": game["bet_amount"],
        "won_amount": won_amount,
        "message": f"You cashed out at {current_multiplier}x! Won: {won_amount:,.2f}"
    }

@app.get("/api/game/history")
async def get_game_history(limit: int = 20):
    """Get recent game history"""
    return game_state.game_history[:limit]

@app.get("/api/game/statistics")
async def get_statistics():
    """Get game statistics"""
    if not game_state.game_history:
        return {
            "total_games": 0,
            "avg_crash_point": 0,
            "crash_distribution": {
                "1x-2x": 0,
                "2x-5x": 0,
                "5x-10x": 0,
                "10x+": 0
            }
        }
    
    total_games = len(game_state.game_history)
    crash_points = [g["crash_point"] for g in game_state.game_history]
    avg_crash = sum(crash_points) / total_games
    
    # Distribution
    dist = {
        "1x-2x": 0,
        "2x-5x": 0,
        "5x-10x": 0,
        "10x+": 0
    }
    
    for cp in crash_points:
        if cp < 2:
            dist["1x-2x"] += 1
        elif cp < 5:
            dist["2x-5x"] += 1
        elif cp < 10:
            dist["5x-10x"] += 1
        else:
            dist["10x+"] += 1
    
    return {
        "total_games": total_games,
        "avg_crash_point": round(avg_crash, 2),
        "crash_distribution": {
            "1x-2x": round(dist["1x-2x"] / total_games * 100, 1),
            "2x-5x": round(dist["2x-5x"] / total_games * 100, 1),
            "5x-10x": round(dist["5x-10x"] / total_games * 100, 1),
            "10x+": round(dist["10x+"] / total_games * 100, 1)
        }
    }

@app.delete("/api/game/cleanup")
async def cleanup_games():
    """Clean up old inactive games"""
    expired_games = []
    now = datetime.now()
    
    for game_id, game in list(game_state.active_games.items()):
        # Remove games older than 5 minutes
        if (now - game["start_time"]).total_seconds() > 300:
            expired_games.append(game_id)
            del game_state.active_games[game_id]
    
    return {
        "cleaned_up": len(expired_games),
        "active_games": len(game_state.active_games)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5050)