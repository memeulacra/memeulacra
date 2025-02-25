import asyncio
import asyncpg
import json
import os
import random
from typing import List, Dict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration - using localhost since we're running outside Docker
DB_CONFIG = {
    'host': 'localhost',  # Connect to Docker-exposed port
    'port': 5432,
    'user': 'memeuser',
    'password': 'memepass',
    'database': 'memedb'
}

async def create_demo_users(pool: asyncpg.Pool) -> List[str]:
    """Create 10 demo users and return their UUIDs"""
    user_ids = []
    async with pool.acquire() as conn:
        for i in range(1, 11):
            username = f"Demo User {i}"
            fake_address = f"0x{'9' * 38}{i:02d}"  # Creates addresses like 0x999999999999999999999999999999999999901
            user_id = await conn.fetchval(
                'INSERT INTO users (username, address) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET username = $1 RETURNING id::text',
                username,
                fake_address
            )
            user_ids.append(user_id)
    logger.info(f"Created/verified {len(user_ids)} demo users")
    return user_ids

async def get_template_id_map(pool: asyncpg.Pool) -> Dict[str, str]:
    """Create a mapping of template names to their IDs"""
    async with pool.acquire() as conn:
        rows = await conn.fetch('SELECT id, name FROM meme_templates')
        return {row['name']: row['id'].__str__() for row in rows}

async def process_meme_file(
    file_path: str,
    pool: asyncpg.Pool,
    template_id_map: Dict[str, str],
    user_ids: List[str]
) -> None:
    """Process a single meme JSON file"""
    try:
        # Extract template name from filename
        # Extract template name and try different formats
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        possible_names = [
            base_name,  # Original with hyphens
            base_name.replace('-', ' '),  # Spaces
            base_name.replace('-', ''),  # No spaces
            base_name.replace('-', '_'),  # Underscores
            base_name.replace('-', '-')   # Explicit hyphens
        ]
        
        template_id = None
        for name in possible_names:
            if name in template_id_map:
                template_id = template_id_map[name]
                break
        
        if not template_id:
            logger.error(f"No template ID found for {base_name} (tried formats: {possible_names})")
            return
        else:
            logger.info(f"Found template ID {template_id} for {base_name}")

        # Read and process the file
        with open(file_path, 'r') as f:
            memes = json.load(f)

        # Process each meme instance
        async with pool.acquire() as conn:
            for meme in memes:
                try:
                    # Map the boxes array to individual text columns
                    text_boxes = meme.get('boxes', [])
                    text_box_values = text_boxes + [None] * (7 - len(text_boxes))  # Pad with None up to 7 boxes

                    # Get thumbs up count from img-votes, defaulting to 0 if not present or invalid
                    try:
                        thumbs_up = int(meme['metadata']['img-votes'].replace(',', ''))
                    except (KeyError, ValueError, AttributeError):
                        thumbs_up = 0

                    # Insert the meme instance
                    await conn.execute('''
                        INSERT INTO memes (
                            context, template_id, 
                            text_box_1, text_box_2, text_box_3, text_box_4,
                            text_box_5, text_box_6, text_box_7,
                            meme_cdn_url, user_id, thumbs_up
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ''',
                    "unknown, originated from imgflip dataset",
                    template_id,
                    text_box_values[0] if len(text_box_values) > 0 else None,
                    text_box_values[1] if len(text_box_values) > 1 else None,
                    text_box_values[2] if len(text_box_values) > 2 else None,
                    text_box_values[3] if len(text_box_values) > 3 else None,
                    text_box_values[4] if len(text_box_values) > 4 else None,
                    text_box_values[5] if len(text_box_values) > 5 else None,
                    text_box_values[6] if len(text_box_values) > 6 else None,
                    meme['url'],
                    random.choice(user_ids),
                    thumbs_up
                    )
                except Exception as e:
                    logger.error(f"Error processing meme in {file_path}: {e}")
                    continue

        logger.info(f"Successfully processed {file_path}")
    except Exception as e:
        logger.error(f"Error processing file {file_path}: {e}")

async def main():
    """Main function to populate meme instances"""
    # Create connection pool
    pool = await asyncpg.create_pool(**DB_CONFIG, min_size=5, max_size=20)
    
    try:
        # Create demo users
        user_ids = await create_demo_users(pool)
        
        # Get template ID mapping
        template_id_map = await get_template_id_map(pool)
        
        # Get list of meme files
        meme_files = [
            os.path.join('imgflip_data/memes', f)
            for f in os.listdir('imgflip_data/memes')
            if f.endswith('.json')
        ]
        
        # Process all files concurrently
        await asyncio.gather(
            *[process_meme_file(f, pool, template_id_map, user_ids) for f in meme_files]
        )
        
        logger.info("Completed processing all meme files")
    finally:
        await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
