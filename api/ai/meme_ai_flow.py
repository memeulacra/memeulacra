import os
import requests
import json
import logging
import time
from typing import List
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
import numpy as np
import torch
from ai.text_overlay import TextOverlay
from ai.s3_uploader import S3Uploader
from transformers import AutoTokenizer, AutoModel
from dotenv import load_dotenv
import anthropic
from ai.rate_limiter import RateLimiter
from ai.prompts import (
    GOAL_GEN_SYSTEM_PROMPT, 
    format_goal_gen_user_prompt,
    CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT,
    format_choose_meme_template_choice_user_prompt,
    GENERATE_MEME_TEXT_SYSTEM_PROMPT,
    format_generate_meme_text_user_prompt
)
from ai.json_repairer import JsonRepairer

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

async def generate_meme_goals(context: str):
    """Generate meme goals for the given context using Claude API"""
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    # Initialize Anthropic client
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, base_url=None)
    
    try:
        # Use the RateLimiter to make the request
        response = await RateLimiter.make_anthropic_request(
            logger=logger,
            client=client,
            system_prompt=GOAL_GEN_SYSTEM_PROMPT,
            user_prompt=format_goal_gen_user_prompt(context, num_goals=2),
            max_tokens=700,
            temperature=0.7
        )
        
        content = response.content[0].text
        
        # Try to parse the JSON directly first
        try:
            goals = json.loads(content)
            return goals
        except json.JSONDecodeError:
            # If parsing fails, use JsonRepairer
            logger.info("Initial JSON parsing failed, attempting repair...")
            repairer = JsonRepairer({"meme_goals": []})  # Simple schema
            fixed_json = await repairer.repair_json(content)
            return json.loads(fixed_json)
            
    except Exception as e:
        logger.error(f"Error generating meme goals: {str(e)}")
        raise

# Initialize the model and tokenizer globally for reuse
model_path = "/root/.cache/huggingface/hub/models--BAAI--bge-large-en-v1.5/snapshots/c43af0e0c0d29de68b4d14e2cc489aa098caf7f0"
logger.info(f"Loading model from {model_path}")

try:
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModel.from_pretrained(model_path)
    model.eval()  # Set the model to evaluation mode
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise

def get_embedding(text: str) -> list:
    """Generate embedding for text using BGE model"""
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
        
    # Convert to numpy array for pgvector
    return np.array(embeddings[0].tolist())

async def generate_meme_texts(template: dict, goal: dict, context: str) -> dict:
    """Generate text variations for a meme template based on the goal and examples"""
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    # Get example memes for this template if available
    examples = None
    try:
        # Extract template ID from the template object
        template_id = None
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get template ID by name
            cur.execute("""
                SELECT id 
                FROM meme_templates 
                WHERE name = %s
            """, (template['name'],))
            result = cur.fetchone()
            if result:
                template_id = result['id']
                examples = get_template_meme_examples(template_id)
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to get meme examples: {str(e)}")
        # Continue without examples if there's an error

    # Initialize Anthropic client
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, base_url=None)
    
    try:
        # Use the RateLimiter to make the request
        response = await RateLimiter.make_anthropic_request(
            logger=logger,
            client=client,
            system_prompt=GENERATE_MEME_TEXT_SYSTEM_PROMPT,
            user_prompt=format_generate_meme_text_user_prompt(template, goal, context, examples, num_variations=1),
            max_tokens=700,
            temperature=0.8
        )
        
        content = response.content[0].text
        
        # Try to parse the JSON directly first
        try:
            text_choices = json.loads(content)
            return text_choices
        except json.JSONDecodeError:
            # If parsing fails, use JsonRepairer
            logger.info("Initial JSON parsing failed, attempting repair...")
            repairer = JsonRepairer({"text_choices": []})
            fixed_json = await repairer.repair_json(content)
            return json.loads(fixed_json)
            
    except Exception as e:
        logger.error(f"Error generating meme texts: {str(e)}")
        raise

def find_similar_templates(goal: dict, top_k: int = 2) -> list:
    """Find similar meme templates using vector similarity search"""
    try:
        # Get embedding for the goal
        goal_text = f"{goal['goal']} {goal.get('explanation', '')}"
        goal_embedding = get_embedding(goal_text)
        
        # Connect to database and register vector type
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        register_vector(conn)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Perform cosine similarity search
            cur.execute("""
                SELECT 
                    id,
                    name,
                    description,
                    image_url,
                    text_box_count,
                    example_texts,
                    1 - (embedding <-> %s) as similarity
                FROM meme_templates
                WHERE embedding IS NOT NULL
                ORDER BY embedding <-> %s
                LIMIT %s
            """, (goal_embedding, goal_embedding, top_k))
            
            results = cur.fetchall()
            
        conn.close()
        return [dict(r) for r in results]
        
    except Exception as e:
        logger.error(f"Error finding similar templates: {str(e)}")
        raise

