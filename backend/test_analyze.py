import requests

response = requests.post(
    "http://127.0.0.1:8000/api/v1/analyze",
    json={
        "content": "Traditional supply chains often struggle with delays, inventory shortages, inaccurate forecasting, and rising transportation costs. AI solves these problems by enabling faster analysis and better predictions.",
        "keyword": "ai supply chain automation agents 2026",
        "vertical": "sap_supply_chain"
    }
)

print(response.status_code)
print(response.text)
