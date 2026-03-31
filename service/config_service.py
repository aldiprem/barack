"""
Configuration Service - Database and App Settings
"""
import os
from dotenv import load_dotenv

# Load .env file dari root
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

class DatabaseConfig:
    """Database configuration"""
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "barack_crash")
    DB_PORT: int = int(os.getenv("DB_PORT", 3306))
    POOL_SIZE: int = int(os.getenv("POOL_SIZE", 10))
    
    def get_connection_config(self) -> dict:
        return {
            'host': self.DB_HOST,
            'user': self.DB_USER,
            'password': self.DB_PASSWORD,
            'database': self.DB_NAME,
            'port': self.DB_PORT,
            'pool_name': 'barack_pool',
            'pool_size': self.POOL_SIZE,
            'use_pure': True,
            'charset': 'utf8mb4'
        }

class AppSettings:
    """App configuration"""
    APP_NAME: str = "Rocket Crash Game API"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    API_PORT: int = int(os.getenv("API_PORT", 5500))
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    DEFAULT_BALANCE: float = float(os.getenv("DEFAULT_BALANCE", 10000))

# Instances
db_config = DatabaseConfig()
settings = AppSettings()