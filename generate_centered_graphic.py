from PIL import Image, ImageDraw, ImageFont
import urllib.request
import os

def generate():
    width, height = 1024, 500
    out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"
    icon_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\icon.png"
    
    # 1. Solid brand background
    bg_color = (15, 76, 129) # #0f4c81
    img = Image.new("RGB", (width, height), bg_color)

    # 2. Download the crispest UI font (Inter Bold)
    font_path = "Inter-Bold.ttf"
    if not os.path.exists(font_path):
        try:
            url = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf" # Inter variable, might fail. Let's get static
            url = "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf"
            urllib.request.urlretrieve(url, font_path)
            print("Downloaded Poppins-Bold")
        except Exception as e:
            print(f"Font download failed: {e}")
            
    try:
        font = ImageFont.truetype(font_path, 60)
    except:
        font = ImageFont.load_default()

    # 3. Load and tightly resize Icon
    icon = Image.open(icon_path).convert("RGBA")
    icon_size = 200
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    icon = icon.resize((icon_size, icon_size), resample)
    
    text = "LearnUs Connect"
    draw = ImageDraw.Draw(img)
    
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        text_w = right - left
        text_h = bottom - top
    except AttributeError:
        text_w, text_h = draw.textsize(text, font=font)
        
    # 4. Perfect Centered Layout
    spacing = 30
    total_h = icon_size + spacing + text_h
    
    start_y = (height - total_h) // 2
    icon_x = (width - icon_size) // 2
    text_x = (width - text_w) // 2
    
    # Paste icon (centered)
    img.paste(icon, (icon_x, start_y), icon)
    
    # Draw text (centered below icon)
    text_y_actual = start_y + icon_size + spacing
    
    # Text
    draw.text((text_x, text_y_actual), text, font=font, fill=(255, 255, 255))
    
    img.save(out_path, quality=100)
    print(f"Successfully generated ultra-simple graphic at {out_path}")

if __name__ == "__main__":
    generate()
