import requests

try:
    res = requests.post(
        "http://127.0.0.1:8000/api/v1/taxonomy/ingest",
        json={"records": [{"query": "test query", "vertical": "test vertical"}]}
    )
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Error:", e)
