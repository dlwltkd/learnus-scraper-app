from PIL import Image, ImageDraw, ImageFont
import urllib.request
import os

def generate():
    width, height = 1024, 500
    out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"
    icon_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\icon.png"
    
    # 1. Subtle, elegant gradient background (Light, not harsh dark blue)
    # A very soft, professional off-white/light gray to light blue gradient
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    
    color1 = (250, 250, 252) # Very light cool gray
    color2 = (230, 235, 245) # Soft light blue-gray
    
    for y in range(height):
        r = int(color1[0] - (color1[0] - color2[0]) * (y / height))
        g = int(color1[1] - (color1[1] - color2[1]) * (y / height))
        b = int(color1[2] - (color1[2] - color2[2]) * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # 2. Add some very faint, modern, abstract geometric curves in the background
    draw.ellipse((-200, -100, 400, 500), fill=(240, 245, 255, 128))
    draw.ellipse((800, 200, 1300, 700), fill=(235, 242, 255, 128))

    # 3. Download a sleek, modern font (Poppins Medium)
    font_path = "Poppins-Medium.ttf"
    if not os.path.exists(font_path):
        try:
            url = "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Medium.ttf"
            urllib.request.urlretrieve(url, font_path)
            print("Downloaded Poppins-Medium")
        except Exception as e:
            print(f"Font download failed: {e}")
            
    try:
        font_large = ImageFont.truetype(font_path, 90)
        font_small = ImageFont.truetype(font_path, 45)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # 4. Load and flawlessly resize Icon (App Store style rounded rectangle)
    icon = Image.open(icon_path).convert("RGBA")
    icon_size = 300
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    icon = icon.resize((icon_size, icon_size), resample)

    # Calculate optimal side-by-side layout
    spacing = 60
    
    text_main = "LearnUs"
    text_sub = "Connect"
    
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text_main, font=font_large)
        text_main_w = right - left
        text_main_h = bottom - top
        
        left, top, right, bottom = draw.textbbox((0, 0), text_sub, font=font_small)
        text_sub_w = right - left
        text_sub_h = bottom - top
    except AttributeError:
        text_main_w, text_main_h = draw.textsize(text_main, font=font_large)
        text_sub_w, text_sub_h = draw.textsize(text_sub, font=font_small)
        
    total_text_h = text_main_h + text_sub_h + 10
    total_text_w = max(text_main_w, text_sub_w)
    total_w = icon_size + spacing + total_text_w
    
    start_x = (width - total_w) // 2
    icon_y = (height - icon_size) // 2
    text_y = (height - total_text_h) // 2
    
    # Premium soft drop shadow for the icon
    alpha = icon.split()[3]
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 40))
    shadow.putalpha(alpha)
    # create a slightly larger, blurrier shadow effect by drawing it multiple times with offsets
    img.paste(shadow, (start_x + 8, icon_y + 12), shadow)
    img.paste(shadow, (start_x + 12, icon_y + 16), shadow)
    
    # Paste icon
    img.paste(icon, (start_x, icon_y), icon)
    
    # Draw highly legible, dark text on the light background
    text_color = (20, 30, 45) # Very dark navy/slate
    text_sub_color = (100, 110, 130) # Subtle slate gray
    
    # Main text
    draw.text((start_x + icon_size + spacing, text_y), text_main, font=font_large, fill=text_color)
    # Sub text
    draw.text((start_x + icon_size + spacing + 5, text_y + text_main_h + 10), text_sub, font=font_small, fill=text_sub_color)
    
    img.save(out_path, quality=100)
    print(f"Successfully generated ultra-premium, light graphic at {out_path}")

if __name__ == "__main__":
    generate()
