from PIL import Image, ImageDraw, ImageFont
import os
import requests
import logging
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

# Get CDN base URL from environment variable with fallback
# Use the bucket name to construct the CDN base URL
bucket_name = os.getenv('DO_SPACES_BUCKET', 'memulacra')
CDN_BASE_URL = f"https://{bucket_name}.nyc3.digitaloceanspaces.com"

# Log the CDN base URL override
env_cdn_url = os.getenv('CDN_BASE_URL', 'https://memes.supertech.ai')
logger.info(f"TextOverlay: Overriding CDN base URL from {env_cdn_url} to {CDN_BASE_URL}")

# Constants for text rendering
MIN_FONT_SIZE = 20
MAX_CHARS_PER_LINE = 15

class TextOverlay:
    def __init__(self, image_url: str):
        """Initialize text overlay with a meme template image URL.
        
        Args:
            image_url: Relative URL path from database (e.g., 'memes/Aaaaand-Its-Gone.jpg')
        """
        # Ensure we don't have double slashes in the URL
        if image_url.startswith('/'):
            full_url = f"{CDN_BASE_URL}{image_url}"
        else:
            full_url = f"{CDN_BASE_URL}/{image_url}"
        
        # Add timeouts to prevent hanging
        logger.info(f"Attempting to fetch image from: {full_url}")
        
        # Try with different timeout values
        timeouts = [(5, 10), (15, 30), (30, 60)]
        last_exception = None
        
        for timeout in timeouts:
            try:
                logger.info(f"Fetching image with timeout={timeout}")
                response = requests.get(full_url, timeout=timeout)
                response.raise_for_status()
                self.base_image = Image.open(BytesIO(response.content))
                logger.info(f"Successfully fetched image with dimensions: {self.base_image.size}")
                break  # Exit the loop if successful
            except requests.exceptions.RequestException as e:
                logger.warning(f"Failed to fetch image with timeout={timeout}: {str(e)}")
                last_exception = e
                # Continue to the next timeout value
        else:
            # This block executes if the loop completes without a break
            logger.error(f"Failed to fetch image from {full_url} after trying all timeouts")
            if last_exception:
                raise ValueError(f"Failed to fetch image from {full_url}: {str(last_exception)}")
            else:
                raise ValueError(f"Failed to fetch image from {full_url}: Unknown error")
            
        self.draw = ImageDraw.Draw(self.base_image)
        self.width, self.height = self.base_image.size
        
        # Default to Impact font if available, otherwise use default system font
        self.font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
        if not os.path.exists(self.font_path):
            # Try alternative paths for different operating systems
            alt_paths = [
                "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",  # Linux with msttcorefonts
                "C:\\Windows\\Fonts\\Impact.ttf",  # Windows
                # Add more paths as needed
            ]
            for path in alt_paths:
                if os.path.exists(path):
                    self.font_path = path
                    break
            else:
                logger.warning("Impact font not found, using default font")
                self.font_path = None

    def wrap_text(self, text: str, max_chars_per_line: int) -> list:
        """Wrap text to fit within a certain number of characters per line.
        
        Args:
            text: Text to wrap
            max_chars_per_line: Maximum characters per line
            
        Returns:
            List of text lines
        """
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            # Check if adding this word would exceed the max chars per line
            if current_length + len(word) + len(current_line) <= max_chars_per_line:
                current_line.append(word)
                current_length += len(word)
            else:
                # Start a new line
                if current_line:  # Only add if there are words in the current line
                    lines.append(' '.join(current_line))
                current_line = [word]
                current_length = len(word)
        
        # Add the last line if it's not empty
        if current_line:
            lines.append(' '.join(current_line))
            
        return lines

    def calculate_optimal_font(self, text_lines: list, box_width: int, box_height: int, max_font: int = 100) -> tuple:
        """Calculate the optimal font size to fit text in a given box.
        
        Args:
            text_lines: List of text lines to render
            box_width: Maximum width of the text box
            box_height: Maximum height of the text box
            max_font: Maximum font size to try
            
        Returns:
            Tuple of (ImageFont, total_height)
        """
        if self.font_path:
            for font_size in range(max_font, MIN_FONT_SIZE - 1, -1):
                font = ImageFont.truetype(self.font_path, font_size)
                
                # Calculate total height and maximum width
                total_height = 0
                max_width = 0
                
                for line in text_lines:
                    left, top, right, bottom = self.draw.textbbox((0, 0), line, font=font)
                    line_width = right - left
                    line_height = bottom - top
                    total_height += line_height
                    max_width = max(max_width, line_width)
                
                # Add some spacing between lines (20% of line height)
                if len(text_lines) > 1:
                    total_height += (len(text_lines) - 1) * (line_height * 0.2)
                
                if max_width <= box_width and total_height <= box_height:
                    return font, total_height
        
        # If we get here, use the minimum font size
        font = ImageFont.truetype(self.font_path, MIN_FONT_SIZE) if self.font_path else ImageFont.load_default()
        return font, 0

    def render_outlined_text(self, text: str, position: tuple, box_size: tuple) -> None:
        """Render text with outline at the specified position.
        
        Args:
            text: Text to render
            position: (x, y) coordinates for text box
            box_size: (width, height) of the text box
        """
        x, y = position
        box_w, box_h = box_size
        
        # Wrap text if it's too long
        text_lines = self.wrap_text(text, MAX_CHARS_PER_LINE)
        
        # Calculate optimal font size for wrapped text
        font, total_height = self.calculate_optimal_font(text_lines, box_w, box_h)
        
        # Get the height of a single line with this font
        test_line = text_lines[0]
        left, top, right, bottom = self.draw.textbbox((0, 0), test_line, font=font)
        line_height = bottom - top
        
        # Calculate line spacing (20% of line height)
        line_spacing = line_height * 0.2
        
        # Calculate starting y position to center the text block vertically
        total_text_height = total_height + (len(text_lines) - 1) * line_spacing
        y_start = y + (box_h - total_text_height) // 2
        
        # Draw each line of text
        current_y = y_start
        for line in text_lines:
            # Get the width of this line
            left, top, right, bottom = self.draw.textbbox((0, 0), line, font=font)
            line_width = right - left
            
            # Center this line horizontally
            x_offset = x + (box_w - line_width) // 2
            
            # Draw outline with 8-directional offsets
            outline_offsets = [(dx, dy) for dx in (-2,-1,0,1,2) for dy in (-2,-1,0,1,2)]
            for dx, dy in outline_offsets:
                self.draw.text((x_offset+dx, current_y+dy), line, font=font, fill="black")
            
            # Draw primary text
            self.draw.text((x_offset, current_y), line, font=font, fill="white")
            
            # Move to the next line
            current_y += line_height + line_spacing

    def add_text_at_coordinates(self, texts: list, coordinates: list) -> None:
        """Add text at specific coordinates on the image.
        
        Args:
            texts: List of text strings to display
            coordinates: List of coordinate dictionaries, each containing:
                - x: X coordinate (percentage of image width, 0-100)
                - y: Y coordinate (percentage of image height, 0-100)
                - width: Width of text box (percentage of image width, 0-100)
                - height: Height of text box (percentage of image height, 0-100)
                
        Raises:
            ValueError: If coordinates are missing, invalid, or if there's a mismatch between
                       the number of texts and coordinates.
        """
        # Validate inputs
        if not coordinates:
            error_msg = "No text box coordinates provided"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        if not texts:
            error_msg = "No text provided for text boxes"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        if len(texts) != len(coordinates):
            error_msg = f"Mismatch between number of texts ({len(texts)}) and coordinates ({len(coordinates)})"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        # Process each text box
        for i, (text, coord) in enumerate(zip(texts, coordinates)):
            if not text:  # Skip empty text
                logger.info(f"Skipping empty text for box {i+1}")
                continue
                
            # Extract coordinates (convert from percentage to pixels)
            try:
                # Ensure all required coordinate properties exist
                if not all(key in coord for key in ['x', 'y', 'width', 'height']):
                    missing_keys = [key for key in ['x', 'y', 'width', 'height'] if key not in coord]
                    error_msg = f"Missing required coordinate properties for box {i+1}: {missing_keys}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                
                x_percent = float(coord['x'])
                y_percent = float(coord['y'])
                width_percent = float(coord['width'])
                height_percent = float(coord['height'])
                
                # Convert percentages to pixels
                x = int((x_percent / 100) * self.width)
                y = int((y_percent / 100) * self.height)
                width = int((width_percent / 100) * self.width)
                height = int((height_percent / 100) * self.height)
                
                logger.info(f"Rendering text at coordinates: x={x}, y={y}, width={width}, height={height}")
                self.render_outlined_text(text, (x, y), (width, height))
            except ValueError as e:
                error_msg = f"Invalid coordinate values for box {i+1}: {str(e)}"
                logger.error(error_msg)
                logger.error(f"Text: {text}, Coordinates: {coord}")
                raise ValueError(error_msg)
            except Exception as e:
                error_msg = f"Error rendering text at coordinates for box {i+1}: {str(e)}"
                logger.error(error_msg)
                logger.error(f"Text: {text}, Coordinates: {coord}")
                raise RuntimeError(error_msg)

    def save(self, output_path: str) -> None:
        """Save the image with overlaid text.
        
        Args:
            output_path: Path where to save the output image
        """
        # Ensure the output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            
        self.base_image.save(output_path)

    def get_image(self) -> Image:
        """Get the PIL Image object with overlaid text.
        
        Returns:
            PIL Image object
        """
        return self.base_image
