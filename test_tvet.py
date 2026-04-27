import urllib.request
import json

data = json.dumps({
    'subject': 'level_1:carpentry_and_joinery',
    'year': 'Level 1',
    'question_type': 'multiple_choice',
    'num_questions': 5,
    'difficulty_level': 'medium'
}).encode()

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/questions/generate',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    resp = urllib.request.urlopen(req)
    body = resp.read().decode()
    print(resp.status)
    print(body[:500])
except Exception as e:
    print(f"Error: {e}")