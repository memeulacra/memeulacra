#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os
import uuid
import sys
import logging

# Add the api directory to the Python path so we can import the S3Uploader
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from api.ai.s3_uploader import S3Uploader

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def test_upload_and_download():
    """Test uploading an image to Digital Ocean Spaces and then downloading it back"""
    # Generate a unique ID for the filename
    meme_uuid = str(uuid.uuid4())
    logger.info(f"Generated UUID: {meme_uuid}")
    
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
    
    # Save the result locally
    output_path = "tests/meme_output.jpg"
    generator.save(output_path)
    logger.info(f"Meme saved locally to {output_path}")
    
    # Upload to Digital Ocean Spaces
    cdn_url = None
    try:
        uploader = S3Uploader()
        cdn_url = uploader.upload_image(generator.base_image, meme_uuid)
        if cdn_url:
            logger.info(f"Meme uploaded to CDN: {cdn_url}")
        else:
            logger.error("Failed to upload meme to CDN")
            return
    except Exception as e:
        logger.error(f"Error uploading to CDN: {str(e)}")
        return
    
    # Now try to download the image back from Digital Ocean Spaces
    try:
        import requests
        from io import BytesIO
        
        logger.info(f"Attempting to download image from: {cdn_url}")
        
        # Try with different timeout values
        for timeout in [(5, 10), (15, 30), (30, 60)]:
            try:
                logger.info(f"Trying with timeout: {timeout}")
                response = requests.get(cdn_url, timeout=timeout)
                response.raise_for_status()
                
                # If we get here, the download was successful
                downloaded_image = Image.open(BytesIO(response.content))
                logger.info(f"Successfully downloaded image with dimensions: {downloaded_image.size}")
                
                # Save the downloaded image for comparison
                downloaded_path = "tests/meme_downloaded.jpg"
                downloaded_image.save(downloaded_path)
                logger.info(f"Downloaded image saved to: {downloaded_path}")
                
                # Success with this timeout
                logger.info(f"Download successful with timeout: {timeout}")
                break
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout occurred with timeout values: {timeout}")
                # Continue to the next timeout value
            except Exception as e:
                logger.error(f"Error downloading with timeout {timeout}: {str(e)}")
                # Continue to the next timeout value
    except Exception as e:
        logger.error(f"Error in download test: {str(e)}")

def test_download_meme_template():
    """Test downloading a meme template from Digital Ocean Spaces"""
    try:
        import requests
        from io import BytesIO
        
        # Try to download a meme template that's failing in the TextOverlay class
        template_url = "https://memulacra.nyc3.digitaloceanspaces.com/memes/Expanding-Brain.jpg"
        logger.info(f"Attempting to download template from: {template_url}")
        
        # Try with different timeout values
        for timeout in [(5, 10), (15, 30), (30, 60)]:
            try:
                logger.info(f"Trying with timeout: {timeout}")
                response = requests.get(template_url, timeout=timeout)
                response.raise_for_status()
                
                # If we get here, the download was successful
                downloaded_image = Image.open(BytesIO(response.content))
                logger.info(f"Successfully downloaded template with dimensions: {downloaded_image.size}")
                
                # Save the downloaded image
                downloaded_path = "tests/template_downloaded.jpg"
                downloaded_image.save(downloaded_path)
                logger.info(f"Downloaded template saved to: {downloaded_path}")
                
                # Success with this timeout
                logger.info(f"Template download successful with timeout: {timeout}")
                break
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout occurred with timeout values: {timeout}")
                # Continue to the next timeout value
            except Exception as e:
                logger.error(f"Error downloading template with timeout {timeout}: {str(e)}")
                # Continue to the next timeout value
    except Exception as e:
        logger.error(f"Error in template download test: {str(e)}")

def main():
    """Run the tests"""
    logger.info("Starting meme text test")
    test_upload_and_download()
    logger.info("Testing template download")
    test_download_meme_template()
    logger.info("Test completed")

if __name__ == "__main__":
    main()
