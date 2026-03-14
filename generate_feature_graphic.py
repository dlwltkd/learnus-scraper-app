from PIL import Image, ImageDraw, ImageFont
import os

def create_feature_graphic():
    width, height = 1024, 500
    icon_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\icon.png"
    out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"
    text = "LearnUs Connect"
    
    bg_color = "#0f4c81" # from adaptiveIcon backgroundColor
    
    try:
        icon = Image.open(icon_path).convert("RGBA")
        
        top_left_pixel = icon.getpixel((0, 0))
        if top_left_pixel[3] > 0: # not fully transparent
            bg_color = top_left_pixel[:3]
            
        img = Image.new('RGB', (width, height), bg_color)
        
        icon_size = 360
        try:
            resample = Image.Resampling.LANCZOS
        except AttributeError:
            try:
                resample = Image.LANCZOS
            except AttributeError:
                resample = Image.ANTIALIAS
                
        icon_resized = icon.resize((icon_size, icon_size), resample)
        
        draw = ImageDraw.Draw(img)
        fonts_to_try = [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf"
        ]
        font = None
        for font_path in fonts_to_try:
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, 80)
                break
                
        if font is None:
            font = ImageFont.load_default()
            
        try:
            left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
            text_width = right - left
            text_height = bottom - top
        except AttributeError:
            text_width, text_height = draw.textsize(text, font=font)
            
        padding = 40
        total_content_width = icon_size + padding + text_width
        
        start_x = int((width - total_content_width) // 2)
        icon_y = int((height - icon_size) // 2)
        text_y = int((height - text_height) // 2) - 10 # adjust slightly up
        
        img.paste(icon_resized, (start_x, icon_y), icon_resized if icon_resized.mode == 'RGBA' else None)
        
        if isinstance(bg_color, tuple):
            brightness = sum(bg_color) / 3
        else:
            brightness = (int(bg_color[1:3], 16) + int(bg_color[3:5], 16) + int(bg_color[5:7], 16)) / 3
            
        text_color = "black" if brightness > 128 else "white"
        
        draw.text((start_x + icon_size + padding, text_y), text, fill=text_color, font=font)
        
        img.save(out_path)
        print(f"Successfully saved to: {out_path}")
    except Exception as e:
        print(f"Error generating graphic: {e}")

if __name__ == '__main__':
    create_feature_graphic()
