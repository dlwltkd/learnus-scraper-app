
with open('mod_vod.js', 'r', encoding='utf-8') as f:
    f.seek(885000)
    content = f.read(5000)
    
with open('progress_code.txt', 'w', encoding='utf-8') as f_out:
    f_out.write(content)
