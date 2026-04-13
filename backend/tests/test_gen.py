import urllib.request
import json

data = json.dumps({
    'subject': 'mathematics',
    'question_type': 'standard',
    'num_questions': 5,
    'year': 'year_1'
}).encode()

req = urllib.request.Request(
    'http://localhost:8000/api/questions/generate', 
    data=data, 
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(req)
    print('Status:', res.status)
    resp_data = json.loads(res.read())
    questions = resp_data.get('questions', [])
    print(f'Generated {len(questions)} questions')

    mcq_count = sum(1 for q in questions if q.get('question_type') == 'multiple_choice')
    theory_count = sum(1 for q in questions if q.get('question_type') == 'essay')

    print(f'MCQs: {mcq_count}')
    print(f'Theory: {theory_count}')
except Exception as e:
    print(f"Error: {e}")
