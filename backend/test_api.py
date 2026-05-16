import requests

r = requests.get('http://127.0.0.1:8000/api/v1/taxonomy/queries?page_size=5')
print('Status:', r.status_code)
if r.status_code == 200:
    data = r.json()
    print('Total:', data['total'])
    for q in data['queries'][:3]:
        print(' ', q['query'], '| intent=', q['buyer_intent_score'], '| novelty=', q['novelty_opportunity'], '| opp=', q.get('opportunity_score'))
else:
    print('Error:', r.text[:500])
