from PIL import Image, ImageDraw, ImageFont
import os

bg_path = r"C:\Users\birke\.gemini\antigravity\brain\67a9700b-9b31-4e41-a148-54d8fd7d46ed\learnus_feature_bg_1773477248166.png"
icon_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\icon.png"
out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"

def create_hybrid_graphic():
    target_width, target_height = 1024, 500
    text = "LearnUs Connect"
    
    try:
        # 1. Load and prepare AI background
        bg = Image.open(bg_path).convert("RGBA")
        
        # Calculate aspect ratio for cropping
        bg_ratio = bg.width / bg.height
        target_ratio = target_width / target_height

        if bg_ratio > target_ratio:
            new_height = target_height
            new_width = int(new_height * bg_ratio)
        else:
            new_width = target_width
            new_height = int(new_width / bg_ratio)

        try:
            resample = Image.Resampling.LANCZOS
        except AttributeError:
            resample = Image.ANTIALIAS

        bg = bg.resize((new_width, new_height), resample)
        left = (new_width - target_width) / 2
        top = (new_height - target_height) / 2
        right = (new_width + target_width) / 2
        bottom = (new_height + target_height) / 2

        img = bg.crop((left, top, right, bottom)).convert("RGBA")
        
        # 2. Add a very subtle dark overlay to make text pop more
        overlay = Image.new('RGBA', img.size, (0, 0, 0, 60))
        img = Image.alpha_composite(img, overlay)

        # 3. Load and resize icon
        icon = Image.open(icon_path).convert("RGBA")
        icon_size = 320
        icon_resized = icon.resize((icon_size, icon_size), resample)

        # 4. Prepare text
        draw = ImageDraw.Draw(img)
        fonts_to_try = [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
        ]
        font = None
        for font_path in fonts_to_try:
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, 80)
                break
                
        if font is None:
            font = ImageFont.load_default()
            
        try:
            left_box, top_box, right_box, bottom_box = draw.textbbox((0, 0), text, font=font)
            text_width = right_box - left_box
            text_height = bottom_box - top_box
        except AttributeError:
            text_width, text_height = draw.textsize(text, font=font)

        # 5. Composite everything
        padding = 50
        total_content_width = icon_size + padding + text_width
        
        start_x = int((target_width - total_content_width) // 2)
        icon_y = int((target_height - icon_size) // 2)
        text_y = int((target_height - text_height) // 2) - 10
        
        # Paste icon
        img.paste(icon_resized, (start_x, icon_y), icon_resized)
        
        # Draw text shadow for depth
        shadow_offset = 3
        draw.text((start_x + icon_size + padding + shadow_offset, text_y + shadow_offset), text, fill=(0,0,0,128), font=font)
        # Draw actual text
        draw.text((start_x + icon_size + padding, text_y), text, fill="white", font=font)
        
        # Save as final RGB image
        img.convert("RGB").save(out_path, quality=100)
        print(f"Successfully generated hybrid HD graphic at {out_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_hybrid_graphic()
