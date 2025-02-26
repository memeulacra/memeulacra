import os
import requests
import json
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
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
import asyncio
import os
import requests
import json
import logging
import time
from typing import List
from contextlib import contextmanager
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

class TimingStats:
    """Utility class to track timing of operations in the pipeline"""
    def __init__(self):
        self.timings = {}
        self.start_times = {}
    
    def start(self, operation_name):
        """Start timing an operation"""
        self.start_times[operation_name] = time.time()
    
    def end(self, operation_name):
        """End timing an operation and record the duration"""
        if operation_name in self.start_times:
            duration = time.time() - self.start_times[operation_name]
            if operation_name not in self.timings:
                self.timings[operation_name] = []
            self.timings[operation_name].append(duration)
            logger.info(f"Operation '{operation_name}' took {duration:.2f} seconds")
            return duration
        return None
    
    def get_summary(self):
        """Get a summary of all timing statistics"""
        summary = {}
        for op, times in self.timings.items():
            summary[op] = {
                "count": len(times),
                "total": sum(times),
                "average": sum(times) / len(times),
                "min": min(times) if times else 0,
                "max": max(times) if times else 0
            }
        return summary
    
    def log_summary(self):
        """Log a summary of all timing statistics"""
        summary = self.get_summary()
        logger.info("=== Timing Summary ===")
        for op, stats in sorted(summary.items(), key=lambda x: x[1]["total"], reverse=True):
            logger.info(f"{op}: {stats['count']} calls, {stats['total']:.2f}s total, {stats['average']:.2f}s avg")

@contextmanager
def timed_operation(timing, operation_name):
    """Context manager for timing operations"""
    timing.start(operation_name)
    try:
        yield
    finally:
        timing.end(operation_name)

async def generate_meme_goals(context: str, timing: TimingStats = None):
    """Generate meme goals for the given context using Claude API"""
    logger.info(f"Starting generate_meme_goals with context length: {len(context)} chars")
    start_time = time.time()
    
    # Check API key
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY environment variable is not set")
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
    else:
        # Log key status without exposing the actual key
        key_preview = ANTHROPIC_API_KEY[:4] + "..." + ANTHROPIC_API_KEY[-4:] if len(ANTHROPIC_API_KEY) > 8 else "***"
        logger.info(f"Using Anthropic API key: {key_preview}")

    logger.info("Initializing Anthropic client")
    # Initialize Anthropic client
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, base_url=None)
    logger.info("Anthropic client initialized")
    
    try:
        # Use the RateLimiter to make the request
        if timing:
            timing.start("llm_goal_generation")
        
        logger.info("Preparing to make Anthropic API request for meme goals")
        logger.info(f"System prompt length: {len(GOAL_GEN_SYSTEM_PROMPT)} chars")
        user_prompt = format_goal_gen_user_prompt(context, num_goals=2)
        logger.info(f"User prompt length: {len(user_prompt)} chars")
        
        logger.info("Making Anthropic API request...")
        request_start_time = time.time()
        
        response = await RateLimiter.make_anthropic_request(
            logger=logger,
            client=client,
            system_prompt=GOAL_GEN_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=700,
            temperature=0.7
        )
        
        request_duration = time.time() - request_start_time
        logger.info(f"Anthropic API request completed in {request_duration:.2f} seconds")
        
        if not response:
            logger.error("Received empty response from Anthropic API")
            raise ValueError("Empty response from Anthropic API")
            
        if not hasattr(response, 'content') or not response.content:
            logger.error(f"Invalid response structure: {response}")
            raise ValueError("Invalid response structure from Anthropic API")
            
        content = response.content[0].text
        logger.info(f"Received response with content length: {len(content)} chars")
        
        # Try to parse the JSON directly first
        try:
            logger.info("Attempting to parse JSON response")
            goals = json.loads(content)
            logger.info(f"Successfully parsed JSON with {len(goals.get('meme_goals', []))} goals")
            if timing:
                timing.end("llm_goal_generation")
            
            total_duration = time.time() - start_time
            logger.info(f"generate_meme_goals completed in {total_duration:.2f} seconds")
            return goals
        except json.JSONDecodeError as json_err:
            # If parsing fails, use JsonRepairer
            logger.warning(f"Initial JSON parsing failed: {str(json_err)}")
            logger.info("Attempting JSON repair...")
            repairer = JsonRepairer({"meme_goals": []})  # Simple schema
            repair_start_time = time.time()
            fixed_json = await repairer.repair_json(content)
            repair_duration = time.time() - repair_start_time
            logger.info(f"JSON repair completed in {repair_duration:.2f} seconds")
            
            if timing:
                timing.end("llm_goal_generation")
                
            parsed_goals = json.loads(fixed_json)
            logger.info(f"Successfully parsed repaired JSON with {len(parsed_goals.get('meme_goals', []))} goals")
            
            total_duration = time.time() - start_time
            logger.info(f"generate_meme_goals completed in {total_duration:.2f} seconds")
            return parsed_goals
            
    except Exception as e:
        logger.error(f"Error generating meme goals: {str(e)}", exc_info=True)
        logger.error(f"Error type: {type(e).__name__}")
        if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
            logger.error(f"HTTP Status Code: {e.response.status_code}")
        
        total_duration = time.time() - start_time
        logger.error(f"generate_meme_goals failed after {total_duration:.2f} seconds")
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

