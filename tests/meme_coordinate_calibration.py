#!/usr/bin/env python3
"""
Meme Coordinate Calibration Tool

This script helps calibrate and visualize text box coordinates between the meme editor
and the text overlay system. It creates a visualization that shows how coordinates
are interpreted in both systems, making it easier to ensure they match exactly.
"""

from PIL import Image, ImageDraw, ImageFont
import requests
import json
import os
import sys
import argparse
from io import BytesIO
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MemeCoordinateCalibrator:
    def __init__(self, image_url, output_dir="tests/meme_box_visualizations"):
        """Initialize with a meme template image URL."""
        self.output_dir = output_dir
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
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
        
        self.width, self.height = self.base_image.size
        logger.info(f"Image dimensions: {self.width}x{self.height}")
        
        # Default to Arial font if available, otherwise use default system font
        self.font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
        if not os.path.exists(self.font_path):
            # Try alternative paths for different operating systems
            alt_paths = [
                "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",  # Linux with msttcorefonts
                "C:\\Windows\\Fonts\\Arial.ttf",  # Windows
                # Add more paths as needed
            ]
            for path in alt_paths:
                if os.path.exists(path):
                    self.font_path = path
                    break
            else:
                logger.warning("Arial font not found, using default font")
                self.font_path = None

    def visualize_coordinates(self, coordinates, name_suffix=""):
        """
        Create visualizations of how coordinates are interpreted.
        
        Args:
            coordinates: List of dictionaries with x, y, width, height values (as percentages)
            name_suffix: Optional suffix for the output filename
        """
        # Create a copy of the base image for each visualization
        img_web = self.base_image.copy()
        img_pil = self.base_image.copy()
        
        # Create draw objects
        draw_web = ImageDraw.Draw(img_web)
        draw_pil = ImageDraw.Draw(img_pil)
        
        # Draw coordinates as interpreted in web (CSS) context
        self._draw_web_coordinates(draw_web, coordinates)
        
        # Draw coordinates as interpreted in PIL context
        self._draw_pil_coordinates(draw_pil, coordinates)
        
        # Save the visualizations
        base_filename = os.path.basename(name_suffix) if name_suffix else "coordinates"
        web_output_path = os.path.join(self.output_dir, f"{base_filename}_web.jpg")
        pil_output_path = os.path.join(self.output_dir, f"{base_filename}_pil.jpg")
        
        img_web.save(web_output_path)
        img_pil.save(pil_output_path)
        
        logger.info(f"Saved web visualization to: {web_output_path}")
        logger.info(f"Saved PIL visualization to: {pil_output_path}")
        
        # Create a side-by-side comparison
        self._create_comparison(img_web, img_pil, base_filename)
        
        return web_output_path, pil_output_path

    def _draw_web_coordinates(self, draw, coordinates):
        """
        Draw coordinates as they would be interpreted in a web (CSS) context.
        In CSS, the coordinates represent the top-left corner of the box.
        """
        font = ImageFont.truetype(self.font_path, 20) if self.font_path else ImageFont.load_default()
        
        for i, coord in enumerate(coordinates):
            # Convert percentage coordinates to pixel values
            x_percent = coord["x"]
            y_percent = coord["y"]
            width_percent = coord["width"]
            height_percent = coord["height"]
            
            x_px = int((x_percent / 100) * self.width)
            y_px = int((y_percent / 100) * self.height)
            width_px = int((width_percent / 100) * self.width)
            height_px = int((height_percent / 100) * self.height)
            
            # Draw the box
            draw.rectangle(
                [(x_px, y_px), (x_px + width_px, y_px + height_px)], 
                outline="blue", 
                width=3
            )
            
            # Add box number and coordinates
            box_label = f"{i+1}: ({x_percent:.1f}%, {y_percent:.1f}%, {width_percent:.1f}%, {height_percent:.1f}%)"
            draw.text((x_px + 5, y_px + 5), box_label, fill="blue", font=font)
        
        # Add title
        title = "Web (CSS) Interpretation - Top-Left Corner"
        draw.text((10, 10), title, fill="black", font=font)

    def _draw_pil_coordinates(self, draw, coordinates):
        """
        Draw coordinates as they would be interpreted in PIL.
        This visualization helps identify any differences in interpretation.
        """
        font = ImageFont.truetype(self.font_path, 20) if self.font_path else ImageFont.load_default()
        
        for i, coord in enumerate(coordinates):
            # Convert percentage coordinates to pixel values
            x_percent = coord["x"]
            y_percent = coord["y"]
            width_percent = coord["width"]
            height_percent = coord["height"]
            
            # Calculate position in pixels
            x_px = int((x_percent / 100) * self.width)
            y_px = int((y_percent / 100) * self.height)
            width_px = int((width_percent / 100) * self.width)
            height_px = int((height_percent / 100) * self.height)
            
            # Draw the box
            draw.rectangle(
                [(x_px, y_px), (x_px + width_px, y_px + height_px)], 
                outline="red", 
                width=3
            )
            
            # Add box number and coordinates
            box_label = f"{i+1}: ({x_percent:.1f}%, {y_percent:.1f}%, {width_percent:.1f}%, {height_percent:.1f}%)"
            draw.text((x_px + 5, y_px + 5), box_label, fill="red", font=font)
        
        # Add title
        title = "PIL Interpretation"
        draw.text((10, 10), title, fill="black", font=font)

    def _create_comparison(self, img_web, img_pil, base_filename):
        """Create a side-by-side comparison of the two visualizations."""
        # Create a new image with twice the width
        comparison = Image.new('RGB', (self.width * 2, self.height))
        
        # Paste the two images side by side
        comparison.paste(img_web, (0, 0))
        comparison.paste(img_pil, (self.width, 0))
        
        # Save the comparison
        comparison_path = os.path.join(self.output_dir, f"{base_filename}_comparison.jpg")
        comparison.save(comparison_path)
        
        logger.info(f"Saved comparison visualization to: {comparison_path}")
        return comparison_path

    def generate_coordinate_variations(self, base_coordinates, variations=3):
        """
        Generate variations of the coordinates to test different interpretations.
        This helps identify which interpretation matches the meme editor.
        
        Args:
            base_coordinates: The original coordinates
            variations: Number of variations to generate
            
        Returns:
            List of coordinate variations
        """
        variations_list = [base_coordinates]  # Start with the original
        
        # Variation 1: Interpret as center point instead of top-left
        center_coords = []
        for coord in base_coordinates:
            # Convert top-left to center point
            center_x = coord["x"] + (coord["width"] / 2)
            center_y = coord["y"] + (coord["height"] / 2)
            
            # Convert back to top-left with the new interpretation
            new_x = center_x - (coord["width"] / 2)
            new_y = center_y - (coord["height"] / 2)
            
            center_coords.append({
                "x": new_x,
                "y": new_y,
                "width": coord["width"],
                "height": coord["height"],
                "id": coord.get("id", 0),
                "label": coord.get("label", "")
            })
        variations_list.append(center_coords)
        
        # Variation 2: Scale coordinates by a factor
        scale_factor = 0.9  # 90% scale
        scaled_coords = []
        for coord in base_coordinates:
            scaled_coords.append({
                "x": coord["x"] * scale_factor,
                "y": coord["y"] * scale_factor,
                "width": coord["width"] * scale_factor,
                "height": coord["height"] * scale_factor,
                "id": coord.get("id", 0),
                "label": coord.get("label", "")
            })
        variations_list.append(scaled_coords)
        
        # Variation 3: Adjust for potential aspect ratio differences
        aspect_adjusted_coords = []
        for coord in base_coordinates:
            aspect_adjusted_coords.append({
                "x": coord["x"],
                "y": coord["y"] * (self.width / self.height),
                "width": coord["width"],
                "height": coord["height"] * (self.width / self.height),
                "id": coord.get("id", 0),
                "label": coord.get("label", "")
            })
        variations_list.append(aspect_adjusted_coords)
        
        return variations_list[:variations+1]  # Return requested number of variations

