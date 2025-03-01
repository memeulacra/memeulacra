import os
import json
import logging
import anthropic
import io
import base64
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

class MemeGenerator:
    def __init__(self):
        """Initialize the MemeGenerator with Anthropic API client."""
        # Check API key
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.error("ANTHROPIC_API_KEY environment variable is not set")
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        
        # Initialize Anthropic client
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-5-haiku-20241022")
        logger.info(f"MemeGenerator initialized with model: {self.model}")

    async def create_meme_from_context(self, context: str) -> Dict[str, Any]:
        """
        Create a meme using Claude API based on user context.
        
        Args:
            context: User-provided context for meme generation
            
        Returns:
            Dictionary containing the image data, meme text, and concept
        """
        logger.info(f"Creating meme from context: {context[:100]}...")
        
        # Step 1: Generate meme concept and text
        meme_concept = await self._generate_meme_concept(context)
        
        # Step 2: Generate SVG based on the concept (without text)
        svg_data = await self._generate_svg(context, meme_concept)
        
        # Step 3: Generate a complete image with text directly from Claude
        image_data, image_format = await self._generate_image_with_text(context, meme_concept)
        
        return {
            "concept": meme_concept,
            "svg_data": svg_data,
            "image_data": image_data,
            "image_format": image_format
        }
    
    async def _generate_meme_concept(self, context: str) -> Dict[str, Any]:
        """
        Generate a meme concept based on the given context.
        
        Args:
            context: User-provided context
            
        Returns:
            Dictionary containing meme concept details
        """
        logger.info("Generating meme concept...")
        
        system_prompt = """You are an expert meme creator who excels at crafting witty, impactful memes.
Your task is to generate a meme concept based on the provided context.

Your output must be a JSON object with the following structure:
{
  "title": "Brief, catchy title for the meme",
  "text": {
    "top_text": "Text for the top of the meme (optional)",
    "bottom_text": "Text for the bottom of the meme (optional)",
    "additional_text": "Any additional text elements (optional)"
  },
  "style": {
    "background_color": "Suggested background color (hex code)",
    "text_color": "Suggested text color (hex code)",
    "font": "Suggested font family"
  },
  "description": "Brief description of the visual concept"
}

Make the meme humorous, relevant to the context, and visually simple enough to be represented as an SVG.
"""
        
        user_prompt = f"""Create a meme concept based on this context:

{context}

Return only the JSON object with no additional text."""
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                temperature=0.7,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            content = response.content[0].text
            
            # Parse the JSON response
            try:
                meme_concept = json.loads(content)
                logger.info(f"Successfully generated meme concept: {meme_concept['title']}")
                return meme_concept
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse meme concept JSON: {e}")
                logger.error(f"Raw content: {content}")
                # Return a basic concept as fallback
                return {
                    "title": "Error Meme",
                    "text": {
                        "top_text": "WHEN THE API",
                        "bottom_text": "DOESN'T RETURN VALID JSON"
                    },
                    "style": {
                        "background_color": "#f8f9fa",
                        "text_color": "#000000",
                        "font": "Impact"
                    },
                    "description": "A simple error meme with text on a plain background"
                }
                
        except Exception as e:
            logger.error(f"Error generating meme concept: {str(e)}")
            raise
    
    async def _generate_svg(self, context: str, meme_concept: Dict[str, Any]) -> str:
        """
        Generate a simple SVG background for the meme (without text).
        
        Args:
            context: Original user context
            meme_concept: Meme concept details
            
        Returns:
            SVG data as a string
        """
        logger.info("Generating SVG background for meme...")
        
        system_prompt = """You are an expert SVG creator specializing in meme backgrounds.
Your task is to create a simple SVG background for a meme based on the provided concept.

The SVG should:
1. Be complete and valid SVG code that can be directly used in a browser
2. Include all necessary SVG tags and attributes
3. Create a simple background that matches the meme concept
4. NOT include any text elements - text will be added separately
5. Have a width of 600px and height of 600px
6. Use simple shapes, gradients, or patterns that would work well as a meme background

Your response must contain ONLY the complete SVG code with no additional text or explanation.
"""
        
        user_prompt = f"""Create a simple SVG background for a meme based on this concept:

Original Context: {context}

Meme Concept:
{json.dumps(meme_concept, indent=2)}

IMPORTANT: Do NOT include any text elements in the SVG. The text will be added separately.
Return ONLY the complete SVG code with no additional text."""
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.3,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            content = response.content[0].text
            
            # Extract SVG code (in case there's any extra text)
            svg_start = content.find("<svg")
            svg_end = content.rfind("</svg>") + 6
            
            if svg_start >= 0 and svg_end > svg_start:
                svg_data = content[svg_start:svg_end]
                logger.info(f"Successfully generated SVG meme ({len(svg_data)} bytes)")
                return svg_data
            else:
                logger.error("Failed to extract SVG from response")
                logger.error(f"Raw content: {content}")
                # Return a basic SVG as fallback
                return """<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="600" height="600" fill="#f8f9fa"/>
                    <text x="300" y="250" font-family="Impact" font-size="40" text-anchor="middle" fill="#000000">WHEN THE API</text>
                    <text x="300" y="350" font-family="Impact" font-size="40" text-anchor="middle" fill="#000000">DOESN'T RETURN VALID SVG</text>
                </svg>"""
                
        except Exception as e:
            logger.error(f"Error generating SVG: {str(e)}")
            raise

    async def _generate_image_with_text(self, context: str, meme_concept: Dict[str, Any]) -> Tuple[bytes, str]:
        """
        Generate a complete meme image with text directly from Claude.
        
        Args:
            context: Original user context
            meme_concept: Meme concept details
            
        Returns:
            Tuple of (image_data_bytes, format_string)
        """
        logger.info("Generating complete meme image with text...")
        
        system_prompt = """You are an expert meme creator who excels at creating visual memes.
Your task is to create a complete meme image based on the provided concept.

The image should:
1. Be a PNG image encoded as base64
2. Have a resolution of 600x600 pixels
3. Include the text from the meme concept (top text and bottom text)
4. Use the CLASSIC MEME STYLE with:
   - LARGE, BOLD WHITE TEXT (not black or dark text)
   - THICK BLACK OUTLINE around the text for visibility
   - Text positioned at the TOP and BOTTOM of the image
   - ALL CAPS text for maximum impact
5. Use a visually interesting background that matches the concept:
   - Bright, high-contrast colors
   - Simple patterns or gradients
   - Or a solid color that provides good contrast with the white text

Your response must contain ONLY the complete base64-encoded PNG image with no additional text or explanation.
Do not include any markdown formatting, just the raw base64 string.
"""
        
        user_prompt = f"""Create a complete meme image based on this concept:

Original Context: {context}

Meme Concept:
{json.dumps(meme_concept, indent=2)}

IMPORTANT: Follow the classic meme style with:
- LARGE, BOLD WHITE TEXT (not black or dark text)
- THICK BLACK OUTLINE around the text
- Text at the TOP and BOTTOM of the image
- ALL CAPS text for maximum impact
- High contrast background

Return ONLY the base64-encoded PNG image with no additional text or explanation.
Do not include any markdown formatting or prefixes like "data:image/png;base64,".
"""
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,  # Increased for image data
                temperature=0.3,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            content = response.content[0].text.strip()
            
            # Clean up the base64 string (remove any markdown or prefixes)
            if "base64," in content:
                # Extract just the base64 part if there's a prefix
                content = content.split("base64,")[1]
            
            # Remove any non-base64 characters
            content = ''.join(c for c in content if c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=')
            
            try:
                # Decode base64 to binary
                image_data = base64.b64decode(content)
                logger.info(f"Successfully generated meme image ({len(image_data)} bytes)")
                
                # Verify it's a valid image by trying to open it
                Image.open(io.BytesIO(image_data))
                
                return image_data, "PNG"
            except Exception as e:
                logger.error(f"Error decoding base64 image: {e}")
                # Fall back to creating a simple image with PIL
                return self._create_fallback_image(meme_concept)
                
        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            return self._create_fallback_image(meme_concept)
    
    def _create_fallback_image(self, meme_concept: Dict[str, Any]) -> Tuple[bytes, str]:
        """Create a fallback image with PIL if Claude fails to generate one."""
        logger.info("Creating fallback image with PIL...")
        
        try:
            # Create a new image
            image = Image.new("RGB", (600, 600), color=meme_concept.get("style", {}).get("background_color", "#FFFFFF"))
            draw = ImageDraw.Draw(image)
            
            # Get text from meme concept
            top_text = meme_concept.get("text", {}).get("top_text", "")
            bottom_text = meme_concept.get("text", {}).get("bottom_text", "")
            
            # Use default font
            font = ImageFont.load_default()
            
            # Add top text
            if top_text:
                draw.text((300, 100), top_text, fill="#000000", anchor="mm", font=font)
            
            # Add bottom text
            if bottom_text:
                draw.text((300, 500), bottom_text, fill="#000000", anchor="mm", font=font)
            
            # Save image to bytes
            output = io.BytesIO()
            image.save(output, format="PNG")
            image_data = output.getvalue()
            
            logger.info(f"Successfully created fallback meme image ({len(image_data)} bytes)")
            return image_data, "PNG"
            
        except Exception as e:
            logger.error(f"Error creating fallback image: {e}")
            # Create an even simpler fallback
            image = Image.new("RGB", (600, 600), color="#FFFFFF")
            draw = ImageDraw.Draw(image)
            draw.text((50, 250), "Error creating meme image", fill="#000000")
            
            output = io.BytesIO()
            image.save(output, format="PNG")
            return output.getvalue(), "PNG"

async def create_meme(context: str) -> Dict[str, Any]:
    """
    Create a meme using Claude API based on user context.
    
    Args:
        context: User-provided context for meme generation
        
    Returns:
        Dictionary containing the image data, SVG data, and meme concept
    """
    generator = MemeGenerator()
    return await generator.create_meme_from_context(context)
