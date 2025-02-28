#!/usr/bin/env python3
"""
Debug Text Boxes Demo Script

This script demonstrates how to use the debug_boxes feature in the TextOverlay class
to visualize text box areas on meme templates.
"""

import os
import sys
import argparse
from PIL import Image
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from api/ai
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from api.ai.text_overlay import TextOverlay

# Load environment variables
load_dotenv()

def main():
    """Run the debug text boxes demo"""
    parser = argparse.ArgumentParser(description='Debug Text Boxes Demo')
    parser.add_argument('--image_url', type=str, default='/memes/Distracted-Boyfriend.jpg',
                        help='Image URL path (default: /memes/Distracted-Boyfriend.jpg)')
    parser.add_argument('--output', type=str, default='debug_text_boxes_output.jpg',
                        help='Output image path (default: debug_text_boxes_output.jpg)')
    args = parser.parse_args()
    
    print(f"Creating TextOverlay with debug_boxes=True for image: {args.image_url}")
    
    # Create TextOverlay with debug_boxes enabled
    overlay = TextOverlay(args.image_url, debug_boxes=True)
    
    # Define some sample text and coordinates
    texts = [
        "This is box 1",
        "This is box 2",
        "This is box 3"
    ]
    
    coordinates = [
        {"x": 10, "y": 10, "width": 30, "height": 20},
        {"x": 50, "y": 40, "width": 40, "height": 15},
        {"x": 20, "y": 70, "width": 60, "height": 25}
    ]
    
    # Add text with debug boxes
    overlay.add_text_at_coordinates(texts, coordinates)
    
    # Save the result
    overlay.save(args.output)
    print(f"Saved debug text boxes demo to: {args.output}")
    print("The red boxes show the text box areas with their IDs")

if __name__ == "__main__":
    main()