def get_template_meme_examples(template_id: int) -> dict:
    """
    Get example memes for a template:
    - Top 4 memes with highest thumbs up count
    - Bottom 4 memes with highest thumbs down count
    Returns dict with 'most_liked' and 'most_disliked' lists.
    """
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get top 4 most thumbs up memes
            cur.execute("""
                SELECT 
                    id,
                    context,
                    text_box_1,
                    text_box_2,
                    text_box_3,
                    text_box_4,
                    text_box_5,
                    meme_cdn_url,
                    thumbs_up,
                    thumbs_down
                FROM memes 
                WHERE template_id = %s
                ORDER BY thumbs_up DESC
                LIMIT 4
            """, (template_id,))
            most_liked = cur.fetchall()
            
            # Get top 4 most thumbs down memes
            cur.execute("""
                SELECT 
                    id,
                    context,
                    text_box_1,
                    text_box_2,
                    text_box_3,
                    text_box_4,
                    text_box_5,
                    meme_cdn_url,
                    thumbs_up,
                    thumbs_down
                FROM memes 
                WHERE template_id = %s
                ORDER BY thumbs_down DESC
                LIMIT 4
            """, (template_id,))
            most_disliked = cur.fetchall()
            
        conn.close()
        examples = {
            'most_liked': [dict(r) for r in most_liked],
            'most_disliked': [dict(r) for r in most_disliked]
        }
        print("\nTemplate Examples:")
        print(json.dumps(examples, indent=2))
        return examples
        
    except Exception as e:
        logger.error(f"Error getting template meme examples: {str(e)}")
        raise

# Initialize S3 uploader
s3_uploader = S3Uploader()

