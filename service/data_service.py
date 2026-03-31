from database.data import Database
import random
import time
import threading
from datetime import datetime

class GameService:
    def __init__(self):
        self.db = Database()
        self.current_round = None
        self.game_active = False
        self.multiplier_history = []
        
    def generate_multiplier(self):
        """Generate random multiplier with controlled probabilities"""
        rand = random.random()
        
        # 60% chance for low multipliers (1.00 - 2.00)
        if rand < 0.6:
            multiplier = round(random.uniform(1.00, 2.00), 2)
        # 25% chance for medium multipliers (2.00 - 5.00)
        elif rand < 0.85:
            multiplier = round(random.uniform(2.00, 5.00), 2)
        # 12% chance for high multipliers (5.00 - 10.00)
        elif rand < 0.97:
            multiplier = round(random.uniform(5.00, 10.00), 2)
        # 3% chance for ultra multipliers (10.00 - 100.00)
        else:
            multiplier = round(random.uniform(10.00, 100.00), 2)
        
        # Check for consecutive low multipliers (1.00 - 1.99)
        if len(self.multiplier_history) >= 5:
            last_five = self.multiplier_history[-5:]
            if all(1.00 <= m <= 1.99 for m in last_five):
                # Force multiplier above 2.00
                multiplier = round(random.uniform(2.00, 5.00), 2)
        
        self.multiplier_history.append(multiplier)
        if len(self.multiplier_history) > 50:
            self.multiplier_history.pop(0)
            
        return multiplier
    
    def create_new_round(self):
        """Create a new round with random multiplier"""
        multiplier = self.generate_multiplier()
        round_data = self.db.create_round(multiplier)
        return round_data
    
    def start_round(self, round_data):
        """Start a round"""
        self.current_round = round_data
        self.db.start_round(round_data['round_id'])
        self.game_active = True
        return round_data
    
    def end_current_round(self):
        """End current round"""
        if self.current_round:
            self.db.end_round(self.current_round['round_id'])
            self.game_active = False
            self.current_round = None
    
    def get_round_history(self):
        """Get round history"""
        return self.db.get_round_history()
    
    def get_current_round(self):
        """Get current active round"""
        if self.current_round:
            return self.current_round
        return self.db.get_active_round()
    
    def get_pending_round(self):
        """Get pending round"""
        return self.db.get_pending_round()