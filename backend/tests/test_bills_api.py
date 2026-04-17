"""
Spice POS API v2 Tests - Bills, Tables, Inventory, Guard, Analytics
Tests for: Auth (all roles), Bills CRUD, Tables, Inventory, Guard/Geofence, Analytics
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_EMAIL = "owner@spice.com"
OWNER_PASSWORD = "owner123"
CAPTAIN_EMAIL = "captain@spice.com"
CAPTAIN_PASSWORD = "captain123"
CHEF_EMAIL = "chef@spice.com"
CHEF_PASSWORD = "chef123"
CASHIER_EMAIL = "cashier@spice.com"
CASHIER_PASSWORD = "cashier123"
CUSTOMER_EMAIL = "guest@spice.com"
CUSTOMER_PASSWORD = "guest123"
LEGACY_EMAIL = "staff@spice.com"
LEGACY_PASSWORD = "staff123"


def get_token(email, password):
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email, "password": password
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "Spice POS API v2" in data["service"]
        print("✓ API health check passed")


class TestAuth:
    """Authentication endpoint tests for all roles"""
    
    def test_login_owner_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL, "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "owner"
        print("✓ Owner login success")
    
    def test_login_captain_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CAPTAIN_EMAIL, "password": CAPTAIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "captain"
        print("✓ Captain login success")
    
    def test_login_chef_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CHEF_EMAIL, "password": CHEF_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "chef"
        print("✓ Chef login success")
    
    def test_login_cashier_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CASHIER_EMAIL, "password": CASHIER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "cashier"
        print("✓ Cashier login success")
    
    def test_login_customer_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "customer"
        print("✓ Customer login success")
    
    def test_login_legacy_staff_migrated_to_captain(self):
        """Legacy staff@spice.com should be auto-migrated to captain role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": LEGACY_EMAIL, "password": LEGACY_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "captain", f"Expected captain, got {data['user']['role']}"
        print("✓ Legacy staff login migrated to captain")
    
    def test_login_invalid_credentials(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com", "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected")


class TestTables:
    """Tables endpoint tests"""
    
    def test_list_tables_returns_12_seeded(self):
        """GET /api/tables returns 12 seeded tables"""
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        response = requests.get(f"{BASE_URL}/api/tables", headers=auth_header(captain_token))
        assert response.status_code == 200
        tables = response.json()
        assert len(tables) >= 12, f"Expected at least 12 tables, got {len(tables)}"
        
        # Check table structure
        for t in tables:
            assert "id" in t
            assert "name" in t
            assert "seats" in t
            assert "status" in t
            assert t["status"] in ["available", "occupied"]
        print(f"✓ GET /tables returns {len(tables)} tables")
    
    def test_create_table_owner_only(self):
        """Only owner can create tables"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        new_table = {"name": "TEST_T99", "seats": 6}
        
        # Captain should get 403
        response = requests.post(f"{BASE_URL}/api/tables", json=new_table, headers=auth_header(captain_token))
        assert response.status_code == 403, f"Captain should not create tables, got {response.status_code}"
        print("✓ Captain cannot create tables (403)")
        
        # Owner should succeed
        response = requests.post(f"{BASE_URL}/api/tables", json=new_table, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_T99"
        assert data["seats"] == 6
        print(f"✓ Owner created table: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tables/{data['id']}", headers=auth_header(owner_token))
    
    def test_update_table_owner_only(self):
        """Only owner can update tables"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create a table first
        create_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_T98", "seats": 4}, headers=auth_header(owner_token))
        table_id = create_resp.json()["id"]
        
        # Captain should get 403
        response = requests.put(f"{BASE_URL}/api/tables/{table_id}", json={"name": "TEST_T98", "seats": 8}, headers=auth_header(captain_token))
        assert response.status_code == 403
        print("✓ Captain cannot update tables (403)")
        
        # Owner should succeed
        response = requests.put(f"{BASE_URL}/api/tables/{table_id}", json={"name": "TEST_T98", "seats": 8}, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert response.json()["seats"] == 8
        print("✓ Owner updated table")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tables/{table_id}", headers=auth_header(owner_token))
    
    def test_delete_table_owner_only(self):
        """Only owner can delete tables"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create a table first
        create_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_T97", "seats": 2}, headers=auth_header(owner_token))
        table_id = create_resp.json()["id"]
        
        # Captain should get 403
        response = requests.delete(f"{BASE_URL}/api/tables/{table_id}", headers=auth_header(captain_token))
        assert response.status_code == 403
        print("✓ Captain cannot delete tables (403)")
        
        # Owner should succeed
        response = requests.delete(f"{BASE_URL}/api/tables/{table_id}", headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner deleted table")


class TestBills:
    """Bills CRUD and workflow tests"""
    
    def test_create_bill_captain(self):
        """Captain can create a bill for a table"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create test table
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T1", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "table_id": table["id"],
            "customer_name": "Test Customer",
            "notes": "Test bill"
        }, headers=auth_header(captain_token))
        
        assert response.status_code == 200
        bill = response.json()
        assert "id" in bill
        assert "bill_number" in bill
        assert bill["status"] == "open"
        assert bill["table_id"] == table["id"]
        assert bill["items"] == []
        assert bill["kot_batches"] == []
        print(f"✓ Captain created bill #{bill['bill_number']}")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_create_bill_returns_existing_open_bill(self):
        """POST /api/bills returns existing open bill if called twice for same table"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create test table
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T2", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        
        # First call
        resp1 = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill1 = resp1.json()
        
        # Second call - should return same bill
        resp2 = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill2 = resp2.json()
        
        assert bill1["id"] == bill2["id"], "Should return same open bill"
        print("✓ POST /bills returns existing open bill for same table")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill1['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_add_items_with_department_routing(self):
        """Add items to bill - verify department auto-assignment"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        roti = next((i for i in menu if i["category"] == "Roti"), menu[0])
        biryani = next((i for i in menu if i["category"] == "Biryanis"), menu[1])
        beverage = next((i for i in menu if i["category"] == "Beverages"), menu[2])
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T3", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add items from different categories
        items_to_add = [
            {"menu_item_id": roti["id"], "quantity": 2, "notes": "Extra butter"},
            {"menu_item_id": biryani["id"], "quantity": 1, "notes": ""},
            {"menu_item_id": beverage["id"], "quantity": 2, "notes": "No ice"},
        ]
        
        response = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={"items": items_to_add}, headers=auth_header(captain_token))
        assert response.status_code == 200
        updated_bill = response.json()
        
        # Verify department routing
        for item in updated_bill["items"]:
            if item["category"] == "Roti":
                assert item["department"] == "Chinese Counter", f"Roti should route to Chinese Counter, got {item['department']}"
            elif item["category"] == "Biryanis":
                assert item["department"] == "Main Kitchen", f"Biryani should route to Main Kitchen, got {item['department']}"
            elif item["category"] == "Beverages":
                assert item["department"] == "Beverage Counter", f"Beverage should route to Beverage Counter, got {item['department']}"
        
        print("✓ Items added with correct department routing")
        print(f"  - Roti → Chinese Counter")
        print(f"  - Biryani → Main Kitchen")
        print(f"  - Beverage → Beverage Counter")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_send_kot_creates_batch(self):
        """POST /api/bills/{id}/send-kot assigns kot_batch number and timestamps"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T4", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add items
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        
        # Send KOT
        response = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        assert response.status_code == 200
        updated_bill = response.json()
        
        assert len(updated_bill["kot_batches"]) >= 1
        batch = updated_bill["kot_batches"][-1]
        assert "number" in batch
        assert "sent_at" in batch
        assert "sent_by" in batch
        
        # Verify items have kot_batch assigned
        sent_items = [i for i in updated_bill["items"] if i.get("sent_to_kitchen")]
        assert len(sent_items) > 0
        for item in sent_items:
            assert item["kot_batch"] is not None
            assert item["sent_to_kitchen"] == True
        
        print(f"✓ KOT batch #{batch['number']} created with timestamp")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_send_kot_second_batch(self):
        """Add more items and send-kot again → becomes kot_batch 2"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T5", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add items and send first KOT
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        
        # Add more items
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[1]["id"], "quantity": 1, "notes": "Second batch item"}]
        }, headers=auth_header(captain_token))
        
        # Send KOT again
        response = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        assert response.status_code == 200
        updated_bill = response.json()
        
        assert len(updated_bill["kot_batches"]) == 2
        new_batch = updated_bill["kot_batches"][-1]
        assert new_batch["number"] == 2
        print(f"✓ Second KOT batch #{new_batch['number']} created")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_edit_item_qty_and_notes(self):
        """PUT /api/bills/{id}/items/{item_id} supports qty/notes update"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T6", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add item
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1, "notes": "Original note"}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        
        # Edit qty and notes
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}", json={
            "quantity": 3, "notes": "Updated note"
        }, headers=auth_header(captain_token))
        
        assert response.status_code == 200
        updated_item = next(i for i in response.json()["items"] if i["id"] == item_id)
        assert updated_item["quantity"] == 3
        assert updated_item["notes"] == "Updated note"
        print("✓ Item qty and notes updated")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_edit_item_swap(self):
        """PUT /api/bills/{id}/items/{item_id} supports swap (change menu_item_id)"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T7", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add item
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        original_name = add_resp.json()["items"][-1]["name"]
        
        # Swap to different menu item
        new_menu_item = menu[2]
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}", json={
            "menu_item_id": new_menu_item["id"]
        }, headers=auth_header(captain_token))
        
        assert response.status_code == 200
        updated_item = next(i for i in response.json()["items"] if i["id"] == item_id)
        assert updated_item["menu_item_id"] == new_menu_item["id"]
        assert updated_item["name"] == new_menu_item["name"]
        print(f"✓ Item swapped from {original_name} to {new_menu_item['name']}")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_delete_pending_item(self):
        """DELETE /api/bills/{id}/items/{item_id} removes pending items"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T8", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add item
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        
        # Delete item
        response = requests.delete(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}", headers=auth_header(captain_token))
        assert response.status_code == 200
        
        # Verify item removed
        remaining_ids = [i["id"] for i in response.json()["items"]]
        assert item_id not in remaining_ids
        print("✓ Pending item deleted")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_delete_sent_item_marks_cancelled(self):
        """DELETE /api/bills/{id}/items/{item_id} marks sent items as cancelled"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T9", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add and send item
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        
        # Delete sent item
        response = requests.delete(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}", headers=auth_header(captain_token))
        assert response.status_code == 200
        
        # Verify item marked cancelled (not removed)
        item = next((i for i in response.json()["items"] if i["id"] == item_id), None)
        assert item is not None
        assert item["chef_status"] == "cancelled"
        print("✓ Sent item marked as cancelled")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_chef_status_update(self):
        """PUT /api/bills/{id}/items/{item_id}/chef with chef_status=ready/cancelled/pending"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T10", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add item and send KOT
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        
        # Chef marks ready
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "ready"
        }, headers=auth_header(chef_token))
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == item_id)
        assert item["chef_status"] == "ready"
        print("✓ Chef marked item ready")
        
        # Captain can also update chef status
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "pending"
        }, headers=auth_header(captain_token))
        assert response.status_code == 200
        print("✓ Captain can update chef status")
        
        # Owner can also update chef status
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "cancelled"
        }, headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner can update chef status")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_payment_by_cashier(self):
        """POST /api/bills/{id}/payment by cashier with method upi/cash/card"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        cashier_token = get_token(CASHIER_EMAIL, CASHIER_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_BILL_T11", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add items
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 2}]
        }, headers=auth_header(captain_token))
        bill = add_resp.json()
        
        # Cashier records payment
        response = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/payment", json={
            "method": "upi", "amount": bill["total"]
        }, headers=auth_header(cashier_token))
        
        assert response.status_code == 200
        paid_bill = response.json()
        assert paid_bill["status"] == "closed"
        assert paid_bill["payment"]["status"] == "received"
        assert paid_bill["payment"]["method"] == "upi"
        print(f"✓ Cashier recorded UPI payment of ₹{paid_bill['payment']['amount_received']}")
        
        # Cleanup - bill is closed, just delete table
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))


