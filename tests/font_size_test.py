#!/usr/bin/env python3
"""
Font Size Test Script

This script tests the font size calculation in the TextOverlay class
with different text lengths and box sizes.
"""

import os
import sys
import argparse
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from api/ai
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from api.ai.text_overlay import TextOverlay

# Load environment variables
load_dotenv()

def create_blank_image(width=1000, height=1000, color=(255, 255, 255)):
    """Create a blank image with the specified dimensions and color"""
    return Image.new('RGB', (width, height), color)

def main():
    """Run the font size test"""
    parser = argparse.ArgumentParser(description='Font Size Test')
    parser.add_argument('--output', type=str, default='font_size_test_output.jpg',
                        help='Output image path (default: font_size_test_output.jpg)')
    args = parser.parse_args()
    
    print("Creating blank image for font size testing")
    
    # Create a blank image
    img = create_blank_image(1000, 1000)
    draw = ImageDraw.Draw(img)
    
    # Create a TextOverlay instance with the blank image
    # We'll monkey patch the TextOverlay class to use our blank image
    overlay = TextOverlay.__new__(TextOverlay)
    overlay.base_image = img
    overlay.draw = draw
    overlay.width, overlay.height = img.size
    overlay.debug_boxes = True
    
    # Try to find the Impact font
    overlay.font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
    if not os.path.exists(overlay.font_path):
        # Try alternative paths for different operating systems
        alt_paths = [
            "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",  # Linux with msttcorefonts
            "C:\\Windows\\Fonts\\Impact.ttf",  # Windows
        ]
        for path in alt_paths:
            if os.path.exists(path):
                overlay.font_path = path
                break
        else:
            print("Warning: Impact font not found, using default font")
            overlay.font_path = None
    
    # Test different text lengths and box sizes
    test_cases = [
        {
            "name": "Short text, large box",
            "text": "Short text",
            "box": (50, 50, 400, 200)
        },
        {
            "name": "Medium text, medium box",
            "text": "This is a medium length text that should fit in a medium sized box",
            "box": (50, 300, 400, 150)
        },
        {
            "name": "Long text, small box",
            "text": "This is a very long text that should be wrapped and sized to fit in a small box. It contains multiple sentences to ensure that we have enough text to test the wrapping and font size calculation logic.",
            "box": (50, 500, 400, 100)
        },
        {
            "name": "Very long text, very small box",
            "text": "This is an extremely long text that should be wrapped and sized to fit in a very small box. It contains multiple sentences and paragraphs to ensure that we have enough text to test the wrapping and font size calculation logic. The font size should be reduced significantly to fit all this text in the small box.",
            "box": (50, 650, 400, 80)
        },
        {
            "name": "Short text, very small box",
            "text": "Tiny box",
            "box": (50, 780, 100, 40)
        },
        {
            "name": "Wide box test",
            "text": "This text should be in a wide box with a larger font size",
            "box": (500, 50, 450, 100)
        },
        {
            "name": "Tall box test",
            "text": "This text should be in a tall box with a larger font size",
            "box": (500, 200, 200, 300)
        }
    ]
    
    # Draw a title
    title_font = ImageFont.truetype(overlay.font_path, 30) if overlay.font_path else ImageFont.load_default()
    draw.text((20, 10), "Font Size Test", fill=(0, 0, 0), font=title_font)
    
    # Process each test case
    for i, test in enumerate(test_cases):
        print(f"Testing: {test['name']}")
        
        # Extract box coordinates
        x, y, width, height = test["box"]
        
        # Create coordinates dict
        coordinates = [{"x": x / 10, "y": y / 10, "width": width / 10, "height": height / 10}]
        
        # Add text with debug boxes
        overlay.add_text_at_coordinates([test["text"]], coordinates)
        
        # Draw test case name
        name_font = ImageFont.truetype(overlay.font_path, 16) if overlay.font_path else ImageFont.load_default()
        draw.text((x + width + 20, y + height // 2), test["name"], fill=(0, 0, 0), font=name_font)
    
    # Save the result
    img.save(args.output)
    print(f"Saved font size test to: {args.output}")
    print("The red boxes show the text box areas with their IDs")
    print("Check the image to see how different text lengths and box sizes affect the font size")

if __name__ == "__main__":
    main()
