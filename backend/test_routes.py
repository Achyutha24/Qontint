import requests

try:
    res = requests.get("http://127.0.0.1:8000/openapi.json")
    print(res.status_code)
    routes = res.json().get("paths", {}).keys()
    for route in routes:
        if "taxonomy" in route:
            print("FOUND ROUTE:", route)
except Exception as e:
    print(e)
