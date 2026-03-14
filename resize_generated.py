from PIL import Image
import os

in_path = r"C:\Users\birke\.gemini\antigravity\brain\67a9700b-9b31-4e41-a148-54d8fd7d46ed\learnus_feature_graphic_hq_1773477167457.png"
out_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets\feature_graphic.png"

try:
    img = Image.open(in_path)
    target_width = 1024
    target_height = 500

    img_ratio = img.width / img.height
    target_ratio = target_width / target_height

    if img_ratio > target_ratio:
        # Image is wider
        new_height = target_height
        new_width = int(new_height * img_ratio)
    else:
        # Image is taller
        new_width = target_width
        new_height = int(new_width / img_ratio)

    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        try:
            resample = Image.LANCZOS
        except AttributeError:
            resample = Image.ANTIALIAS

    img = img.resize((new_width, new_height), resample)

    left = (new_width - target_width) / 2
    top = (new_height - target_height) / 2
    right = (new_width + target_width) / 2
    bottom = (new_height + target_height) / 2

    img = img.crop((left, top, right, bottom))
    img.save(out_path)
    print(f"Successfully resized and saved to {out_path}")
except Exception as e:
    print(f"Error: {e}")
