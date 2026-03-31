from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from service.data_service import GameService
import threading
import time
import random

app = Flask(__name__)
CORS(app)

game_service = GameService()
current_multiplier = 1.00
round_active = False
countdown_active = False
countdown_value = 0

def run_game_round():
    """Main game loop running in background thread"""
    global current_multiplier, round_active, countdown_active, countdown_value
    
    while True:
        # Create new round
        round_data = game_service.create_new_round()
        target_multiplier = round_data['multiplier']
        
        # Start round
        game_service.start_round(round_data)
        round_active = True
        current_multiplier = 1.00
        
        # Simulate rocket flight
        speed = 1.0
        while current_multiplier < target_multiplier and round_active:
            # Increase speed based on multiplier
            if current_multiplier < 2.0:
                speed = 1.0
            elif current_multiplier < 5.0:
                speed = 1.5
            elif current_multiplier < 10.0:
                speed = 2.0
            elif current_multiplier < 20.0:
                speed = 3.0
            elif current_multiplier < 50.0:
                speed = 5.0
            elif current_multiplier < 100.0:
                speed = 8.0
            else:
                speed = 10.0
            
            # Cap speed at 100
            if speed > 100:
                speed = 100
            
            current_multiplier += speed * 0.01
            current_multiplier = round(current_multiplier, 2)
            time.sleep(0.016)  # ~60 FPS
        
        # Round ends - rocket crashes
        round_active = False
        
        # End round in database
        game_service.end_current_round()
        
        # Countdown before next round
        countdown_active = True
        for i in range(10, 0, -1):
            countdown_value = i
            time.sleep(1)
        countdown_active = False
        countdown_value = 0

# Start game thread
game_thread = threading.Thread(target=run_game_round, daemon=True)
game_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/game/status')
def game_status():
    """Get current game status"""
    global current_multiplier, round_active, countdown_active, countdown_value
    
    return jsonify({
        'active': round_active,
        'multiplier': current_multiplier,
        'countdown_active': countdown_active,
        'countdown_value': countdown_value,
        'current_round': game_service.get_current_round()
    })

@app.route('/api/game/history')
def game_history():
    """Get round history"""
    history = game_service.get_round_history()
    return jsonify(history)

@app.route('/api/game/next-round', methods=['POST'])
def next_round():
    """Force next round (admin)"""
    # This would be protected in production
    return jsonify({'status': 'next round triggered'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500)