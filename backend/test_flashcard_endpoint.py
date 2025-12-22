"""Test script to verify flashcard endpoint accessibility"""
import requests
import sys

BASE_URL = "http://localhost:8000"

def test_health():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Health check: {r.status_code} - {r.json()}")
        return True
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_flashcard_endpoint_exists():
    """Test if the flashcard route is registered (will get 401/403 without auth, but not 404)"""
    try:
        r = requests.post(f"{BASE_URL}/api/conversations/1/flashcards/generate", 
                         json={"cloud_model": None}, timeout=5)
        print(f"Flashcard endpoint: {r.status_code}")
        if r.status_code == 404:
            print("ERROR: Flashcard route NOT FOUND - backend route registration issue")
            return False
        elif r.status_code == 401:
            print("OK: Endpoint exists (got 401 = auth required)")
            return True
        elif r.status_code == 422:
            print("OK: Endpoint exists (got 422 = validation error)")
            return True
        else:
            print(f"Response: {r.text[:200]}")
            return True
    except Exception as e:
        print(f"Flashcard endpoint test failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Testing Backend ===")
    if test_health():
        test_flashcard_endpoint_exists()
    else:
        print("Backend not reachable!")
        sys.exit(1)
