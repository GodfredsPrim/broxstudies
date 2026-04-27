import urllib.request
import json

# Test subjects endpoint
try:
    req = urllib.request.Request('http://127.0.0.1:8000/api/questions/subjects')
    resp = urllib.request.urlopen(req)
    body = resp.read().decode()
    data = json.loads(body)
    print(f"Status: {resp.status}")
    print(f"Subjects count: {len(data.get('subjects', []))}")

    # Check for TVET subjects
    tvet_subjects = [s for s in data.get('subjects', []) if s.get('academic_level') == 'tvet']
    print(f"TVET subjects: {len(tvet_subjects)}")
    if tvet_subjects:
        print("Sample TVET subjects:")
        for subj in tvet_subjects[:3]:
            print(f"  - {subj['name']} ({subj['year']})")

except Exception as e:
    print(f"Error: {e}")