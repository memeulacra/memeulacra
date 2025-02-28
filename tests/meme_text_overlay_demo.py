#!/usr/bin/env python3
"""
Meme Text Overlay Demo Script

This script demonstrates text overlay on memes according to text box coordinates.
It uses the Distracted Boyfriend meme and allows for easy testing of different text
in each box by modifying the text variables below.
"""

from PIL import Image, ImageDraw, ImageFont
import requests
import json
import os
import sys
import argparse
from io import BytesIO
import logging

# Configure these text variables to test different text in each box
# Box 1: Boyfriend in the center of the frame
TEXT_BOX_1 = "Me"
# Box 2: Girl in the foreground that he is looking at
TEXT_BOX_2 = "New shiny technology"
# Box 3: His girlfriend who is being ignored by him
TEXT_BOX_3 = "Existing project I should be working on"

# This is a demo script to show how to use text box coordinates
# The actual implementation in api/ai/text_overlay.py doesn't use coordinates yet
# This script can serve as a reference for updating the TextOverlay class

# Adjustment factors for text positioning (can be tuned to match the meme editor)
# These values can be adjusted to fine-tune the text positioning
X_OFFSET_FACTOR = 0.0  # Horizontal offset as percentage of image width
Y_OFFSET_FACTOR = 0.0  # Vertical offset as percentage of image height
WIDTH_SCALE_FACTOR = 1.0  # Scale factor for box width
HEIGHT_SCALE_FACTOR = 1.0  # Scale factor for box height

# Minimum font size to use (prevents text from becoming too small)
MIN_FONT_SIZE = 20
# Maximum number of characters per line (for text wrapping)
MAX_CHARS_PER_LINE = 15
# Draw box boundaries for debugging
DRAW_BOXES = True
# Box outline color
BOX_COLOR = "blue"

# Meme image URL
MEME_URL = "https://memulacra.nyc3.digitaloceanspaces.com/memes/Distracted-Boyfriend.jpg"

