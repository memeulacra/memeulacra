from PIL import Image, ImageDraw, ImageFont
import json

def draw_boxes_on_meme(image_path, boxes_data, output_path):
    # Load the image
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)
    
    # Get image dimensions
    img_width, img_height = img.size
    
    # Parse the JSON data (fixing the format issue)
    try:
        # The data seems to have extra wrapping and quotes
        # Remove the outer quotes and braces
        cleaned_data = boxes_data.strip('"{}"')
        # Now parse the cleaned JSON
        boxes = json.loads(cleaned_data)
    except json.JSONDecodeError:
        print("Error parsing JSON data. Trying alternative approach...")
        # If the above fails, try another approach
        cleaned_data = boxes_data.replace('\\"', '"').strip('"{}"')
        boxes = json.loads(cleaned_data)
    
    # Draw each box with its label
    for box in boxes:
        # Convert percentage coordinates to pixel coordinates
        x = box["x"] * img_width / 100
        y = box["y"] * img_height / 100
        width = box["width"] * img_width / 100
        height = box["height"] * img_height / 100
        
        # Calculate box corners
        x1, y1 = x, y
        x2, y2 = x + width, y + height
        
        # Draw rectangle (with some transparency)
        draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
        
        # Add label text (optional)
        font = ImageFont.load_default()
        draw.text((x1, y1 - 20), f"Box {box['id']}: {box['label'][:15]}...", fill="white", 
                 stroke_width=10, stroke_fill="black", font=font)
    
    # Save the result
    img.save(output_path)
    print(f"Image saved to {output_path}")

# Example usage
image_path = "setup/imgflip_data/templates/img/Distracted-Boyfriend.jpg"  # replace with your image path
boxes_data = '''{"[{\"x\": 42.11436170212762, \"y\": 3.9999999999999973, \"id\": 1, \"label\": \"boyfriend, who is in the center of the frame\", \"width\": 20, \"height\": 10}, {\"x\": 27.68617021276596, \"y\": 57.80000000000002, \"id\": 2, \"label\": \"girl in the foreground that he is looking at\", \"width\": 20.132978723404285, \"height\": 27.799999999999972}, {\"x\": 59.33510638297872, \"y\": 50.599999999999945, \"id\": 3, \"label\": \"his girlfirned who is being ignored by him\", \"width\": 15.545212765957427, \"height\": 25.199999999999953}]"}'''
output_path = "distracted_boyfriend_with_boxes.jpg"

draw_boxes_on_meme(image_path, boxes_data, output_path)