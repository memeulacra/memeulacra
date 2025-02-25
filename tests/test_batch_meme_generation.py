#!/usr/bin/env python3
import json
import logging
import os
import sys
from typing import List
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file if present
load_dotenv()

# Database connection parameters - matching docker-compose.yml
DB_CONFIG = {
    "dbname": os.getenv("POSTGRES_DB", "memedb"),
    "user": os.getenv("POSTGRES_USER", "memeuser"),
    "password": os.getenv("POSTGRES_PASSWORD", "memepass"),
    "host": "localhost",  # Always localhost since we're running the test locally
    "port": "5432"
}

logger.info(f"Connecting to database at {DB_CONFIG['host']}:{DB_CONFIG['port']}")

API_BASE_URL = "http://localhost:8000"

def get_db_connection():
    """Create and return a database connection."""
    try:
        return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
    except psycopg2.Error as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

def check_database_prerequisites():
    """Check if database has required data."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check meme templates
            cur.execute("SELECT COUNT(*) as count FROM meme_templates")
            if cur.fetchone()['count'] == 0:
                logger.error("No meme templates found in database")
                sys.exit(1)
            logger.info("Found meme templates")

            # Check users
            cur.execute("SELECT COUNT(*) as count FROM users")
            if cur.fetchone()['count'] == 0:
                logger.error("No users found in database")
                sys.exit(1)
            logger.info("Found users")

def create_placeholder_memes() -> List[str]:
    """Create placeholder meme records and return their UUIDs."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                # Insert records and capture UUIDs
                cur.execute("""
                    WITH inserted_memes AS (
                        INSERT INTO memes (
                            context,
                            template_id,
                            meme_cdn_url,
                            user_id
                        )
                        SELECT 
                            'placeholder context',
                            (SELECT id FROM meme_templates LIMIT 1),
                            'https://placeholder-url.com/meme.jpg',
                            (SELECT id FROM users LIMIT 1)
                        FROM generate_series(1,10)
                        RETURNING id
                    )
                    SELECT json_agg(id::text) FROM inserted_memes;
                """)
                
                uuids = cur.fetchone()['json_agg']
                if not uuids:
                    raise ValueError("No UUIDs returned from insertion")
                
                conn.commit()
                logger.info(f"Created meme records with UUIDs: {uuids}")
                return uuids
            except (psycopg2.Error, ValueError) as e:
                conn.rollback()
                logger.error(f"Failed to create meme records: {e}")
                sys.exit(1)

def check_api_health():
    """Check if the API is running."""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        response.raise_for_status()
        logger.info("API health check passed")
    except requests.RequestException as e:
        logger.error(f"API is not running at {API_BASE_URL}: {e}")
        sys.exit(1)

def call_batch_generation_api(uuids: List[str]):
    """Call the batch generation API with the given UUIDs."""
    payload = {
        "context": "Testing batch meme generation with creative and humorous variations",
        "uuids": uuids
    }
    
    logger.info(f"Sending payload to API: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/generate-meme-batch",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        
        logger.info("API response:")
        logger.info(json.dumps(response.json(), indent=2))
        return response.json()
    except requests.RequestException as e:
        logger.error(f"API request failed: {e}")
        if hasattr(e.response, 'text'):
            logger.error(f"Response text: {e.response.text}")
        sys.exit(1)

def main():
    """Main test execution flow."""
    try:
        logger.info("Starting batch meme generation test")
        
        # Run prerequisite checks
        check_database_prerequisites()
        check_api_health()
        
        # Create test data and call API
        uuids = create_placeholder_memes()
        result = call_batch_generation_api(uuids)
        
        logger.info("Test completed successfully!")
        return 0
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
