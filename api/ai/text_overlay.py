from PIL import Image, ImageDraw, ImageFont
import os
import requests
from io import BytesIO

CDN_BASE_URL = "https://memulacra.nyc3.digitaloceanspaces.com"

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
        response = requests.get(full_url)
        response.raise_for_status()
        self.base_image = Image.open(BytesIO(response.content))
        self.draw = ImageDraw.Draw(self.base_image)
        self.width, self.height = self.base_image.size
        
        # Default to Impact font if available, otherwise use default system font
        self.font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
        if not os.path.exists(self.font_path):
            self.font_path = None

    def calculate_optimal_font(self, text: str, box_width: int, box_height: int, max_font: int = 100) -> tuple:
        """Calculate the optimal font size to fit text in a given box.
        
        Args:
            text: Text to render
            box_width: Maximum width of the text box
            box_height: Maximum height of the text box
            max_font: Maximum font size to try
            
        Returns:
            Tuple of (ImageFont, (text_width, text_height))
        """
        if self.font_path:
            for font_size in range(max_font, 8, -1):
                font = ImageFont.truetype(self.font_path, font_size)
                left, top, right, bottom = self.draw.textbbox((0, 0), text, font=font)
                text_width = right - left
                text_height = bottom - top
                if text_width <= box_width and text_height <= box_height:
                    return font, (text_width, text_height)
        
        # Fallback to default font if Impact not available or text too large
        return ImageFont.load_default(), (0, 0)

    def render_outlined_text(self, text: str, position: tuple, box_size: tuple) -> None:
        """Render text with outline at the specified position.
        
        Args:
            text: Text to render
            position: (x, y) coordinates for text box
            box_size: (width, height) of the text box
        """
        x, y = position
        box_w, box_h = box_size
        font, (t_w, t_h) = self.calculate_optimal_font(text, box_w, box_h)
        
        # Center text in specified box
        x_offset = x + (box_w - t_w) // 2
        y_offset = y + (box_h - t_h) // 2

        # Draw outline with 8-directional offsets
        outline_offsets = [(dx, dy) for dx in (-2,-1,0,1,2) for dy in (-2,-1,0,1,2)]
        for dx, dy in outline_offsets:
            self.draw.text((x_offset+dx, y_offset+dy), text, font=font, fill="black")

        # Draw primary text
        self.draw.text((x_offset, y_offset), text, font=font, fill="white")

    def add_meme_text(self, top_text: str, bottom_text: str) -> None:
        """Add classic meme-style text to the image (top and bottom text).
        
        Args:
            top_text: Text to display at the top
            bottom_text: Text to display at the bottom
        """
        # Calculate box sizes (80% width, 20% height for each text)
        text_width = int(self.width * 0.8)
        text_height = int(self.height * 0.2)
        
        # Position boxes with padding
        x = (self.width - text_width) // 2
        top_y = int(self.height * 0.05)  # 5% from top
        bottom_y = int(self.height * 0.75)  # 75% from top
        
        # Render both texts
        self.render_outlined_text(top_text, (x, top_y), (text_width, text_height))
        self.render_outlined_text(bottom_text, (x, bottom_y), (text_width, text_height))

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
