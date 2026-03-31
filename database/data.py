import mysql.connector
from mysql.connector import Error
import hashlib
import secrets
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

class Database:
    def __init__(self):
        self.connection = None
        self.connect()
        if self.connection:  # Only create tables if connection successful
            self.create_tables()
    
    # database/data.py
    def connect(self):
        try:
            self.connection = mysql.connector.connect(
                host='localhost',
                database='spaceman_game',
                user='root',
                password='Asdf1234_'
            )
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
    
    def create_tables(self):
        if not self.connection:
            print("No database connection, skipping table creation")
            return
            
        cursor = self.connection.cursor()
        
        # Create rounds table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rounds (
                id INT AUTO_INCREMENT PRIMARY KEY,
                round_id VARCHAR(50) NOT NULL UNIQUE,
                bar_hash VARCHAR(64) NOT NULL,
                multiplier DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                start_time DATETIME,
                end_time DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create bets table (optional for future)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                round_id VARCHAR(50) NOT NULL,
                user_address VARCHAR(100),
                bet_amount DECIMAL(10,2),
                cashout_multiplier DECIMAL(10,2),
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES rounds(round_id)
            )
        """)
        
        self.connection.commit()
        cursor.close()
        print("Database tables created/verified successfully!")
    
    def generate_round_id(self):
        return secrets.token_hex(8)
    
    def generate_bar_hash(self, round_id, multiplier):
        data = f"{round_id}{multiplier}{secrets.token_hex(4)}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def create_round(self, multiplier):
        if not self.connection:
            print("No database connection")
            return None
            
        cursor = self.connection.cursor()
        round_id = self.generate_round_id()
        bar_hash = self.generate_bar_hash(round_id, multiplier)
        
        query = """
            INSERT INTO rounds (round_id, bar_hash, multiplier, status)
            VALUES (%s, %s, %s, 'pending')
        """
        cursor.execute(query, (round_id, bar_hash, multiplier))
        self.connection.commit()
        
        cursor.close()
        return {'round_id': round_id, 'bar_hash': bar_hash, 'multiplier': multiplier}
    
    def start_round(self, round_id):
        if not self.connection:
            return
        cursor = self.connection.cursor()
        query = "UPDATE rounds SET status = 'active', start_time = NOW() WHERE round_id = %s"
        cursor.execute(query, (round_id,))
        self.connection.commit()
        cursor.close()
    
    def end_round(self, round_id):
        if not self.connection:
            return
        cursor = self.connection.cursor()
        query = "UPDATE rounds SET status = 'ended', end_time = NOW() WHERE round_id = %s"
        cursor.execute(query, (round_id,))
        self.connection.commit()
        cursor.close()
    
    def get_round_history(self, limit=50):
        if not self.connection:
            return []
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT round_id, multiplier, status, start_time, end_time 
            FROM rounds 
            ORDER BY id DESC 
            LIMIT %s
        """
        cursor.execute(query, (limit,))
        results = cursor.fetchall()
        cursor.close()
        return results
    
    def get_active_round(self):
        if not self.connection:
            return None
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT * FROM rounds WHERE status = 'active' ORDER BY id DESC LIMIT 1"
        cursor.execute(query)
        result = cursor.fetchone()
        cursor.close()
        return result
    
    def get_pending_round(self):
        if not self.connection:
            return None
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT * FROM rounds WHERE status = 'pending' ORDER BY id DESC LIMIT 1"
        cursor.execute(query)
        result = cursor.fetchone()
        cursor.close()
        return result
    
    def close(self):
        if self.connection:
            self.connection.close()