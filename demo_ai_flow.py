import os
import requests
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv
from prompts import (
    GOAL_GEN_SYSTEM_PROMPT, 
    format_goal_gen_user_prompt,
    CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT,
    format_choose_meme_template_choice_user_prompt
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

def get_embedding(text: str) -> list:
    """Get embedding for text using OpenAI's API"""
    client = OpenAI()
    response = client.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response.data[0].embedding

def find_similar_templates(goal: dict, top_k: int = 3) -> list:
    """Find similar meme templates using vector similarity search"""
    try:
        # Get embedding for the goal
        goal_text = f"{goal['goal']} {goal.get('explanation', '')}"
        goal_embedding = get_embedding(goal_text)
        
        # Connect to database
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Perform cosine similarity search
            cur.execute("""
                SELECT 
                    name,
                    description,
                    image_url,
                    text_box_count,
                    example_texts,
                    1 - (description_embedding <=> %s) as similarity
                FROM meme_templates
                WHERE description_embedding IS NOT NULL
                ORDER BY description_embedding <=> %s
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
        
        # Stage 2: For each goal, find similar templates using vector search
        print("\nFinding Similar Templates for each goal:")
        for goal in goals["meme_goals"]:
            templates = find_similar_templates(goal)
            print(f"\nTemplates for goal: {goal['goal']}")
            print(json.dumps(templates, indent=2))
            
    except Exception as e:
        logger.error(f"Failed to process: {str(e)}")
