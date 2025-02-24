import json
import requests
import os
from typing import Dict, Any


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

    def repair_json(self, broken_json: str) -> str:
        """
        Repairs broken JSON using the Venice API.
        Returns the fixed JSON string.
        """
        # Prepare the prompt for Venice API
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": f"Fix this JSON to match the required schema exactly:\n\n{broken_json}"}
        ]
        
        # Venice API configuration
        url = "https://api.venice.ai/api/v1/chat/completions"
        payload = {
            "model": "llama-3.3-70b",
            "messages": messages,
            "venice_parameters": {
                "enable_web_search": 'off',
                "include_venice_system_prompt": False,
            },
            "temperature": 0.1,  # Lower temperature for more consistent output
            "max_tokens": 1000
        }
        headers = {
            "Authorization": f"Bearer {os.getenv('VENICE_API_TOKEN')}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            fixed_json = response.json()["choices"][0]["message"]["content"].strip()

            # Validate the response
            if self._is_valid_json(fixed_json):
                return fixed_json
            else:
                raise ValueError("Venice API returned invalid JSON")

        except Exception as e:
            raise ValueError(f"Failed to repair JSON: {str(e)}")
