from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime

app = Flask(__name__, 
            template_folder='.',  # Menggunakan root folder sebagai template folder
            static_folder='.')     # Menggunakan root folder sebagai static folder
CORS(app)

# Konfigurasi Database (akan diisi nanti)
db_config = {
    'host': 'localhost',
    'user': 'root',  # ganti sesuai kebutuhan
    'password': 'Asdf1234_',  # ganti sesuai kebutuhan
    'database': 'barackgift_db'  # ganti sesuai kebutuhan
}

# Fungsi koneksi database
def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# Route utama
@app.route('/')
def index():
    return render_template('index.html')

# Route untuk file CSS
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

# Route untuk file JS
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

# Route untuk user auth Telegram (contoh)
@app.route('/api/telegram_user', methods=['GET'])
def get_telegram_user():
    # Contoh data user - nanti diintegrasikan dengan database
    user_data = {
        'username': 'user_telegram',
        'first_name': 'User Telegram',
        'photo_url': 'https://via.placeholder.com/40'
    }
    return jsonify(user_data)

# Route untuk Games (kosong)
@app.route('/api/games', methods=['GET'])
def get_games():
    return jsonify({'message': 'Games content coming soon', 'data': []})

# Route untuk Market (kosong)
@app.route('/api/market', methods=['GET'])
def get_market():
    return jsonify({'message': 'Market content coming soon', 'data': []})

# Route untuk Profile (kosong)
@app.route('/api/profile', methods=['GET'])
def get_profile():
    return jsonify({'message': 'Profile content coming soon', 'data': []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)