def get_embedding(text: str, timing: TimingStats = None) -> list:
    """Generate embedding for text using BGE model"""
    if timing:
        timing.start("embedding_generation")
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
    result = np.array(embeddings[0].tolist())
    if timing:
        timing.end("embedding_generation")
    return result

async def get_template_examples(template_name: str, timing: TimingStats = None) -> dict:
    """Get example memes for a template by name"""
    examples = None
    try:
        # Extract template ID from the template object
        template_id = None
        if timing:
            timing.start("db_connect_examples")
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        if timing:
            timing.end("db_connect_examples")
            timing.start("db_query_examples")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get template ID by name
            cur.execute("""
                SELECT id 
                FROM meme_templates 
                WHERE name = %s
            """, (template_name,))
            result = cur.fetchone()
            if result:
                template_id = result['id']
                examples = get_template_meme_examples(template_id, timing)
        conn.close()
        if timing:
            timing.end("db_query_examples")
        return examples
    except Exception as e:
        logger.warning(f"Failed to get meme examples: {str(e)}")
        # Continue without examples if there's an error
        return None

async def generate_meme_texts(template: dict, goal: dict, context: str, timing: TimingStats = None) -> dict:
    """Generate text variations for a meme template based on the goal and examples"""
    logger.info(f"Starting generate_meme_texts for template: {template.get('name', 'unknown')}")
    start_time = time.time()
    
    # Check API key
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY environment variable is not set")
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
    else:
        # Log key status without exposing the actual key
        key_preview = ANTHROPIC_API_KEY[:4] + "..." + ANTHROPIC_API_KEY[-4:] if len(ANTHROPIC_API_KEY) > 8 else "***"
        logger.info(f"Using Anthropic API key: {key_preview}")

    # Get example memes for this template if available
    logger.info(f"Fetching examples for template: {template.get('name', 'unknown')}")
    examples = await get_template_examples(template['name'], timing)
    if examples:
        logger.info(f"Found {len(examples.get('most_liked', []))} liked and {len(examples.get('most_disliked', []))} disliked examples")
    else:
        logger.info("No examples found for this template")

    logger.info("Initializing Anthropic client for text generation")
    # Initialize Anthropic client
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, base_url=None)
    logger.info("Anthropic client initialized")
    
    try:
        # Use the RateLimiter to make the request
        if timing:
            timing.start("llm_text_generation")
        
        logger.info("Preparing to make Anthropic API request for meme text generation")
        logger.info(f"System prompt length: {len(GENERATE_MEME_TEXT_SYSTEM_PROMPT)} chars")
        user_prompt = format_generate_meme_text_user_prompt(template, goal, context, examples, num_variations=1)
        logger.info(f"User prompt length: {len(user_prompt)} chars")
        
        logger.info("Making Anthropic API request for text generation...")
        request_start_time = time.time()
        
        response = await RateLimiter.make_anthropic_request(
            logger=logger,
            client=client,
            system_prompt=GENERATE_MEME_TEXT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=700,
            temperature=0.8
        )
        
        request_duration = time.time() - request_start_time
        logger.info(f"Anthropic API request for text generation completed in {request_duration:.2f} seconds")
        
        if not response:
            logger.error("Received empty response from Anthropic API for text generation")
            raise ValueError("Empty response from Anthropic API")
            
        if not hasattr(response, 'content') or not response.content:
            logger.error(f"Invalid response structure for text generation: {response}")
            raise ValueError("Invalid response structure from Anthropic API")
            
        content = response.content[0].text
        logger.info(f"Received text generation response with content length: {len(content)} chars")
        
        # Try to parse the JSON directly first
        try:
            logger.info("Attempting to parse JSON response for text generation")
            text_choices = json.loads(content)
            logger.info(f"Successfully parsed JSON with {len(text_choices.get('text_choices', []))} text choices")
            if timing:
                timing.end("llm_text_generation")
            
            total_duration = time.time() - start_time
            logger.info(f"generate_meme_texts completed in {total_duration:.2f} seconds")
            return text_choices
        except json.JSONDecodeError as json_err:
            # If parsing fails, use JsonRepairer
            logger.warning(f"Initial JSON parsing failed for text generation: {str(json_err)}")
            logger.info("Attempting JSON repair for text generation...")
            repairer = JsonRepairer({"text_choices": []})
            repair_start_time = time.time()
            fixed_json = await repairer.repair_json(content)
            repair_duration = time.time() - repair_start_time
            logger.info(f"JSON repair for text generation completed in {repair_duration:.2f} seconds")
            
            if timing:
                timing.end("llm_text_generation")
                
            parsed_choices = json.loads(fixed_json)
            logger.info(f"Successfully parsed repaired JSON with {len(parsed_choices.get('text_choices', []))} text choices")
            
            total_duration = time.time() - start_time
            logger.info(f"generate_meme_texts completed in {total_duration:.2f} seconds")
            return parsed_choices
            
    except Exception as e:
        logger.error(f"Error generating meme texts: {str(e)}", exc_info=True)
        logger.error(f"Error type: {type(e).__name__}")
        if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
            logger.error(f"HTTP Status Code: {e.response.status_code}")
        
        total_duration = time.time() - start_time
        logger.error(f"generate_meme_texts failed after {total_duration:.2f} seconds")
        raise

