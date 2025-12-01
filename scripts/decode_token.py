import base64

token_str = "nda2mzgzntc4odyymdm2ymqxnde1yzuxogexmja3njg6ojo2yzqzntdknzbizgyyy2e1ndk5yzjimwy4n2y1ogfmnto6olq0t3njvwdqqtnmeuwyq0joaezqceyzmna2yxzjdvztm2zlsznhagvqs0nyrnbesdzom1fsbwzmblhgqndsv0q="

try:
    decoded = base64.b64decode(token_str).decode('utf-8')
    print(f"Decoded: {decoded}")
except Exception as e:
    print(f"Error decoding: {e}")
    # Try just printing bytes
    print(f"Decoded bytes: {base64.b64decode(token_str)}")