async def generate_memes_for_uuids(context: str, uuids: List[str]) -> List[dict]:
    """
    Generate memes for a list of UUIDs using the given context.
    Returns a list of dicts containing UUID, text boxes, and CDN URL.
    """

    try:
        # Connect to database
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        # Verify all UUIDs exist
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id FROM memes 
                WHERE id = ANY(SELECT CAST(UNNEST(%s::text[]) AS UUID))
            """, (uuids,))
            found_uuids = [str(r[0]) for r in cur.fetchall()]
            if len(found_uuids) != len(uuids):
                missing = set(uuids) - set(found_uuids)
                raise ValueError(f"UUIDs not found in database: {missing}")

        # Generate meme goals
        goals = await generate_meme_goals(context)
        logger.info(f"Generated meme goals: {json.dumps(goals, indent=2)}")
        
        if "meme_goals" not in goals:
            logger.error(f"No meme_goals in response: {goals}")
            raise ValueError("No meme goals were generated")
        
        # Generate all possible memes
        generated_memes = []
        for goal in goals["meme_goals"]:
            templates = find_similar_templates(goal)
            logger.info(f"Found similar templates for goal '{goal.get('goal', '')}': {json.dumps(templates, indent=2)}")
            
            for template in templates:
                text_variations = await generate_meme_texts(template, goal, context)
                logger.info(f"Generated text variations: {json.dumps(text_variations, indent=2)}")
                
                if "text_choices" not in text_variations:
                    logger.error(f"No text_choices in variations: {text_variations}")
                    continue
                    
                for choice in text_variations["text_choices"]:
                    # Convert text choice to array format
                    text_boxes = [None] * 7  # Initialize with 7 None values
                    for i in range(1, 8):
                        if f"text{i}" in choice:
                            text_boxes[i-1] = choice[f"text{i}"]
                    
                    try:
                        if "id" not in template:
                            logger.error(f"Template missing id field: {template}")
                            continue
                        generated_memes.append({
                            "template_id": template["id"],
                            "text_boxes": text_boxes
                        })
                    except Exception as e:
                        logger.error(f"Error processing template: {template}")
                        logger.error(f"Error details: {str(e)}")
                        continue
        
        # Check if we have any generated memes
        if not generated_memes:
            logger.error("No memes were generated. Templates or text generation may have failed.")
            raise ValueError("No memes were generated")

        # Match UUIDs with generated memes
        uuid_memes = []
        for i, uuid in enumerate(uuids):
            # Use modulo to cycle through generated memes if we have more UUIDs than memes
            meme = generated_memes[i % len(generated_memes)]
            logger.info(f"Matching UUID {uuid} with template_id {meme['template_id']}")
            uuid_memes.append({
                "uuid": uuid,
                "template_id": meme["template_id"],
                "text_boxes": meme["text_boxes"]
            })
        
        # Get template image URLs and create meme images
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for meme in uuid_memes:
                # Get template image URL
                cur.execute("""
                    SELECT image_url 
                    FROM meme_templates 
                    WHERE id = %s
                """, (meme["template_id"],))
                template = cur.fetchone()
                
                if not template:
                    logger.error(f"Template {meme['template_id']} not found")
                    continue
                
                # Create text overlay
                try:
                    # Initialize text overlay with template image
                    logger.info(f"Creating text overlay for template image: {template['image_url']}")
                    overlay = TextOverlay(template["image_url"])
                    
                    # Add text to the image
                    # For simplicity, we'll use the first two text boxes as top and bottom text
                    top_text = meme["text_boxes"][0] or ""
                    bottom_text = meme["text_boxes"][1] or ""
                    logger.info(f"Adding text to meme: top='{top_text}', bottom='{bottom_text}'")
                    overlay.add_meme_text(top_text, bottom_text)
                    
                    # Upload to Digital Ocean Spaces using the UUID as filename
                    logger.info(f"Uploading meme image for UUID {meme['uuid']}")
                    cdn_url = s3_uploader.upload_image(overlay.get_image(), meme["uuid"])
                    
                    if cdn_url:
                        # Update meme with CDN URL
                        meme["cdn_url"] = cdn_url
                        logger.info(f"Created meme image and uploaded to {cdn_url}")
                    else:
                        # If upload failed, set cdn_url to None and log error
                        meme["cdn_url"] = None
                        logger.error(f"Failed to upload meme image for UUID {meme['uuid']}")
                    
                except Exception as e:
                    logger.error(f"Error creating meme image: {str(e)}")
                    logger.error(f"Template: {template}")
                    logger.error(f"Meme data: {meme}")
                    meme["cdn_url"] = None
            
        # Update database with generated memes and CDN URLs
        with conn.cursor() as cur:
            for meme in uuid_memes:
                # Only update if we have a CDN URL (to avoid not-null constraint violation)
                if meme.get("cdn_url"):
                    cur.execute("""
                        UPDATE memes
                        SET 
                            template_id = %s,
                            text_box_1 = %s,
                            text_box_2 = %s,
                            text_box_3 = %s,
                            text_box_4 = %s,
                            text_box_5 = %s,
                            text_box_6 = %s,
                            text_box_7 = %s,
                            meme_cdn_url = %s
                        WHERE id = CAST(%s AS UUID)
                    """, (
                        meme["template_id"],
                        meme["text_boxes"][0],
                        meme["text_boxes"][1],
                        meme["text_boxes"][2],
                        meme["text_boxes"][3],
                        meme["text_boxes"][4],
                        meme["text_boxes"][5],
                        meme["text_boxes"][6],
                        meme["cdn_url"],
                        meme["uuid"]
                    ))
                else:
                    # If we don't have a CDN URL, just update the text boxes and template
                    cur.execute("""
                        UPDATE memes
                        SET 
                            template_id = %s,
                            text_box_1 = %s,
                            text_box_2 = %s,
                            text_box_3 = %s,
                            text_box_4 = %s,
                            text_box_5 = %s,
                            text_box_6 = %s,
                            text_box_7 = %s
                        WHERE id = CAST(%s AS UUID)
                    """, (
                        meme["template_id"],
                        meme["text_boxes"][0],
                        meme["text_boxes"][1],
                        meme["text_boxes"][2],
                        meme["text_boxes"][3],
                        meme["text_boxes"][4],
                        meme["text_boxes"][5],
                        meme["text_boxes"][6],
                        meme["uuid"]
                    ))
            conn.commit()
            
        conn.close()
        
        # Return results in specified format
        return [{
            "uuid": meme["uuid"],
            "text_boxes": meme["text_boxes"],
            "cdn_url": meme.get("cdn_url")
        } for meme in uuid_memes]
        
    except Exception as e:
        logger.error(f"Failed to generate memes for UUIDs: {str(e)}")
        raise

if __name__ == "__main__":
    import asyncio
    
    # Test configuration
    NUM_TEST_MEMES = 4  # Number of memes to generate in the test
    
    # Test the batch generation
    TEST_CONTEXT = "Insecure people criticize when youre doing things that they dont"
    TEST_UUIDS = [f"test-uuid-{i+1}" for i in range(NUM_TEST_MEMES)]  # Generate test UUIDs
    
    async def main():
        try:
            results = await generate_memes_for_uuids(TEST_CONTEXT, TEST_UUIDS)
            print("\nGenerated Memes:")
            print(json.dumps(results, indent=2))
        except Exception as e:
            logger.error(f"Failed to process: {str(e)}")
    
    # Run the async main function
    asyncio.run(main())
