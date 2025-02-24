import os
import requests
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel
from dotenv import load_dotenv
from prompts import (
    GOAL_GEN_SYSTEM_PROMPT, 
    format_goal_gen_user_prompt,
    CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT,
    format_choose_meme_template_choice_user_prompt,
    GENERATE_MEME_TEXT_SYSTEM_PROMPT,
    format_generate_meme_text_user_prompt
)
from json_repairer import JsonRepairer

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

def generate_meme_goals(context: str):
    """Generate meme goals for the given context using Venice API"""
    VENICE_API_KEY = os.getenv("VENICE_API_TOKEN")
    if not VENICE_API_KEY:
        raise ValueError("VENICE_API_TOKEN environment variable is not set")

    URL = "https://api.venice.ai/api/v1/chat/completions"
    
    payload = {
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "system", "content": GOAL_GEN_SYSTEM_PROMPT},
            {"role": "user", "content": format_goal_gen_user_prompt(context)}
        ],
        "venice_parameters": {
            "enable_web_search": 'on',
            "include_venice_system_prompt": False,
        },
        "temperature": 0.7,
        "max_tokens": 700
    }
    
    headers = {
        "Authorization": f"Bearer {VENICE_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(URL, json=payload, headers=headers)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        
        # Try to parse the JSON directly first
        try:
            goals = json.loads(content)
            return goals
        except json.JSONDecodeError:
            # If parsing fails, use JsonRepairer
            logger.info("Initial JSON parsing failed, attempting repair...")
            repairer = JsonRepairer({"meme_goals": []})  # Simple schema
            fixed_json = repairer.repair_json(content)
            return json.loads(fixed_json)
            
    except Exception as e:
        logger.error(f"Error generating meme goals: {str(e)}")
        raise

# Initialize the model and tokenizer globally for reuse
model_name = "BAAI/bge-large-en-v1.5"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)
model.eval()  # Set the model to evaluation mode

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

def generate_meme_texts(template: dict, goal: dict, context: str) -> dict:
    """Generate text variations for a meme template based on the goal and examples"""
    VENICE_API_KEY = os.getenv("VENICE_API_TOKEN")
    if not VENICE_API_KEY:
        raise ValueError("VENICE_API_TOKEN environment variable is not set")

    # Get example memes for this template if available
    examples = None
    try:
        # Extract template ID from the template object
        template_id = None
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "localhost"),
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

    URL = "https://api.venice.ai/api/v1/chat/completions"
    
    payload = {
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "system", "content": GENERATE_MEME_TEXT_SYSTEM_PROMPT},
            {"role": "user", "content": format_generate_meme_text_user_prompt(template, goal, context, examples)}
        ],
        "venice_parameters": {
            "enable_web_search": 'on',
            "include_venice_system_prompt": False,
        },
        "temperature": 0.8,
        "max_tokens": 700
    }
    
    headers = {
        "Authorization": f"Bearer {VENICE_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(URL, json=payload, headers=headers)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        
        # Try to parse the JSON directly first
        try:
            text_choices = json.loads(content)
            return text_choices
        except json.JSONDecodeError:
            # If parsing fails, use JsonRepairer
            logger.info("Initial JSON parsing failed, attempting repair...")
            repairer = JsonRepairer({"text_choices": []})
            fixed_json = repairer.repair_json(content)
            return json.loads(fixed_json)
            
    except Exception as e:
        logger.error(f"Error generating meme texts: {str(e)}")
        raise

def find_similar_templates(goal: dict, top_k: int = 3) -> list:
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
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        register_vector(conn)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Perform cosine similarity search
            cur.execute("""
                SELECT 
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
            host=os.getenv("POSTGRES_HOST", "localhost"),
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

def generate_memes_for_uuids(context: str, uuids: List[str]) -> List[dict]:
    """
    Generate memes for a list of UUIDs using the given context.
    Returns a list of dicts containing UUID and text boxes.
    """
    try:
        # Connect to database
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        # Verify all UUIDs exist
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id FROM memes 
                WHERE id = ANY(%s)
            """, (uuids,))
            found_uuids = [str(r[0]) for r in cur.fetchall()]
            if len(found_uuids) != len(uuids):
                missing = set(uuids) - set(found_uuids)
                raise ValueError(f"UUIDs not found in database: {missing}")

        # Generate meme goals
        goals = generate_meme_goals(context)
        
        # Generate all possible memes
        generated_memes = []
        for goal in goals["meme_goals"]:
            templates = find_similar_templates(goal)
            
            for template in templates:
                text_variations = generate_meme_texts(template, goal, context)
                for choice in text_variations["text_choices"]:
                    # Convert text choice to array format
                    text_boxes = [None] * 7  # Initialize with 7 None values
                    for i in range(1, 8):
                        if f"text{i}" in choice:
                            text_boxes[i-1] = choice[f"text{i}"]
                    
                    generated_memes.append({
                        "template_id": template["id"],
                        "text_boxes": text_boxes
                    })
        
        # Match UUIDs with generated memes
        uuid_memes = []
        for i, uuid in enumerate(uuids):
            # Use modulo to cycle through generated memes if we have more UUIDs than memes
            meme = generated_memes[i % len(generated_memes)]
            uuid_memes.append({
                "uuid": uuid,
                "template_id": meme["template_id"],
                "text_boxes": meme["text_boxes"]
            })
            
        # Update database with generated memes
        with conn.cursor() as cur:
            for meme in uuid_memes:
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
                    WHERE id = %s
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
            "text_boxes": meme["text_boxes"]
        } for meme in uuid_memes]
        
    except Exception as e:
        logger.error(f"Failed to generate memes for UUIDs: {str(e)}")
        raise

if __name__ == "__main__":
    # Test the batch generation
    TEST_CONTEXT = "Insecure people criticize when youre doing things that they dont"
    TEST_UUIDS = ["test-uuid-1", "test-uuid-2"]  # Replace with real UUIDs for testing
    try:
        results = generate_memes_for_uuids(TEST_CONTEXT, TEST_UUIDS)
        print("\nGenerated Memes:")
        print(json.dumps(results, indent=2))
    except Exception as e:
        logger.error(f"Failed to process: {str(e)}")
