import os
import requests
import json
import logging
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

def choose_meme_templates(goal: dict):
    """Choose meme templates for a given goal using Venice API"""
    VENICE_API_KEY = os.getenv("VENICE_API_TOKEN")
    if not VENICE_API_KEY:
        raise ValueError("VENICE_API_TOKEN environment variable is not set")

    URL = "https://api.venice.ai/api/v1/chat/completions"
    
    payload = {
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "system", "content": CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT},
            {"role": "user", "content": format_choose_meme_template_choice_user_prompt(goal)}
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
            templates = json.loads(content)
            return templates
        except json.JSONDecodeError:
            # If parsing fails, use JsonRepairer
            logger.info("Initial JSON parsing failed, attempting repair...")
            repairer = JsonRepairer([])  # Simple schema for array
            fixed_json = repairer.repair_json(content)
            return json.loads(fixed_json)
            
    except Exception as e:
        logger.error(f"Error choosing meme templates: {str(e)}")
        raise

if __name__ == "__main__":
    TEST_CONTEXT = "Insecure people criticize when youre doing things that they dont"
    try:
        # Stage 1: Generate meme goals
        goals = generate_meme_goals(TEST_CONTEXT)
        print("\nGenerated Meme Goals:")
        print(json.dumps(goals, indent=2))
        
        # Stage 2: For each goal, get template suggestions
        print("\nChoosing Meme Templates for each goal:")
        for goal in goals["meme_goals"]:
            templates = choose_meme_templates(goal)
            print(f"\nTemplates for goal: {goal['goal']}")
            print(json.dumps(templates, indent=2))
            
    except Exception as e:
        logger.error(f"Failed to process: {str(e)}")
