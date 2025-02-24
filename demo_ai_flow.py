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

def generate_meme_texts(template: dict, goal: dict) -> dict:
    """Generate text variations for a meme template based on the goal"""
    VENICE_API_KEY = os.getenv("VENICE_API_TOKEN")
    if not VENICE_API_KEY:
        raise ValueError("VENICE_API_TOKEN environment variable is not set")

    URL = "https://api.venice.ai/api/v1/chat/completions"
    
    payload = {
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "system", "content": GENERATE_MEME_TEXT_SYSTEM_PROMPT},
            {"role": "user", "content": format_generate_meme_text_user_prompt(template, goal)}
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

if __name__ == "__main__":
    TEST_CONTEXT = "Insecure people criticize when youre doing things that they dont"
    try:
        # Stage 1: Generate meme goals
        goals = generate_meme_goals(TEST_CONTEXT)
        print("\nGenerated Meme Goals:")
        print(json.dumps(goals, indent=2))
        
        # Stage 2: For each goal, find similar templates and generate text
        print("\nFinding Similar Templates and Generating Text for each goal:")
        for goal in goals["meme_goals"]:
            print(f"\nGoal: {goal['goal']}")
            templates = find_similar_templates(goal)
            
            for template in templates:
                print(f"\n\tMeme template {template['name']} (sim {template['similarity']:.3f})")
                
                # Generate text variations for this template
                text_variations = generate_meme_texts(template, goal)
                for i, choice in enumerate(text_variations["text_choices"], 1):
                    if choice["box_count"] == 1:
                        print(f"\t\tText Choice {i}: {choice['text1']}")
                    else:
                        print(f"\t\tText Choice {i}: {choice['text1']} | {choice['text2']}")
            
    except Exception as e:
        logger.error(f"Failed to process: {str(e)}")
