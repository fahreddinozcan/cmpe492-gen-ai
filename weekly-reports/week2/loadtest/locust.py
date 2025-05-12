from locust import HttpUser, task, between
import random


class FastAPIUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def health_check(self):
        """Check service health"""
        self.client.get("/health")

    @task(2)
    def create_item(self):
        """Create a new item"""
        item = {
            "name": f"Test Item {random.randint(1, 1000)}",
            "description": "Load test item",
            "price": round(random.uniform(10.0, 100.0), 2),
        }
        self.client.post("/items/", json=item)

    @task(4)
    def get_items(self):
        """Get list of items"""
        self.client.get("/items/")

    @task(1)
    def get_items_count(self):
        """Get total count of items"""
        self.client.get("/items/count")
