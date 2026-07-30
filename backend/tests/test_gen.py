import json
import urllib.request


def run_live_generation_smoke_test() -> None:
    """Manually exercise a running API without blocking pytest collection."""
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
        with urllib.request.urlopen(req, timeout=180) as res:
            print('Status:', res.status)
            resp_data = json.loads(res.read())
        questions = resp_data.get('questions', [])
        print(f'Generated {len(questions)} questions')

        mcq_count = sum(1 for q in questions if q.get('question_type') == 'multiple_choice')
        theory_count = sum(1 for q in questions if q.get('question_type') == 'essay')

        print(f'MCQs: {mcq_count}')
        print(f'Theory: {theory_count}')
    except Exception as exc:
        print(f"Error: {exc}")


if __name__ == '__main__':
    run_live_generation_smoke_test()
