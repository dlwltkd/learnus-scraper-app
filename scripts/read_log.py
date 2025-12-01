import sys
import io
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

log_file = 'api_debug.log'
try:
    with open(log_file, 'rb') as f:
        f.seek(0, os.SEEK_END)
        file_size = f.tell()
        seek_pos = max(0, file_size - 4000)
        f.seek(seek_pos)
        content = f.read().decode('utf-8', errors='ignore')
        print(content)
except Exception as e:
    print(f"Error reading log: {e}")
