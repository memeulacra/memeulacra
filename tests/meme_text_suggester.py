#!/usr/bin/env python3
"""
Meme Text Box Suggester

This tool uses Anthropic's vision API to analyze meme templates,
suggest optimal text box placements, visualize them, and get user feedback.
"""

import os
import sys
import base64
import json
import re
import argparse
import requests
import shutil
from io import BytesIO
from PIL import Image
import anthropic
from dotenv import load_dotenv
from datetime import datetime

# Add the parent directory to the Python path so we can import from api
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
load_dotenv()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY environment variable is not set.")
    print("Please set it in your .env file or environment.")
    sys.exit(1)

# Check if matplotlib is installed, if not, prompt to install it
try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
except ImportError:
    print("Matplotlib is required but not installed.")
    install = input("Would you like to install it now? (y/n): ")
    if install.lower() == 'y':
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "matplotlib"])
        import matplotlib.pyplot as plt
        import matplotlib.patches as patches
    else:
        print("Matplotlib is required for this tool. Exiting.")
        sys.exit(1)

# Create output directory for visualizations
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'meme_box_visualizations')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

def load_image(image_path_or_url):
    """Load an image from a file path or URL."""
    try:
        if image_path_or_url.startswith(('http://', 'https://')):
            response = requests.get(image_path_or_url)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
            
            # For URLs, save a local copy in our output directory
            local_filename = os.path.join(
                OUTPUT_DIR, 
                f"original_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            )
            img.save(local_filename)
            print(f"Saved a local copy of the image to: {local_filename}")
            return img, local_filename
        else:
            img = Image.open(image_path_or_url)
            
            # If the image is not in our output directory, make a copy
            if not image_path_or_url.startswith(OUTPUT_DIR):
                local_filename = os.path.join(
                    OUTPUT_DIR, 
                    f"original_{os.path.basename(image_path_or_url)}"
                )
                shutil.copy2(image_path_or_url, local_filename)
                print(f"Copied the image to: {local_filename}")
            else:
                local_filename = image_path_or_url
                
            return img, local_filename
    except Exception as e:
        print(f"Error loading image: {e}")
        return None, None

def analyze_image_for_text_boxes(image_path, feedback=None):
    """Send image to Claude and ask for text box suggestions."""
    print("Analyzing image for optimal text box placement...")
    img, local_path = load_image(image_path)
    if img is None:
        return {"text_boxes": []}, None
    
    # Convert image to bytes for Claude API
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format=img.format or 'PNG')
    img_bytes = img_byte_arr.getvalue()
    
    # Create prompt for Claude, including any feedback if provided
    prompt = """
    Analyze this meme template image. I need you to suggest optimal positions for text boxes.
    """
    
    if feedback:
        prompt += f"""
    
    IMPORTANT: Consider this feedback on your previous suggestion:
    {feedback}
    
    Please adjust your recommendations based on this feedback.
    """
        
    prompt += """
    
    For each text box:
    1. Provide the coordinates (x, y) for the top-left corner as percentages of image width/height
    2. Suggest width and height as percentages of image dimensions
    3. Explain why this position is good for text (e.g., clear background, doesn't obscure faces)
    
    Return your suggestions in this JSON format:
    {
      "text_boxes": [
        {
          "id": 1,
          "x": 0.1,
          "y": 0.05,
          "width": 0.8,
          "height": 0.15,
          "purpose": "top text",
          "explanation": "Clear sky area with good contrast"
        },
        ...
      ]
    }
    
    Aim for 1-3 text boxes depending on the meme template's structure.
    """
    
    try:
        # Call Claude Vision API
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=1000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": f"image/{img.format.lower() if img.format else 'jpeg'}",
                                "data": base64.b64encode(img_bytes).decode('utf-8')
                            }
                        }
                    ]
                }
            ]
        )
        
        # Extract and parse JSON from Claude's response
        content = response.content[0].text
        
        # Find JSON in the response
        json_match = re.search(r'```json\n(.*?)\n```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find JSON without code block markers
            json_match = re.search(r'({[\s\S]*})', content)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = content
        
        try:
            text_boxes = json.loads(json_str)
            return text_boxes, local_path
        except json.JSONDecodeError:
            print(f"Error parsing JSON from Claude's response. Raw response:")
            print(content)
            # Attempt a more aggressive JSON extraction
            pattern = r'{\s*"text_boxes"\s*:\s*\[\s*{.*?}\s*\]\s*}'
            json_match = re.search(pattern, content, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0)), local_path
                except:
                    pass
            
            # If all else fails, return empty text boxes
            return {"text_boxes": []}, local_path
            
    except Exception as e:
        print(f"Error calling Claude API: {e}")
        return {"text_boxes": []}, local_path

