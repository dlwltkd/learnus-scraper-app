from datetime import datetime
import re

def parse_date(date_str):
    if not date_str:
        return None
    
    print(f"Parsing: '{date_str}'")
    
    # 1. ISO-like: 2025-09-22 00:00:00
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        print(f"  -> ISO Match: {dt}")
        return dt
    except:
        pass
        
    # 2. Korean format: 2025년 10월 12일 (금) 23:59
    try:
        clean_str = re.sub(r'[년월일\(\)요일]', ' ', date_str)
        clean_str = " ".join(clean_str.split())
        dt = datetime.strptime(clean_str, "%Y %m %d %H:%M")
        print(f"  -> Korean Match: {dt}")
        return dt
    except:
        pass

    # 3. English format: Friday, 12 October 2025, 11:59 PM
    try:
        clean_str = re.sub(r'^[A-Za-z]+,\s*', '', date_str)
        dt = datetime.strptime(clean_str, "%d %B %Y, %I:%M %p")
        print(f"  -> English Match: {dt}")
        return dt
    except:
        pass
        
    print("  -> No match")
    return None

# Test Cases
parse_date("2025-09-22 00:00:00")
parse_date("Friday, 12 October 2025, 11:59 PM")
parse_date("2025년 10월 12일 (금) 23:59")
parse_date("Due: Friday, 12 October 2025, 11:59 PM") # Should fail if prefix not stripped before calling this
