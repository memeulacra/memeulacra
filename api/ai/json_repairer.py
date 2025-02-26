import json
import requests
import os
import anthropic
from typing import Dict, Any
from ai.rate_limiter import RateLimiter
import logging

# Set up logging
logger = logging.getLogger(__name__)

class JsonRepairer:
    def __init__(self, json_schema: Dict[str, Any]):
        """Initialize with a JSON schema dictionary"""
        self.json_schema = json_schema
        self.system_prompt = f"""You are a senior, experienced JSON repair expert. Your task is to fix JSON that is nearly correct but may have minor formatting issues.
If for some reason the given text from the user isn't close to valid JSON, please format it into valid JSON, filling in anything that's needed.
You must output JSON that exactly matches this schema, with no additional commentary:

{json.dumps(json_schema, indent=2)}

Rules:
1. Only output the JSON object, nothing else
2. Ensure all quotes are double quotes, not single quotes
3. Remove any unescaped newlines from strings
4. Remove any trailing commas
5. Fix array formatting if broken
6. Preserve the original content/meaning
7. Only output valid JSON that matches the schema exactly"""

    def _is_valid_json(self, json_str: str) -> bool:
        """Validate if a string is valid JSON"""
        try:
            json.loads(json_str)
            return True
        except json.JSONDecodeError:
            return False

    async def repair_json(self, broken_json: str) -> str:
        """
        Repairs broken JSON using the Claude API.
        Returns the fixed JSON string.
        """
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
                system_prompt=self.system_prompt,
                user_prompt=f"Fix this JSON to match the required schema exactly:\n\n{broken_json}",
                max_tokens=1000,
                temperature=0.1  # Lower temperature for more consistent output
            )
            
            fixed_json = response.content[0].text.strip()

            # Validate the response
            if self._is_valid_json(fixed_json):
                return fixed_json
            else:
                raise ValueError("Claude API returned invalid JSON")

        except Exception as e:
            raise ValueError(f"Failed to repair JSON: {str(e)}")
