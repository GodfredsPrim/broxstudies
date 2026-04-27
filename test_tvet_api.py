import urllib.request
import json

try:
    # Test subjects endpoint
    req = urllib.request.Request('http://127.0.0.1:8000/api/questions/subjects')
    resp = urllib.request.urlopen(req)
    body = resp.read().decode()
    data = json.loads(body)

    print(f"Status: {resp.status}")
    subjects = data.get('subjects', [])
    print(f"Total subjects: {len(subjects)}")

    # Check for TVET subjects
    tvet_subjects = [s for s in subjects if s.get('academic_level') == 'tvet']
    shs_subjects = [s for s in subjects if s.get('academic_level') == 'shs']

    print(f"SHS subjects: {len(shs_subjects)}")
    print(f"TVET subjects: {len(tvet_subjects)}")

    if tvet_subjects:
        print("\nSample TVET subjects:")
        for subj in tvet_subjects[:5]:
            print(f"  - {subj['name']} ({subj['year']}) - {subj['id']}")

    # Test question generation for TVET
    if tvet_subjects:
        sample_subject = tvet_subjects[0]
        print(f"\nTesting question generation for: {sample_subject['name']}")

        question_data = json.dumps({
            'subject': sample_subject['id'],
            'year': sample_subject['year'],
            'question_type': 'multiple_choice',
            'num_questions': 3,
            'difficulty_level': 'medium'
        }).encode()

        req2 = urllib.request.Request(
            'http://127.0.0.1:8000/api/questions/generate',
            data=question_data,
            headers={'Content-Type': 'application/json'}
        )

        resp2 = urllib.request.urlopen(req2)
        questions = json.loads(resp2.read().decode())
        print(f"Generated {len(questions)} questions successfully!")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()