# Text box coordinates from the database
TEXT_BOX_COORDINATES = [
    {"x": 42.11436170212762, "y": 3.9999999999999973, "id": 1, "label": "boyfriend, who is in the center of the frame", "width": 20, "height": 10},
    {"x": 27.68617021276596, "y": 57.80000000000002, "id": 2, "label": "girl in the foreground that he is looking at", "width": 20.132978723404285, "height": 27.799999999999972},
    {"x": 59.33510638297872, "y": 50.599999999999945, "id": 3, "label": "his girlfirned who is being ignored by him", "width": 15.545212765957427, "height": 25.199999999999953}
]

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MemeTextOverlayDemo:
    def __init__(self, image_url):
        """Initialize with a meme template image URL."""
        logger.info(f"Downloading image from: {image_url}")
        
        # Try with different timeout values
        timeouts = [(5, 10), (15, 30), (30, 60)]
        last_exception = None
        
        for timeout in timeouts:
            try:
                logger.info(f"Fetching image with timeout={timeout}")
                response = requests.get(image_url, timeout=timeout)
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
            logger.error(f"Failed to fetch image from {image_url} after trying all timeouts")
            if last_exception:
                raise ValueError(f"Failed to fetch image from {image_url}: {str(last_exception)}")
            else:
                raise ValueError(f"Failed to fetch image from {image_url}: Unknown error")
        
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

    def wrap_text(self, text, max_chars_per_line):
        """Wrap text to fit within a certain number of characters per line."""
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

    def calculate_optimal_font(self, text_lines, box_width, box_height, max_font=100):
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

    def render_outlined_text(self, text, position, box_size):
        """Render text with outline at the specified position."""
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

    def add_text_from_coordinates(self, text_boxes, coordinates, draw_boxes=False, box_color="blue"):
        """Add text to the image based on the provided coordinates.
        
        Args:
            text_boxes: List of text strings to place in each box
            coordinates: List of dictionaries with x, y, width, height values (as percentages)
            draw_boxes: Whether to draw box boundaries for debugging
            box_color: Color of the box boundaries
        """
        if len(text_boxes) != len(coordinates):
            raise ValueError(f"Number of text boxes ({len(text_boxes)}) doesn't match number of coordinates ({len(coordinates)})")
        
        for i, (text, coord) in enumerate(zip(text_boxes, coordinates)):
            # Apply adjustment factors to the coordinates
            x_percent = coord["x"] + (X_OFFSET_FACTOR * 100)  # Add horizontal offset
            y_percent = coord["y"] + (Y_OFFSET_FACTOR * 100)  # Add vertical offset
            width_percent = coord["width"] * WIDTH_SCALE_FACTOR  # Scale width
            height_percent = coord["height"] * HEIGHT_SCALE_FACTOR  # Scale height
            
            # Calculate position and size in pixels
            x_px = int((x_percent / 100) * self.width)
            y_px = int((y_percent / 100) * self.height)
            width_px = int((width_percent / 100) * self.width)
            height_px = int((height_percent / 100) * self.height)
            
            logger.info(f"Box {i+1}: Rendering '{text}' at position ({x_px}, {y_px}) with size ({width_px}, {height_px})")
            
            # Draw box boundaries if requested
            if draw_boxes:
                # Draw a rectangle around the box
                self.draw.rectangle(
                    [(x_px, y_px), (x_px + width_px, y_px + height_px)], 
                    outline=box_color, 
                    width=3
                )
                
                # Add box number for reference
                box_label = str(i + 1)
                label_font = ImageFont.truetype(self.font_path, 30) if self.font_path else ImageFont.load_default()
                label_bbox = self.draw.textbbox((0, 0), box_label, font=label_font)
                label_width = label_bbox[2] - label_bbox[0]
                label_height = label_bbox[3] - label_bbox[1]
                
                # Position the label in the center of the box
                center_x = x_px + (width_px // 2)
                center_y = y_px + (height_px // 2)
                label_x = center_x - (label_width // 2)
                label_y = center_y - (label_height // 2)
                
                # Draw the label with a contrasting color
                self.draw.text((label_x, label_y), box_label, fill=box_color, font=label_font)
            
            # Render the text at the top-left corner of the box
            self.render_outlined_text(text, (x_px, y_px), (width_px, height_px))

    def save(self, output_path):
        """Save the image with overlaid text."""
        # Ensure the output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            
        self.base_image.save(output_path)
        logger.info(f"Saved meme with text overlay to: {output_path}")

    def get_image(self):
        """Get the PIL Image object with overlaid text."""
        return self.base_image

def main():
    """Run the demo script."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Meme Text Overlay Demo')
    parser.add_argument('--x-offset', type=float, default=0.0,
                        help='Horizontal offset factor (default: 0.0)')
    parser.add_argument('--y-offset', type=float, default=0.0,
                        help='Vertical offset factor (default: 0.0)')
    parser.add_argument('--width-scale', type=float, default=1.0,
                        help='Width scale factor (default: 1.0)')
    parser.add_argument('--height-scale', type=float, default=1.0,
                        help='Height scale factor (default: 1.0)')
    parser.add_argument('--draw-boxes', action='store_true', default=True,
                        help='Draw box boundaries (default: True)')
    
    args = parser.parse_args()
    
    # Set adjustment factors from command line arguments
    x_offset = args.x_offset
    y_offset = args.y_offset
    width_scale = args.width_scale
    height_scale = args.height_scale
    draw_boxes = args.draw_boxes
    
    logger.info("Starting meme text overlay demo")
    logger.info(f"Using adjustment factors: X_OFFSET={x_offset}, Y_OFFSET={y_offset}, "
                f"WIDTH_SCALE={width_scale}, HEIGHT_SCALE={height_scale}")
    
    # Create the demo object
    demo = MemeTextOverlayDemo(MEME_URL)
    
    # Create adjusted coordinates
    adjusted_coordinates = []
    for coord in TEXT_BOX_COORDINATES:
        adjusted_coord = coord.copy()
        adjusted_coord["x"] = coord["x"] + (x_offset * 100)
        adjusted_coord["y"] = coord["y"] + (y_offset * 100)
        adjusted_coord["width"] = coord["width"] * width_scale
        adjusted_coord["height"] = coord["height"] * height_scale
        adjusted_coordinates.append(adjusted_coord)
    
    # Add text to the meme based on coordinates
    demo.add_text_from_coordinates(
        [TEXT_BOX_1, TEXT_BOX_2, TEXT_BOX_3],
        adjusted_coordinates,
        draw_boxes,
        BOX_COLOR
    )
    
    # Save the result
    output_path = f"tests/meme_text_overlay_output_x{x_offset}_y{y_offset}_w{width_scale}_h{height_scale}.jpg"
    demo.save(output_path)
    
    logger.info("Demo completed successfully")
    logger.info(f"Output image saved to: {output_path}")
    logger.info("You can modify the TEXT_BOX_1, TEXT_BOX_2, and TEXT_BOX_3 variables at the top of the script to test different text")
    logger.info("You can also adjust the positioning by using command line arguments:")
    logger.info("  --x-offset: Horizontal offset factor (default: 0.0)")
    logger.info("  --y-offset: Vertical offset factor (default: 0.0)")
    logger.info("  --width-scale: Width scale factor (default: 1.0)")
    logger.info("  --height-scale: Height scale factor (default: 1.0)")
    logger.info("  --draw-boxes: Draw box boundaries (default: True)")
    
    # Important note for implementation
    logger.info("\nIMPORTANT NOTE:")
    logger.info("This demo script shows how to use text box coordinates to position text on memes.")
    logger.info("However, the actual implementation in api/ai/text_overlay.py doesn't use these coordinates yet.")
    logger.info("The TextOverlay class in api/ai/text_overlay.py needs to be updated to use the coordinates.")
    logger.info("This script can serve as a reference for that update.")

if __name__ == "__main__":
    main()
