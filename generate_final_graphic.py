from PIL import Image, ImageDraw, ImageFont
import urllib.request
import os
import math

def generate():
    width, height = 1024, 500
    out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"
    icon_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\icon.png"
    
    img = Image.new("RGB", (width, height))
    
    # 1. Beautiful Radial Gradient Background
    cx, cy = width / 2, height / 2
    max_dist = (cx**2 + cy**2)**0.5
    
    color_center = (30, 115, 190) # vibrant blue
    color_edge = (10, 45, 85)     # dark navy blue
    
    pixels = img.load()
    for x in range(width):
        for y in range(height):
            dist = ((x - cx)**2 + (y - cy)**2)**0.5
            blend = min(dist / max_dist, 1.0)
            # Smooth easing
            blend = blend ** 1.5
            
            r = int(color_center[0] * (1 - blend) + color_edge[0] * blend)
            g = int(color_center[1] * (1 - blend) + color_edge[1] * blend)
            b = int(color_center[2] * (1 - blend) + color_edge[2] * blend)
            pixels[x, y] = (r, g, b)

    draw = ImageDraw.Draw(img)

    # 2. Download a premium, modern font (Poppins Bold)
    font_path = "Poppins-Bold.ttf"
    if not os.path.exists(font_path):
        try:
            url = "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf"
            urllib.request.urlretrieve(url, font_path)
            print("Downloaded Poppins-Bold font")
        except Exception as e:
            print(f"Font download failed: {e}")
            
    try:
        font = ImageFont.truetype(font_path, 85)
    except:
        font = ImageFont.load_default()

    # 3. Load and prepare Icon
    icon = Image.open(icon_path).convert("RGBA")
    icon_size = 260
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    icon = icon.resize((icon_size, icon_size), resample)
    
    text = "LearnUs Connect"
    
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        text_w = right - left
        text_h = bottom - top
    except AttributeError:
        text_w, text_h = draw.textsize(text, font=font)
        
    # 4. Perfect Layout (Side by Side)
    spacing = 50
    total_w = icon_size + spacing + text_w
    
    start_x = (width - total_w) // 2
    icon_y = (height - icon_size) // 2
    # Adjust text Y because fonts have internal ascenders/descenders
    text_y = (height - text_h) // 2 - 25 
    
    # Drop shadow for icon
    alpha = icon.split()[3]
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 100))
    shadow.putalpha(alpha)
    img.paste(shadow, (start_x + 6, icon_y + 10), shadow)
    
    # Paste icon
    img.paste(icon, (start_x, icon_y), icon)
    
    # Text shadow
    draw.text((start_x + icon_size + spacing + 4, text_y + 4), text, font=font, fill=(0, 0, 0, 80))
    # Text
    draw.text((start_x + icon_size + spacing, text_y), text, font=font, fill=(255, 255, 255))
    
    img.save(out_path, quality=100)
    print(f"Successfully generated simple, premium graphic at {out_path}")

if __name__ == "__main__":
    generate()
