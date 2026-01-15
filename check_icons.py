import struct
import os

assets_dir = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\learnus-app\assets"
files = ["adaptive-icon.png", "favicon.png", "icon.png", "splash-icon.png"]

def get_png_dimensions(path):
    with open(path, 'rb') as f:
        head = f.read(24)
        if len(head) != 24:
            return "Invalid"
        # Check PNG signature
        if head[:8] != b'\x89PNG\r\n\x1a\n':
            return "Not a PNG"
        # IHDR chunk usually starts at byte 8 (length 4 bytes, type 4 bytes 'IHDR')
        # Width at 16, Height at 20
        w = struct.unpack('>I', head[16:20])[0]
        h = struct.unpack('>I', head[20:24])[0]
        return f"{w}x{h}"

for f in files:
    path = os.path.join(assets_dir, f)
    if os.path.exists(path):
        try:
            dims = get_png_dimensions(path)
            print(f"{f}: {dims}")
        except Exception as e:
            print(f"{f}: Error {e}")
    else:
        print(f"{f}: Not found")
