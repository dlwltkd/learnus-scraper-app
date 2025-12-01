
with open('mod_vod.js', 'r', encoding='utf-8') as f:
    f.seek(880000)
    content = f.read(6000)
    
with open('mod_vod_helpers.txt', 'w', encoding='utf-8') as f_out:
    f_out.write(content)
