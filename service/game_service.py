"""
Game Service - All API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import random
import secrets

from .db_service import get_db_connection, GameRound, UserBet, User

router = APIRouter(prefix="/api", tags=["game"])

# ============ PYDANTIC MODELS ============
class BetRequest(BaseModel):
    bet_amount: float
    user_id: str = "web_user"

class CashoutRequest(BaseModel):
    round_id: int
    user_id: str = "web_user"

# ============ CRASH POINT GENERATOR ============
class CrashGenerator:
    def __init__(self):
        self.consecutive_low_crash = 0
    
    def generate_crash_point(self) -> float:
        if self.consecutive_low_crash >= 5:
            crash = random.uniform(5.0, 100.0)
            self.consecutive_low_crash = 0
            return round(crash, 2)
        
        chance_high = min(0.3 + (self.consecutive_low_crash * 0.1), 0.8)
        
        if random.random() < chance_high:
            crash = random.uniform(5.0, 100.0)
            self.consecutive_low_crash = 0
        else:
            crash = random.uniform(1.00, 1.15)
            self.consecutive_low_crash += 1
        
        return round(crash, 2)

crash_generator = CrashGenerator()

# ============ HELPER FUNCTIONS ============
def get_current_round():
    current_round = GameRound.get_current()
    
    if not current_round:
        last_round = GameRound.get_last_round_number()
        crash_point = crash_generator.generate_crash_point()
        round_id = GameRound.create(last_round + 1, crash_point)
        current_round = GameRound.get_by_id(round_id)
    
    return current_round

def check_and_update_round(round_data):
    start_time = round_data['start_time']
    elapsed = (datetime.now() - start_time).total_seconds()
    
    if elapsed < 0.1:
        current_multiplier = 1.0
    else:
        current_multiplier = 1.0 + (elapsed ** 1.2) / 10
    
    current_multiplier = round(current_multiplier, 2)
    
    if current_multiplier >= round_data['crash_multiplier']:
        GameRound.update_status(round_data['id'], 'crashed', round_data['crash_multiplier'])
        last_round = GameRound.get_last_round_number()
        crash_point = crash_generator.generate_crash_point()
        GameRound.create(last_round + 1, crash_point)
        return True, None
    
    return False, current_multiplier

# ============ API ROUTES ============

@router.get("/health")
async def health_check():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return {
            "status": "OK",
            "timestamp": datetime.now().isoformat(),
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "timestamp": datetime.now().isoformat(),
            "database": "disconnected",
            "error": str(e)
        }

@router.get("/game/current_round")
async def get_current_round_state():
    round_data = get_current_round()
    crashed, current_multiplier = check_and_update_round(round_data)
    
    if crashed:
        round_data = get_current_round()
        current_multiplier = 1.0
    
    return {
        "round_id": round_data['id'],
        "round_number": round_data['round_number'],
        "current_multiplier": current_multiplier or 1.0,
        "crash_multiplier": round_data['crash_multiplier'],
        "status": round_data['status'],
        "start_time": round_data['start_time'].isoformat()
    }

@router.post("/game/bet")
async def place_bet(bet: BetRequest):
    if bet.bet_amount <= 0:
        raise HTTPException(status_code=400, detail="Bet amount must be greater than 0")
    
    user = User.get_or_create(bet.user_id)
    
    if bet.bet_amount > user['balance']:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    round_data = get_current_round()
    User.update_balance(bet.user_id, bet.bet_amount, 'subtract')
    bet_id = UserBet.create(round_data['id'], bet.user_id, bet.bet_amount)
    
    return {
        "success": True,
        "bet_id": bet_id,
        "round_id": round_data['id'],
        "round_number": round_data['round_number'],
        "bet_amount": bet.bet_amount,
        "message": f"Bet placed! Round #{round_data['round_number']}"
    }

@router.post("/game/cashout")
async def cashout(request: CashoutRequest):
    bet = UserBet.get_active_bet(request.user_id)
    
    if not bet:
        raise HTTPException(status_code=404, detail="No active bet found")
    
    round_data = get_current_round()
    start_time = round_data['start_time']
    elapsed = (datetime.now() - start_time).total_seconds()
    
    if elapsed < 0.1:
        current_multiplier = 1.0
    else:
        current_multiplier = 1.0 + (elapsed ** 1.2) / 10
    
    current_multiplier = round(current_multiplier, 2)
    
    if current_multiplier >= round_data['crash_multiplier']:
        UserBet.crash_bet(bet['id'])
        return {
            "success": False,
            "message": f"Round crashed at {round_data['crash_multiplier']}x! You lost your bet.",
            "crash_multiplier": round_data['crash_multiplier']
        }
    
    win_amount = bet['bet_amount'] * current_multiplier
    UserBet.cashout(bet['id'], current_multiplier, win_amount)
    User.update_balance(request.user_id, win_amount, 'add')
    User.update_stats(request.user_id, win_amount)
    
    return {
        "success": True,
        "cashed_out_at": current_multiplier,
        "bet_amount": bet['bet_amount'],
        "won_amount": win_amount,
        "round_number": round_data['round_number'],
        "message": f"You cashed out at {current_multiplier}x! Won: {win_amount:,.2f}"
    }

@router.get("/game/user/{user_id}")
async def get_user_stats(user_id: str):
    user = User.get_or_create(user_id)
    return user

@router.get("/game/history")
async def get_game_history(limit: int = 20):
    return GameRound.get_history(limit)

@router.get("/game/statistics")
async def get_statistics():
    return GameRound.get_statistics()