def visualize_text_boxes(image_path, text_boxes, iteration=1):
    """Create a visualization of the image with suggested text boxes."""
    print("Creating visualization of suggested text boxes...")
    img, local_path = load_image(image_path)
    if img is None:
        return None
    
    # Create figure and axes
    fig, ax = plt.subplots(1, figsize=(10, 10))
    ax.imshow(img)
    
    # Add rectangles for each text box
    for box in text_boxes["text_boxes"]:
        # Convert percentages to pixel coordinates
        x = box["x"] * img.width
        y = box["y"] * img.height
        width = box["width"] * img.width
        height = box["height"] * img.height
        
        # Create rectangle
        rect = patches.Rectangle(
            (x, y), width, height, 
            linewidth=2, 
            edgecolor='r', 
            facecolor='none'
        )
        ax.add_patch(rect)
        
        # Add label
        ax.text(
            x + width/2, y + height/2, 
            f"Box {box['id']}: {box.get('purpose', '')}", 
            color='white', 
            fontsize=12, 
            ha='center', 
            va='center',
            bbox=dict(facecolor='red', alpha=0.5)
        )
    
    # Remove axis ticks
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Add title
    ax.set_title(f"Suggested Text Box Placements (Iteration {iteration})", fontsize=16)
    
    # Save visualization to our output directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = os.path.basename(image_path)
    base_name = os.path.splitext(filename)[0]
    output_path = os.path.join(OUTPUT_DIR, f"{base_name}_boxes_iter{iteration}_{timestamp}.png")
    plt.savefig(output_path)
    plt.close()
    
    print(f"Visualization saved to: {output_path}")
    return output_path


def display_image(image_path):
    """Display an image using matplotlib."""
    img, _ = load_image(image_path)
    if img is None:
        return
    
    plt.figure(figsize=(10, 10))
    plt.imshow(img)
    plt.axis('off')
    plt.show()

def feedback_loop(image_path, no_display=False):
    """Run the feedback loop for text box placement."""
    iteration = 1
    current_image = image_path
    user_feedback = None
    
    while True:
        # Analyze image and get text box suggestions
        text_boxes, local_path = analyze_image_for_text_boxes(current_image, user_feedback)
        
        if not text_boxes or not text_boxes.get("text_boxes"):
            print("No text boxes were suggested. Please try a different image.")
            return
        
        # Use the local path for further operations if available
        if local_path:
            current_image = local_path
        
        print(f"\nIteration {iteration} - Suggested text boxes:")
        for box in text_boxes["text_boxes"]:
            print(f"Box {box['id']}: {box.get('purpose', '')}")
            print(f"  Position: ({box['x']:.2f}, {box['y']:.2f}), Size: {box['width']:.2f} x {box['height']:.2f}")
            print(f"  Explanation: {box.get('explanation', '')}")
        
        # Create visualization
        visualization_path = visualize_text_boxes(current_image, text_boxes, iteration)
        if not visualization_path:
            print("Failed to create visualization. Exiting.")
            return
        
        # Display the image if not in headless mode
        if not no_display:
            print("\nDisplaying visualization... (close the window to continue)")
            display_image(visualization_path)
        
        # Get user feedback
        print("\nOptions:")
        print("1. Accept these text box placements")
        print("2. Provide feedback and try again")
        print("3. Start over with a different image")
        print("4. Exit")
        
        choice = input("\nEnter your choice (1-4): ")
        
        if choice == '1':
            print("\nText box placements accepted!")
            print(f"Final visualization saved at: {visualization_path}")
            
            # Save the text box data as JSON
            json_path = os.path.join(OUTPUT_DIR, f"{os.path.splitext(os.path.basename(current_image))[0]}_boxes.json")
            with open(json_path, 'w') as f:
                json.dump(text_boxes, f, indent=2)
            print(f"Text box data saved to: {json_path}")
            
            return
        elif choice == '2':
            user_feedback = input("\nPlease provide feedback on the text box placement: ")
            iteration += 1
            # Use the visualization as the current image for the next iteration
            current_image = visualization_path
        elif choice == '3':
            new_image = input("\nEnter path or URL to a new meme template image: ")
            feedback_loop(new_image, no_display)
            return
        elif choice == '4':
            print("\nExiting.")
            return
        else:
            print("\nInvalid choice. Please try again.")

def main():
    parser = argparse.ArgumentParser(description='Meme Text Box Suggester')
    parser.add_argument('--image', type=str, help='Path or URL to meme template image')
    parser.add_argument('--no-display', action='store_true', help='Do not display images (useful for headless environments)')
    args = parser.parse_args()
    
    if not args.image:
        # Interactive mode
        image_path = input("Enter path or URL to meme template image: ")
    else:
        image_path = args.image
    
    print(f"Analyzing image: {image_path}")
    feedback_loop(image_path, args.no_display)
    print("Done!")

if __name__ == "__main__":
    main()