async def batch_generate_texts(templates: list, goal: dict, context: str, timing: TimingStats = None) -> list:
    """Generate text variations for multiple templates in parallel"""
    # Create tasks for all templates
    text_generation_tasks = []
    for template in templates:
        task = generate_meme_texts(template, goal, context, timing)
        text_generation_tasks.append((template, task))
    
    # Run all text generation tasks concurrently
    results = await asyncio.gather(*(task for _, task in text_generation_tasks), return_exceptions=True)
    
    # Process results
    processed_results = []
    for (template, _), result in zip(text_generation_tasks, results):
        if isinstance(result, Exception):
            logger.error(f"Error generating text for template {template.get('name', 'unknown')}: {str(result)}")
            continue
        
        processed_results.append({
            "template": template,
            "text_variations": result
        })
    
    return processed_results

def find_similar_templates(goal: dict, top_k: int = 2, timing: TimingStats = None) -> list:
    """Find similar meme templates using vector similarity search"""
    try:
        # Get embedding for the goal
        goal_text = f"{goal['goal']} {goal.get('explanation', '')}"
        goal_embedding = get_embedding(goal_text, timing)
        
        # Connect to database and register vector type
        if timing:
            timing.start("db_connect_templates")
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        register_vector(conn)
        if timing:
            timing.end("db_connect_templates")
            timing.start("db_query_templates")
        
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
        if timing:
            timing.end("db_query_templates")
        return [dict(r) for r in results]
        
    except Exception as e:
        logger.error(f"Error finding similar templates: {str(e)}")
        raise

def get_template_meme_examples(template_id: int, timing: TimingStats = None) -> dict:
    """
    Get example memes for a template:
    - Top 4 memes with highest thumbs up count
    - Bottom 4 memes with highest thumbs down count
    Returns dict with 'most_liked' and 'most_disliked' lists.
    """
    try:
        if timing:
            timing.start("db_connect_meme_examples")
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        if timing:
            timing.end("db_connect_meme_examples")
            timing.start("db_query_meme_examples")
        
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
        if timing:
            timing.end("db_query_meme_examples")
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

