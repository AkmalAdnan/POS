"""
Spice POS API Tests
Tests for: Auth, Menu, Orders, Settings, Expenses, Analytics
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_EMAIL = "owner@spice.com"
OWNER_PASSWORD = "owner123"
STAFF_EMAIL = "staff@spice.com"
STAFF_PASSWORD = "staff123"
CUSTOMER_EMAIL = "guest@spice.com"
CUSTOMER_PASSWORD = "guest123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def owner_token(api_client):
    """Get owner authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    assert response.status_code == 200, f"Owner login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def staff_token(api_client):
    """Get staff authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    })
    assert response.status_code == 200, f"Staff login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def customer_token(api_client):
    """Get customer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    assert response.status_code == 200, f"Customer login failed: {response.text}"
    return response.json().get("token")


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_root(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ API health check passed")


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_owner_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == OWNER_EMAIL
        assert data["user"]["role"] == "owner"
        print("✓ Owner login success")
    
    def test_login_staff_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "staff"
        print("✓ Staff login success")
    
    def test_login_customer_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "customer"
        print("✓ Customer login success")
    
    def test_login_invalid_credentials(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected")
    
    def test_auth_me_with_bearer_token(self, api_client, owner_token):
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == OWNER_EMAIL
        assert data["role"] == "owner"
        print("✓ GET /auth/me with Bearer token works")
    
    def test_auth_me_without_token(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ GET /auth/me without token returns 401")
    
    def test_logout(self, api_client, owner_token):
        response = api_client.post(f"{BASE_URL}/api/auth/logout", headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        print("✓ Logout works")
    
    def test_register_new_user(self, api_client):
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test User",
            "email": unique_email,
            "password": "testpass123",
            "role": "customer"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "customer"
        print("✓ Register new user works")
    
    def test_register_duplicate_email(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Duplicate",
            "email": OWNER_EMAIL,
            "password": "testpass123",
            "role": "customer"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration rejected")


class TestMenu:
    """Menu CRUD endpoint tests"""
    
    def test_list_menu_public(self, api_client):
        """Menu list should be public (no auth required)"""
        response = api_client.get(f"{BASE_URL}/api/menu")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 23, f"Expected at least 23 seeded items, got {len(data)}"
        
        # Check categories
        categories = set(item["category"] for item in data)
        expected_cats = {"Main Course", "Chinese", "Biryanis", "Roti", "Fried Rice", "Mandi", "Sweets", "Mutton"}
        assert expected_cats.issubset(categories), f"Missing categories: {expected_cats - categories}"
        print(f"✓ Menu list returns {len(data)} items across {len(categories)} categories")
    
    def test_create_menu_item_owner_only(self, api_client, owner_token, staff_token, customer_token):
        """Only owner can create menu items"""
        new_item = {
            "name": "TEST_Masala Dosa",
            "category": "Main Course",
            "price": 120,
            "cost": 50,
            "description": "Test item",
            "is_available": True
        }
        
        # Staff should get 403
        response = api_client.post(f"{BASE_URL}/api/menu", json=new_item, headers=auth_header(staff_token))
        assert response.status_code == 403, f"Staff should not create menu items: {response.text}"
        print("✓ Staff cannot create menu items (403)")
        
        # Customer should get 403
        response = api_client.post(f"{BASE_URL}/api/menu", json=new_item, headers=auth_header(customer_token))
        assert response.status_code == 403
        print("✓ Customer cannot create menu items (403)")
        
        # Owner should succeed
        response = api_client.post(f"{BASE_URL}/api/menu", json=new_item, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == new_item["name"]
        assert "id" in data
        print(f"✓ Owner created menu item: {data['id']}")
        return data["id"]
    
    def test_update_menu_item_owner_only(self, api_client, owner_token, staff_token):
        """Only owner can update menu items"""
        # First create an item
        new_item = {
            "name": "TEST_Update Item",
            "category": "Chinese",
            "price": 100,
            "cost": 40,
            "description": "To be updated",
            "is_available": True
        }
        create_resp = api_client.post(f"{BASE_URL}/api/menu", json=new_item, headers=auth_header(owner_token))
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Staff should get 403
        update_data = {**new_item, "price": 150}
        response = api_client.put(f"{BASE_URL}/api/menu/{item_id}", json=update_data, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot update menu items (403)")
        
        # Owner should succeed
        response = api_client.put(f"{BASE_URL}/api/menu/{item_id}", json=update_data, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert response.json()["price"] == 150
        print("✓ Owner updated menu item")
    
    def test_delete_menu_item_owner_only(self, api_client, owner_token, staff_token):
        """Only owner can delete menu items"""
        # First create an item
        new_item = {
            "name": "TEST_Delete Item",
            "category": "Sweets",
            "price": 80,
            "cost": 30,
            "description": "To be deleted",
            "is_available": True
        }
        create_resp = api_client.post(f"{BASE_URL}/api/menu", json=new_item, headers=auth_header(owner_token))
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Staff should get 403
        response = api_client.delete(f"{BASE_URL}/api/menu/{item_id}", headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot delete menu items (403)")
        
        # Owner should succeed
        response = api_client.delete(f"{BASE_URL}/api/menu/{item_id}", headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner deleted menu item")


class TestSettings:
    """Settings endpoint tests (owner only)"""
    
    def test_get_settings(self, api_client):
        """Settings should be publicly readable"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "cgst_rate" in data
        assert "sgst_rate" in data
        assert "restaurant_name" in data
        print(f"✓ Settings: CGST={data['cgst_rate']}%, SGST={data['sgst_rate']}%")
    
    def test_update_settings_owner_only(self, api_client, owner_token, staff_token, customer_token):
        """Only owner can update settings"""
        # Get current settings
        current = api_client.get(f"{BASE_URL}/api/settings").json()
        
        update_data = {
            "cgst_rate": 9.0,
            "sgst_rate": 9.0,
            "restaurant_name": current.get("restaurant_name", "Spice Route"),
            "address": current.get("address", ""),
            "phone": current.get("phone", ""),
            "gstin": current.get("gstin", "")
        }
        
        # Staff should get 403
        response = api_client.put(f"{BASE_URL}/api/settings", json=update_data, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot update settings (403)")
        
        # Customer should get 403
        response = api_client.put(f"{BASE_URL}/api/settings", json=update_data, headers=auth_header(customer_token))
        assert response.status_code == 403
        print("✓ Customer cannot update settings (403)")
        
        # Owner should succeed
        response = api_client.put(f"{BASE_URL}/api/settings", json=update_data, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["cgst_rate"] == 9.0
        print("✓ Owner updated settings")
        
        # Reset back to original
        reset_data = {**update_data, "cgst_rate": 2.5, "sgst_rate": 2.5}
        api_client.put(f"{BASE_URL}/api/settings", json=reset_data, headers=auth_header(owner_token))
        print("✓ Settings reset to original values")


class TestOrders:
    """Order CRUD and status flow tests"""
    
    @pytest.fixture(scope="class")
    def menu_items(self, api_client):
        """Get menu items for order creation"""
        response = api_client.get(f"{BASE_URL}/api/menu")
        return response.json()[:3]  # Get first 3 items
    
    def test_create_order_staff(self, api_client, staff_token, menu_items):
        """Staff can create orders"""
        order_items = [
            {"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 2},
            {"menu_item_id": menu_items[1]["id"], "name": menu_items[1]["name"], "price": menu_items[1]["price"], "quantity": 1}
        ]
        
        response = api_client.post(f"{BASE_URL}/api/orders", json={
            "items": order_items,
            "table_number": "T5",
            "customer_name": "Test Customer",
            "notes": "Extra spicy"
        }, headers=auth_header(staff_token))
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "order_number" in data
        assert data["status"] == "new"
        assert data["table_number"] == "T5"
        
        # Verify CGST/SGST calculation
        expected_subtotal = sum(i["price"] * i["quantity"] for i in order_items)
        assert data["subtotal"] == expected_subtotal
        assert data["cgst"] > 0
        assert data["sgst"] > 0
        assert data["total"] == round(expected_subtotal + data["cgst"] + data["sgst"], 2)
        print(f"✓ Staff created order #{data['order_number']}: subtotal={data['subtotal']}, CGST={data['cgst']}, SGST={data['sgst']}, total={data['total']}")
        return data
    
    def test_create_order_owner(self, api_client, owner_token, menu_items):
        """Owner can create orders"""
        order_items = [
            {"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}
        ]
        
        response = api_client.post(f"{BASE_URL}/api/orders", json={
            "items": order_items,
            "table_number": "T1"
        }, headers=auth_header(owner_token))
        
        assert response.status_code == 200
        print("✓ Owner can create orders")
    
    def test_create_order_customer(self, api_client, customer_token, menu_items):
        """Customer can create orders"""
        order_items = [
            {"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}
        ]
        
        response = api_client.post(f"{BASE_URL}/api/orders", json={
            "items": order_items,
            "customer_name": "Guest Customer"
        }, headers=auth_header(customer_token))
        
        assert response.status_code == 200
        print("✓ Customer can create orders")
        return response.json()
    
    def test_list_orders_with_filters(self, api_client, owner_token):
        """List orders with date and status filters"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # List all orders for today
        response = api_client.get(f"{BASE_URL}/api/orders", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Listed {len(orders)} orders for {today}")
        
        # Filter by status
        response = api_client.get(f"{BASE_URL}/api/orders", params={"status": "new"}, headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Status filter works")
    
    def test_customer_sees_only_own_orders(self, api_client, customer_token, owner_token, menu_items):
        """Customer should only see their own orders"""
        # Create an order as customer
        order_items = [{"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}]
        create_resp = api_client.post(f"{BASE_URL}/api/orders", json={"items": order_items}, headers=auth_header(customer_token))
        customer_order_id = create_resp.json()["id"]
        
        # Customer lists orders
        response = api_client.get(f"{BASE_URL}/api/orders", headers=auth_header(customer_token))
        assert response.status_code == 200
        customer_orders = response.json()
        
        # All orders should belong to customer
        for order in customer_orders:
            assert order["created_by_role"] == "customer"
        print(f"✓ Customer sees only their own orders ({len(customer_orders)} orders)")
    
    def test_get_order_by_id(self, api_client, owner_token, menu_items):
        """Get single order by ID"""
        # Create an order first
        order_items = [{"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}]
        create_resp = api_client.post(f"{BASE_URL}/api/orders", json={"items": order_items, "table_number": "T99"}, headers=auth_header(owner_token))
        order_id = create_resp.json()["id"]
        
        # Get order
        response = api_client.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == order_id
        print("✓ GET /orders/{id} works")
    
    def test_order_status_flow(self, api_client, staff_token, menu_items):
        """Test order status flow: new → preparing → ready → served"""
        # Create order
        order_items = [{"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}]
        create_resp = api_client.post(f"{BASE_URL}/api/orders", json={"items": order_items}, headers=auth_header(staff_token))
        order = create_resp.json()
        order_id = order["id"]
        assert order["status"] == "new"
        
        # new → preparing
        response = api_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "preparing"}, headers=auth_header(staff_token))
        assert response.status_code == 200
        assert response.json()["status"] == "preparing"
        print("✓ Status: new → preparing")
        
        # preparing → ready
        response = api_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "ready"}, headers=auth_header(staff_token))
        assert response.status_code == 200
        assert response.json()["status"] == "ready"
        print("✓ Status: preparing → ready")
        
        # ready → served
        response = api_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "served"}, headers=auth_header(staff_token))
        assert response.status_code == 200
        assert response.json()["status"] == "served"
        print("✓ Status: ready → served")
    
    def test_update_status_customer_forbidden(self, api_client, customer_token, owner_token, menu_items):
        """Customer cannot update order status"""
        # Create order as owner
        order_items = [{"menu_item_id": menu_items[0]["id"], "name": menu_items[0]["name"], "price": menu_items[0]["price"], "quantity": 1}]
        create_resp = api_client.post(f"{BASE_URL}/api/orders", json={"items": order_items}, headers=auth_header(owner_token))
        order_id = create_resp.json()["id"]
        
        # Customer tries to update status
        response = api_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "preparing"}, headers=auth_header(customer_token))
        assert response.status_code == 403
        print("✓ Customer cannot update order status (403)")


class TestExpenses:
    """Expenses endpoint tests (owner only)"""
    
    def test_create_expense_owner_only(self, api_client, owner_token, staff_token, customer_token):
        """Only owner can create expenses"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        expense_data = {
            "title": "TEST_Groceries",
            "amount": 500,
            "category": "groceries",
            "date": today
        }
        
        # Staff should get 403
        response = api_client.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot create expenses (403)")
        
        # Customer should get 403
        response = api_client.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_header(customer_token))
        assert response.status_code == 403
        print("✓ Customer cannot create expenses (403)")
        
        # Owner should succeed
        response = api_client.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Groceries"
        assert data["amount"] == 500
        print(f"✓ Owner created expense: {data['id']}")
        return data
    
    def test_list_expenses_owner_only(self, api_client, owner_token, staff_token):
        """Only owner can list expenses"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Staff should get 403
        response = api_client.get(f"{BASE_URL}/api/expenses", params={"date": today}, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot list expenses (403)")
        
        # Owner should succeed
        response = api_client.get(f"{BASE_URL}/api/expenses", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ Owner can list expenses")
    
    def test_delete_expense_owner_only(self, api_client, owner_token, staff_token):
        """Only owner can delete expenses"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create expense first
        expense_data = {"title": "TEST_ToDelete", "amount": 100, "category": "test", "date": today}
        create_resp = api_client.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_header(owner_token))
        expense_id = create_resp.json()["id"]
        
        # Staff should get 403
        response = api_client.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot delete expenses (403)")
        
        # Owner should succeed
        response = api_client.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner deleted expense")


class TestAnalytics:
    """Analytics endpoint tests (owner only)"""
    
    def test_analytics_summary(self, api_client, owner_token, staff_token):
        """Analytics summary endpoint"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Staff should get 403
        response = api_client.get(f"{BASE_URL}/api/analytics/summary", params={"date": today}, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot access analytics (403)")
        
        # Owner should succeed
        response = api_client.get(f"{BASE_URL}/api/analytics/summary", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "date" in data
        assert "orders_count" in data
        assert "revenue" in data
        assert "cost_of_goods" in data
        assert "spent" in data
        assert "profit" in data
        assert "loss" in data
        assert "pie" in data
        assert "category_sales" in data
        
        # Verify pie chart data
        pie_names = [p["name"] for p in data["pie"]]
        assert "Profit" in pie_names
        assert "Spent" in pie_names
        assert "Cost of Goods" in pie_names
        assert "Loss" in pie_names
        
        print(f"✓ Analytics summary: revenue={data['revenue']}, orders={data['orders_count']}, profit={data['profit']}")
    
    def test_analytics_export_csv(self, api_client, owner_token, staff_token):
        """CSV export endpoint"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Staff should get 403
        response = api_client.get(f"{BASE_URL}/api/analytics/export", params={"date": today}, headers=auth_header(staff_token))
        assert response.status_code == 403
        print("✓ Staff cannot export CSV (403)")
        
        # Owner should succeed
        response = api_client.get(f"{BASE_URL}/api/analytics/export", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        # Verify CSV content
        csv_content = response.text
        assert "Order#" in csv_content
        assert "Created At" in csv_content
        assert "Total" in csv_content
        print("✓ CSV export works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
