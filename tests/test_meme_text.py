#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

class MemeGenerator:
    def __init__(self, image_path):
        self.base_image = Image.open(image_path)
        self.draw = ImageDraw.Draw(self.base_image)
        self.width, self.height = self.base_image.size

    def calculate_optimal_font(self, text, box_width, box_height, max_font=100):
        font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
        for font_size in range(max_font, 8, -1):
            font = ImageFont.truetype(font_path, font_size)
            # Get the size of the text box
            left, top, right, bottom = self.draw.textbbox((0, 0), text, font=font)
            text_width = right - left
            text_height = bottom - top
            if text_width <= box_width and text_height <= box_height:
                return font, (text_width, text_height)
        return ImageFont.load_default(), (0, 0)

    def render_outlined_text(self, text, position, box_size):
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
        return self.base_image

    def save(self, output_path):
        self.base_image.save(output_path)

def main():
    # Initialize generator with the meme template
    image_path = "setup/imgflip_data/templates/img/Aaaaand-Its-Gone.jpg"
    generator = MemeGenerator(image_path)
    
    # Define text and positions
    top_text = "My UTXOs when fees are high"
    bottom_text = "...AND ITS GONE"
    
    # Calculate box sizes (using 80% of image width and 20% of height for each text)
    text_width = int(generator.width * 0.8)
    text_height = int(generator.height * 0.2)
    
    # Position boxes at top and bottom of image with some padding
    top_y = int(generator.height * 0.05)  # 5% from top
    bottom_y = int(generator.height * 0.75)  # 75% from top
    
    # Center horizontally
    x = (generator.width - text_width) // 2
    
    # Render both texts
    generator.render_outlined_text(top_text, (x, top_y), (text_width, text_height))
    generator.render_outlined_text(bottom_text, (x, bottom_y), (text_width, text_height))
    
    # Save the result
    output_path = "tests/meme_output.jpg"
    generator.save(output_path)
    print(f"Meme saved to {output_path}")

if __name__ == "__main__":
    main()