class TestRBAC:
    """Role-based access control tests"""
    
    def test_captain_cannot_post_inventory(self):
        """Captain cannot POST /api/inventory"""
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        response = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_Item", "unit": "kg", "quantity": 10, "low_threshold": 2
        }, headers=auth_header(captain_token))
        assert response.status_code == 403
        print("✓ Captain cannot POST /inventory (403)")
    
    def test_chef_cannot_post_payment(self):
        """Chef cannot POST /api/bills/{id}/payment"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        
        # Get tables and create a bill
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_header(captain_token)).json()
        
        # Create test table
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_RBAC_T1", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Chef tries to record payment
        response = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/payment", json={
            "method": "cash", "amount": 100
        }, headers=auth_header(chef_token))
        assert response.status_code == 403
        print("✓ Chef cannot POST /payment (403)")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_cashier_cannot_post_bills(self):
        """Cashier cannot POST /api/bills"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        cashier_token = get_token(CASHIER_EMAIL, CASHIER_PASSWORD)
        
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_header(captain_token)).json()
        
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "table_id": tables[0]["id"]
        }, headers=auth_header(cashier_token))
        assert response.status_code == 403
        print("✓ Cashier cannot POST /bills (403)")


class TestInventory:
    """Inventory endpoint tests"""
    
    def test_list_inventory_owner_captain(self):
        """GET /api/inventory accessible by owner and captain"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        
        # Owner can access
        response = requests.get(f"{BASE_URL}/api/inventory", headers=auth_header(owner_token))
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) >= 10, f"Expected at least 10 seeded items, got {len(items)}"
        print(f"✓ Owner can list inventory ({len(items)} items)")
        
        # Captain can access
        response = requests.get(f"{BASE_URL}/api/inventory", headers=auth_header(captain_token))
        assert response.status_code == 200
        print("✓ Captain can list inventory")
        
        # Chef cannot access
        response = requests.get(f"{BASE_URL}/api/inventory", headers=auth_header(chef_token))
        assert response.status_code == 403
        print("✓ Chef cannot list inventory (403)")
    
    def test_inventory_crud_owner_only(self):
        """POST/PUT/DELETE /api/inventory owner-only"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create
        response = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_Basil", "unit": "kg", "quantity": 5, "low_threshold": 1, "category": "herbs"
        }, headers=auth_header(owner_token))
        assert response.status_code == 200
        item = response.json()
        assert item["name"] == "TEST_Basil"
        print(f"✓ Owner created inventory item: {item['id']}")
        
        # Update
        response = requests.put(f"{BASE_URL}/api/inventory/{item['id']}", json={
            "name": "TEST_Basil", "unit": "kg", "quantity": 10, "low_threshold": 2, "category": "herbs"
        }, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert response.json()["quantity"] == 10
        print("✓ Owner updated inventory item")
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner deleted inventory item")


class TestGuard:
    """Geofence / Access Guard tests"""
    
    def test_guard_check_allowed_when_disabled(self):
        """POST /api/guard/check returns allowed=true when features disabled"""
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        response = requests.post(f"{BASE_URL}/api/guard/check", json={
            "lat": 12.9716, "lng": 77.5946
        }, headers=auth_header(captain_token))
        
        assert response.status_code == 200
        data = response.json()
        assert data["allowed"] == True
        assert data["geo_ok"] == True
        assert data["ip_ok"] == True
        print("✓ Guard check returns allowed=true when geofence disabled")
    
    def test_guard_check_owner_exempt(self):
        """Owner is exempt from geofence checks"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        response = requests.post(f"{BASE_URL}/api/guard/check", json={
            "lat": 0, "lng": 0  # Far from restaurant
        }, headers=auth_header(owner_token))
        
        assert response.status_code == 200
        data = response.json()
        assert data["allowed"] == True
        # Owner is exempt, reason could be "exempt" or "ok"
        print(f"✓ Owner is exempt from guard check (reason: {data['reason']})")


class TestAnalytics:
    """Analytics endpoint tests"""
    
    def test_analytics_summary_new_fields(self):
        """GET /api/analytics/summary returns new fields"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/analytics/summary", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        
        # Verify new fields
        assert "orders_count" in data  # paid bills
        assert "open_bills" in data
        assert "pending_amount" in data
        assert "payment_split" in data
        assert "cash" in data["payment_split"]
        assert "upi" in data["payment_split"]
        assert "card" in data["payment_split"]
        
        print(f"✓ Analytics summary: orders={data['orders_count']}, open_bills={data['open_bills']}, pending=₹{data['pending_amount']}")
        print(f"  Payment split: cash=₹{data['payment_split']['cash']}, upi=₹{data['payment_split']['upi']}, card=₹{data['payment_split']['card']}")
    
    def test_analytics_export_csv_bill_format(self):
        """GET /api/analytics/export CSV contains bill rows"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/analytics/export", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        csv_content = response.text
        # Check for bill-specific columns
        assert "Bill#" in csv_content
        assert "Captain" in csv_content
        assert "Payment" in csv_content
        assert "Method" in csv_content
        print("✓ CSV export contains Bill#, Captain, Payment, Method columns")


class TestSettings:
    """Settings endpoint tests"""
    
    def test_settings_geofence_fields(self):
        """PUT /api/settings saves geofence fields"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        # Get current settings
        current = requests.get(f"{BASE_URL}/api/settings").json()
        
        # Update with geofence settings
        update_data = {
            "cgst_rate": current["cgst_rate"],
            "sgst_rate": current["sgst_rate"],
            "restaurant_name": current.get("restaurant_name", "Spice Route"),
            "address": current.get("address", ""),
            "phone": current.get("phone", ""),
            "gstin": current.get("gstin", ""),
            "geofence_enabled": True,
            "ip_check_enabled": True,
            "allowed_ips": ["192.168.1.0/24", "10.0.0.1"],
            "restaurant_lat": 12.9716,
            "restaurant_lng": 77.5946,
            "geofence_radius_m": 300
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=update_data, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        
        assert data["geofence_enabled"] == True
        assert data["ip_check_enabled"] == True
        assert "192.168.1.0/24" in data["allowed_ips"]
        assert data["geofence_radius_m"] == 300
        print("✓ Settings saved with geofence/IP whitelist fields")
        
        # Reset to disabled
        update_data["geofence_enabled"] = False
        update_data["ip_check_enabled"] = False
        update_data["allowed_ips"] = []
        requests.put(f"{BASE_URL}/api/settings", json=update_data, headers=auth_header(owner_token))
        print("✓ Settings reset to disabled")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