async def process_meme_image(template_image_url: str, meme: dict, timing: TimingStats = None) -> str:
    """Process a single meme image - create text overlay and upload to S3"""
    try:
        # Initialize text overlay with template image
        logger.info(f"Creating text overlay for template image: {template_image_url}")
        if timing:
            timing.start(f"text_overlay_{meme['uuid']}")
        overlay = TextOverlay(template_image_url)
        
        # Add text to the image
        # For simplicity, we'll use the first two text boxes as top and bottom text
        top_text = meme["text_boxes"][0] or ""
        bottom_text = meme["text_boxes"][1] or ""
        logger.info(f"Adding text to meme: top='{top_text}', bottom='{bottom_text}'")
        overlay.add_meme_text(top_text, bottom_text)
        
        if timing:
            timing.end(f"text_overlay_{meme['uuid']}")
        
        # Upload to Digital Ocean Spaces using the UUID as filename
        logger.info(f"Uploading meme image for UUID {meme['uuid']}")
        if timing:
            timing.start(f"s3_upload_{meme['uuid']}")
        cdn_url = s3_uploader.upload_image(overlay.get_image(), meme["uuid"])
        if timing:
            timing.end(f"s3_upload_{meme['uuid']}")
        
        if cdn_url:
            logger.info(f"Created meme image and uploaded to {cdn_url}")
            return cdn_url
        else:
            logger.error(f"Failed to upload meme image for UUID {meme['uuid']}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating meme image: {str(e)}")
        logger.error(f"Template image URL: {template_image_url}")
        logger.error(f"Meme data: {meme}")
        return None

async def batch_process_images(uuid_memes: list, template_urls: dict, timing: TimingStats = None) -> list:
    """Process multiple meme images in parallel"""
    if timing:
        timing.start("image_generation_and_upload")
    
    # Create tasks for all memes
    image_tasks = []
    for meme in uuid_memes:
        template_image_url = template_urls.get(meme["template_id"])
        if not template_image_url:
            logger.error(f"Template {meme['template_id']} not found")
            continue
            
        task = process_meme_image(template_image_url, meme, timing)
        image_tasks.append((meme, task))
    
    # Run all image tasks concurrently
    results = await asyncio.gather(*(task for _, task in image_tasks), return_exceptions=True)
    
    # Process results
    for (meme, _), result in zip(image_tasks, results):
        if isinstance(result, Exception):
            logger.error(f"Error processing image for meme {meme['uuid']}: {str(result)}")
            meme["cdn_url"] = None
        else:
            meme["cdn_url"] = result
    
    if timing:
        timing.end("image_generation_and_upload")
    
    return uuid_memes

async def generate_memes_for_uuids(context: str, uuids: List[str]) -> List[dict]:
    """
    Generate memes for a list of UUIDs using the given context.
    Returns a list of dicts containing UUID, text boxes, and CDN URL.
    """
    # Initialize timing stats
    timing = TimingStats()
    timing.start("total_pipeline")

    try:
        # Connect to database
        timing.start("db_connect_initial")
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        timing.end("db_connect_initial")
        
        # Verify all UUIDs exist
        timing.start("db_verify_uuids")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id FROM memes 
                WHERE id = ANY(SELECT CAST(UNNEST(%s::text[]) AS UUID))
            """, (uuids,))
            found_uuids = [str(r[0]) for r in cur.fetchall()]
            if len(found_uuids) != len(uuids):
                missing = set(uuids) - set(found_uuids)
                raise ValueError(f"UUIDs not found in database: {missing}")
        timing.end("db_verify_uuids")

        # Generate meme goals
        goals = await generate_meme_goals(context, timing)
        logger.info(f"Generated meme goals: {json.dumps(goals, indent=2)}")
        
        if "meme_goals" not in goals:
            logger.error(f"No meme_goals in response: {goals}")
            raise ValueError("No meme goals were generated")
        
        # Generate all possible memes
        generated_memes = []
        for goal in goals["meme_goals"]:
            templates = find_similar_templates(goal, timing=timing)
            logger.info(f"Found similar templates for goal '{goal.get('goal', '')}': {json.dumps(templates, indent=2)}")
            
            # Generate text for all templates in parallel
            template_results = await batch_generate_texts(templates, goal, context, timing)
            
            for result in template_results:
                template = result["template"]
                text_variations = result["text_variations"]
                
                logger.info(f"Generated text variations for template {template.get('name', 'unknown')}: {json.dumps(text_variations, indent=2)}")
                
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
        
        # Get all template image URLs in a single query
        template_urls = {}
        template_ids = list(set(meme["template_id"] for meme in uuid_memes))
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            placeholders = ", ".join(["%s"] * len(template_ids))
            cur.execute(f"""
                SELECT id, image_url 
                FROM meme_templates 
                WHERE id IN ({placeholders})
            """, template_ids)
            
            for row in cur.fetchall():
                template_urls[row["id"]] = row["image_url"]
        
        # Process all meme images in parallel
        uuid_memes = await batch_process_images(uuid_memes, template_urls, timing)
        
        # Update database with generated memes and CDN URLs
        timing.start("db_update_memes")
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
        timing.end("db_update_memes")
        
        # Log timing summary
        timing.end("total_pipeline")
        timing.log_summary()
        
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
