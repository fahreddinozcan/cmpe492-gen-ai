```bash
minikube service fastapi-service --url
```

```bash
locust -f loadtest/locust.py --host="http://127.0.0.1:51938"
```
