"""
Database Service - Connection Pool and Models
"""
import mysql.connector
from mysql.connector import pooling, Error
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
import logging
from .config_service import db_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ CONNECTION POOL ============
class DatabasePool:
    _instance = None
    _pool = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._pool is None:
            try:
                config = db_config.get_connection_config()
                self._pool = pooling.MySQLConnectionPool(**config)
                logger.info(f"✅ Database pool created: {db_config.DB_NAME}")
            except Error as e:
                logger.error(f"❌ Failed to create pool: {e}")
                raise
    
    def get_connection(self):
        try:
            return self._pool.get_connection()
        except Error as e:
            logger.error(f"❌ Failed to get connection: {e}")
            raise

db_pool = DatabasePool()

@contextmanager
def get_db_connection():
    """Context manager for database connection"""
    connection = None
    try:
        connection = db_pool.get_connection()
        yield connection
    except Error as e:
        if connection:
            connection.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if connection:
            connection.close()

@contextmanager
def get_db_cursor(connection, dictionary=True):
    """Context manager for database cursor"""
    cursor = None
    try:
        cursor = connection.cursor(dictionary=dictionary)
        yield cursor
    finally:
        if cursor:
            cursor.close()

def execute_query(query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = False):
    """Execute query and return results"""
    with get_db_connection() as connection:
        with get_db_cursor(connection) as cursor:
            cursor.execute(query, params or ())
            if fetch_one:
                return cursor.fetchone()
            elif fetch_all:
                return cursor.fetchall()
            connection.commit()
            return cursor.lastrowid

# ============ MODELS ============
class GameRound:
    """Game Round Model"""
    
    @staticmethod
    def create(round_number: int, crash_multiplier: float) -> int:
        query = """
            INSERT INTO game_rounds (round_number, crash_multiplier, start_time, status)
            VALUES (%s, %s, NOW(), 'running')
        """
        return execute_query(query, (round_number, crash_multiplier))
    
    @staticmethod
    def get_current() -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM game_rounds WHERE status = 'running' ORDER BY id DESC LIMIT 1"
        return execute_query(query, fetch_one=True)
    
    @staticmethod
    def get_by_id(round_id: int) -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM game_rounds WHERE id = %s"
        return execute_query(query, (round_id,), fetch_one=True)
    
    @staticmethod
    def update_status(round_id: int, status: str, crash_multiplier: float = None):
        if crash_multiplier:
            query = """
                UPDATE game_rounds SET status = %s, crash_multiplier = %s, end_time = NOW() 
                WHERE id = %s
            """
            execute_query(query, (status, crash_multiplier, round_id))
        else:
            query = "UPDATE game_rounds SET status = %s, end_time = NOW() WHERE id = %s"
            execute_query(query, (status, round_id))
    
    @staticmethod
    def get_last_round_number() -> int:
        query = "SELECT COALESCE(MAX(round_number), 0) as last_round FROM game_rounds"
        result = execute_query(query, fetch_one=True)
        return result['last_round'] if result else 0
    
    @staticmethod
    def get_history(limit: int = 20) -> List[Dict[str, Any]]:
        query = """
            SELECT id, round_number, crash_multiplier, start_time, end_time, status
            FROM game_rounds ORDER BY id DESC LIMIT %s
        """
        return execute_query(query, (limit,), fetch_all=True)
    
    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        with get_db_connection() as conn:
            with get_db_cursor(conn) as cursor:
                cursor.execute("SELECT COUNT(*) as total FROM game_rounds")
                total = cursor.fetchone()['total']
                
                cursor.execute("SELECT AVG(crash_multiplier) as avg FROM game_rounds")
                avg = cursor.fetchone()['avg']
                
                cursor.execute("SELECT COUNT(*) as count FROM game_rounds WHERE crash_multiplier < 1.15")
                low = cursor.fetchone()['count']
                
                cursor.execute("SELECT COUNT(*) as count FROM game_rounds WHERE crash_multiplier >= 5")
                high = cursor.fetchone()['count']
                
                return {
                    'total_rounds': total,
                    'avg_crash_point': round(avg, 2) if avg else 0,
                    'low_crash_count': low,
                    'high_crash_count': high
                }

class UserBet:
    """User Bet Model"""
    
    @staticmethod
    def create(round_id: int, user_id: str, bet_amount: float) -> int:
        query = """
            INSERT INTO user_bets (round_id, user_id, bet_amount, bet_time, status)
            VALUES (%s, %s, %s, NOW(), 'active')
        """
        return execute_query(query, (round_id, user_id, bet_amount))
    
    @staticmethod
    def get_active_bet(user_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM user_bets 
            WHERE user_id = %s AND status = 'active' 
            ORDER BY id DESC LIMIT 1
        """
        return execute_query(query, (user_id,), fetch_one=True)
    
    @staticmethod
    def cashout(bet_id: int, multiplier: float, win_amount: float):
        query = """
            UPDATE user_bets SET status = 'cashed_out', cashout_multiplier = %s, 
            win_amount = %s, cashout_time = NOW() WHERE id = %s
        """
        execute_query(query, (multiplier, win_amount, bet_id))
    
    @staticmethod
    def crash_bet(bet_id: int):
        query = "UPDATE user_bets SET status = 'crashed' WHERE id = %s"
        execute_query(query, (bet_id,))

class User:
    """User Model"""
    
    @staticmethod
    def get_or_create(user_id: str, initial_balance: float = 10000) -> Dict[str, Any]:
        with get_db_connection() as conn:
            with get_db_cursor(conn) as cursor:
                cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
                user = cursor.fetchone()
                
                if not user:
                    cursor.execute(
                        "INSERT INTO users (user_id, balance) VALUES (%s, %s)",
                        (user_id, initial_balance)
                    )
                    conn.commit()
                    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
                    user = cursor.fetchone()
                
                return user
    
    @staticmethod
    def update_balance(user_id: str, amount: float, operation: str = 'add'):
        if operation == 'add':
            query = "UPDATE users SET balance = balance + %s WHERE user_id = %s"
        else:
            query = "UPDATE users SET balance = balance - %s WHERE user_id = %s"
        execute_query(query, (amount, user_id))
    
    @staticmethod
    def update_stats(user_id: str, win_amount: float = 0):
        query = """
            UPDATE users SET total_bets = total_bets + 1, total_wins = total_wins + %s 
            WHERE user_id = %s
        """
        execute_query(query, (win_amount, user_id))