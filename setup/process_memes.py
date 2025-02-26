import asyncio
import os
import asyncpg
import base64
from anthropic import AsyncAnthropic
import logging
from dotenv import load_dotenv
import json
import torch
from transformers import AutoTokenizer, AutoModel

# Configure logging

# Initialize the model and tokenizer globally for reuse
model_name = "BAAI/bge-large-en-v1.5"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)
model.eval()  # Set the model to evaluation mode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'memeuser',
    'password': 'memepass',
    'database': 'memedb'
}

async def get_image_info(template_name):
    """Get image info from template JSON file"""
    template_path = f"imgflip_data/templates/{template_name}.json"
    try:
        with open(template_path, 'r') as f:
            data = json.load(f)
            return {
                'text_box_count': 2,  # Most memes have 2 text boxes by default
                'template_id': data.get('template_id', ''),
                'alternative_names': data.get('alternative_names', '')
            }
    except Exception as e:
        logger.error(f"Error reading template {template_name}: {e}")
        return None

async def get_image_description(client, image_path, logger):
    """Get image description from Claude"""
    try:
        with open(image_path, 'rb') as img_file:
            img_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        
        system_prompt = """You are an expert at describing meme templates. 
        Provide a detailed description of the meme image in 500-1000 characters. 
        Focus on the visual elements, expressions, composition, and cultural context of the meme.
        Do not include text overlays or captions in your description - focus on the base template image itself."""

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": img_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": "Please describe this meme template image in detail."
                    }
                ]
            }
        ]

        response = await client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            system=system_prompt,
            messages=messages
        )

        return response.content[0].text  # Access the text directly from the response
    except Exception as e:
        logger.error(f"Error getting image description: {e}")
        return None

async def generate_embedding(text: str) -> list[float]:
    """Generate embedding for a given text using BGE model"""
    # Tokenize the input text
    encoded_input = tokenizer(
        text, 
        padding=True, 
        truncation=True, 
        max_length=512,  # Limit token length
        return_tensors='pt'
    )
    
    # Generate embeddings
    with torch.no_grad():
        model_output = model(**encoded_input)
        # Get the embeddings from the last hidden state
        embeddings = model_output.last_hidden_state[:, 0, :]
        # Normalize the embeddings
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        
    # Convert to list for database storage
    return embeddings[0].tolist()

async def process_memes():
    """Main function to process memes and update database"""
    # Initialize Async Anthropic client
    client = AsyncAnthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
    
    # Connect to database
    conn = await asyncpg.connect(**DB_CONFIG)
    
    try:
        # Get list of template files
        template_files = [f for f in os.listdir('imgflip_data/templates') if f.endswith('.json')]
        
        for template_file in template_files:
            # Get template name without extension
            name = template_file[:-5]  # Remove .json
            
            # Get template info
            template_info = await get_image_info(name)
            if not template_info:
                logger.error(f"Could not get template info for {name}")
                continue
            
            # Get image path
            image_path = f"imgflip_data/templates/img/{name.replace(' ', '-')}.jpg"
            if not os.path.exists(image_path):
                logger.error(f"Image not found: {image_path}")
                continue
            
            # Get image description from Claude
            description = await get_image_description(client, image_path, logger)
            if not description:
                logger.error(f"Could not get description for {name}")
                continue
            
            # Parse tags from alternative names
            tags = [tag.strip() for tag in template_info['alternative_names'].split(',') if tag.strip()] if template_info['alternative_names'] else []
            
            # Generate embedding for the description
            embedding = await generate_embedding(description)
            
            # Insert into database
            try:
                # Convert embedding list to PostgreSQL vector literal
                vector_str = f"[{','.join(map(str, embedding))}]"
                
                await conn.execute('''
                    INSERT INTO meme_templates (
                        name, description, image_url, text_box_count,
                        tags, example_texts, popularity_score, embedding
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (name) DO UPDATE SET
                        description = EXCLUDED.description,
                        image_url = EXCLUDED.image_url,
                        text_box_count = EXCLUDED.text_box_count,
                        tags = EXCLUDED.tags,
                        example_texts = EXCLUDED.example_texts,
                        popularity_score = EXCLUDED.popularity_score,
                        embedding = EXCLUDED.embedding
                ''', name, description, f"/memes/{name.replace(' ', '-')}.jpg", 
                    template_info['text_box_count'], 
                    tags,
                    [],  # empty example_texts for now
                    0,  # default popularity_score
                    vector_str  # Pass as properly formatted vector string
                )
                
                logger.info(f"Successfully processed {name}")
            except Exception as e:
                logger.error(f"Database error for {name}: {e}")
                continue
            
            # Small delay between requests
            await asyncio.sleep(1)
    
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(process_memes())
