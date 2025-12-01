import requests
import json

BASE_URL = "http://localhost:8000"

def test_vod_flow():
    # 1. Get Dashboard Overview to find a VOD
    print("Fetching dashboard overview...")
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/overview")
        resp.raise_for_status()
        data = resp.json()
        
        available_vods = data.get('available_vods', [])
        print(f"Found {len(available_vods)} available VODs.")
        
        target_vod_ids = []
        if available_vods:
            # Pick the first one
            target_vod_ids.append(available_vods[0]['id'])
            print(f"Testing with available VOD ID: {target_vod_ids[0]}")
        else:
            print("No available VODs found. Trying other categories for testing (might fail logic but tests endpoint)...")
            missed = data.get('missed_vods', [])
            if missed:
                target_vod_ids.append(missed[0]['id'])
                print(f"Testing with missed VOD ID: {target_vod_ids[0]}")
            else:
                print("No VODs found at all.")
                return

        # 2. Call /vod/watch
        print(f"Calling /vod/watch with IDs: {target_vod_ids}")
        payload = {"vod_ids": target_vod_ids}
        resp = requests.post(f"{BASE_URL}/vod/watch", json=payload)
        resp.raise_for_status()
        
        result = resp.json()
        print("Watch result:", json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Test failed: {e}")
        if 'resp' in locals():
            print(f"Response: {resp.text}")

if __name__ == "__main__":
    test_vod_flow()
