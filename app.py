from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime

app = Flask(__name__, 
            template_folder='.',  
            static_folder='.')
CORS(app)

# Konfigurasi Database
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Asdf1234_',
    'database': 'barackgift_db'
}

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route('/api/telegram_user', methods=['GET'])
def get_telegram_user():
    user_data = {
        'username': 'user_telegram',
        'first_name': 'User Telegram',
        'photo_url': 'https://via.placeholder.com/40'
    }
    return jsonify(user_data)

@app.route('/api/games', methods=['GET'])
def get_games():
    return jsonify({'message': 'Games content coming soon', 'data': []})

@app.route('/api/market', methods=['GET'])
def get_market():
    return jsonify({'message': 'Market content coming soon', 'data': []})

@app.route('/api/profile', methods=['GET'])
def get_profile():
    return jsonify({'message': 'Profile content coming soon', 'data': []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)