def main():
    """Run the coordinate calibration tool."""
    parser = argparse.ArgumentParser(description='Meme Coordinate Calibration Tool')
    parser.add_argument('--image-url', type=str, 
                        default="https://memulacra.nyc3.digitaloceanspaces.com/memes/Distracted-Boyfriend.jpg",
                        help='URL of the meme template image')
    parser.add_argument('--coordinates', type=str, 
                        default='[{"x": 42.11436170212762, "y": 3.9999999999999973, "id": 1, "label": "boyfriend, who is in the center of the frame", "width": 20, "height": 10}, {"x": 27.68617021276596, "y": 57.80000000000002, "id": 2, "label": "girl in the foreground that he is looking at", "width": 20.132978723404285, "height": 27.799999999999972}, {"x": 59.33510638297872, "y": 50.599999999999945, "id": 3, "label": "his girlfirned who is being ignored by him", "width": 15.545212765957427, "height": 25.199999999999953}]',
                        help='JSON string of coordinates')
    parser.add_argument('--output-dir', type=str, default="tests/meme_box_visualizations",
                        help='Directory to save visualizations')
    parser.add_argument('--variations', type=int, default=3,
                        help='Number of coordinate variations to generate')
    
    args = parser.parse_args()
    
    try:
        # Parse coordinates
        coordinates = json.loads(args.coordinates)
        
        # Create calibrator
        calibrator = MemeCoordinateCalibrator(args.image_url, args.output_dir)
        
        # Visualize the original coordinates
        calibrator.visualize_coordinates(coordinates, "original")
        
        # Generate and visualize variations
        variations = calibrator.generate_coordinate_variations(coordinates, args.variations)
        for i, variation in enumerate(variations[1:], 1):  # Skip the first one (original)
            calibrator.visualize_coordinates(variation, f"variation_{i}")
        
        logger.info(f"Generated {len(variations)} coordinate visualizations")
        logger.info(f"Visualizations saved to: {args.output_dir}")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
