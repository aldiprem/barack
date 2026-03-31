#!/usr/bin/env python3
import mysql.connector
import sys
import os

def main():
    print("=" * 50)
    print("🚀 SETUP DATABASE BARACK CRASH GAME")
    print("=" * 50)
    
    # Database config
    DB_HOST = "localhost"
    DB_USER = "root"
    DB_PASSWORD = ""
    DB_NAME = "barack_crash"
    
    try:
        # Connect without database
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        # Create database
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        cursor.execute(f"USE {DB_NAME}")
        print(f"✅ Database '{DB_NAME}' created/checked")
        
        # Create game_rounds table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_rounds (
                id INT AUTO_INCREMENT PRIMARY KEY,
                round_number INT NOT NULL,
                crash_multiplier DECIMAL(10,2) NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                status ENUM('running', 'crashed') DEFAULT 'running',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Table 'game_rounds' created")
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(100) UNIQUE NOT NULL,
                balance DECIMAL(10,2) DEFAULT 10000.00,
                total_bets INT DEFAULT 0,
                total_wins DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        print("✅ Table 'users' created")
        
        # Create user_bets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_bets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                round_id INT NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                bet_amount DECIMAL(10,2) NOT NULL,
                cashout_multiplier DECIMAL(10,2),
                win_amount DECIMAL(10,2),
                status ENUM('active', 'cashed_out', 'crashed') DEFAULT 'active',
                bet_time DATETIME NOT NULL,
                cashout_time DATETIME,
                FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE,
                INDEX idx_round_id (round_id),
                INDEX idx_user_id (user_id)
            )
        """)
        print("✅ Table 'user_bets' created")
        
        # Insert default user
        cursor.execute("SELECT COUNT(*) as count FROM users")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO users (user_id, balance) VALUES ('web_user', 10000.00)")
            print("✅ Default user 'web_user' created")
        
        # Insert initial round
        cursor.execute("SELECT COUNT(*) as count FROM game_rounds")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO game_rounds (round_number, crash_multiplier, start_time, status) 
                VALUES (1, 1.00, NOW(), 'running')
            """)
            print("✅ Initial round created")
        
        conn.commit()
        print("\n" + "=" * 50)
        print("✅ DATABASE SETUP COMPLETE!")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    main()