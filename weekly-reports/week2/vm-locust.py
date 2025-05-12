from locust import HttpUser, task
import random


class TestUser(HttpUser):
    @task(2)
    def test_root(self):
        self.client.get("/")

    @task(1)
    def create_item(self):
        item = {"name": f"item{random.randint(1,100)}", "price": random.uniform(1, 100)}
        self.client.post("/items", json=item)

    @task(3)
    def get_items(self):
        self.client.get("/items")

    @task(1)
    def load_test(self):
        self.client.get("/load")
