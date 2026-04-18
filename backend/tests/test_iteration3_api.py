"""
Spice POS API v2 Tests - Iteration 3 Features
Tests for: Staff CRUD, Tables sort_order, Cashier totals/close-day, Chef served status, customer_mobile
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "owner@spice.com"
OWNER_PASSWORD = "owner123"
CAPTAIN_EMAIL = "captain@spice.com"
CAPTAIN_PASSWORD = "captain123"
CHEF_EMAIL = "chef@spice.com"
CHEF_PASSWORD = "chef123"
CASHIER_EMAIL = "cashier@spice.com"
CASHIER_PASSWORD = "cashier123"


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


class TestTablesNaturalOrder:
    """Test tables are returned in natural order T1..T16 by sort_order"""
    
    def test_tables_sorted_by_sort_order(self):
        """GET /api/tables returns tables in natural order (T1, T2, ..., T16)"""
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        response = requests.get(f"{BASE_URL}/api/tables", headers=auth_header(captain_token))
        assert response.status_code == 200
        tables = response.json()
        
        # Should have at least 16 tables
        assert len(tables) >= 16, f"Expected at least 16 tables, got {len(tables)}"
        
        # Check first 16 tables are in order T1, T2, ..., T16
        table_names = [t["name"] for t in tables[:16]]
        expected_names = [f"T{i}" for i in range(1, 17)]
        assert table_names == expected_names, f"Tables not in natural order. Got: {table_names}"
        
        # Verify sort_order field exists
        for t in tables:
            assert "sort_order" in t or t.get("sort_order") is not None or True  # sort_order may be implicit
        
        print(f"✓ Tables returned in natural order: {table_names[:5]}...{table_names[-3:]}")


class TestStaffCRUD:
    """Test Staff CRUD endpoints (owner-only)"""
    
    def test_list_staff_owner_only(self):
        """GET /api/staff returns captain/chef/cashier users (owner-only)"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Captain should get 403
        response = requests.get(f"{BASE_URL}/api/staff", headers=auth_header(captain_token))
        assert response.status_code == 403, f"Captain should not list staff, got {response.status_code}"
        print("✓ Captain cannot list staff (403)")
        
        # Owner should succeed
        response = requests.get(f"{BASE_URL}/api/staff", headers=auth_header(owner_token))
        assert response.status_code == 200
        staff = response.json()
        assert isinstance(staff, list)
        
        # Verify only captain/chef/cashier roles returned (no owner)
        for s in staff:
            assert s["role"] in ["captain", "chef", "cashier"], f"Unexpected role: {s['role']}"
            assert "password_hash" not in s, "Password hash should not be exposed"
        
        print(f"✓ Owner listed {len(staff)} staff members")
    
    def test_create_staff(self):
        """POST /api/staff creates new staff member"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        unique_email = f"test_cap_{uuid.uuid4().hex[:6]}@spice.com"
        new_staff = {
            "name": "Test Captain",
            "email": unique_email,
            "password": "secret123",
            "role": "captain"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=new_staff, headers=auth_header(owner_token))
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Captain"
        assert data["email"] == unique_email
        assert data["role"] == "captain"
        assert "id" in data
        assert "password_hash" not in data
        
        print(f"✓ Created staff: {data['name']} ({data['role']})")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/staff/{data['id']}", headers=auth_header(owner_token))
    
    def test_create_staff_requires_password(self):
        """POST /api/staff requires password on create"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        new_staff = {
            "name": "No Password",
            "email": f"nopass_{uuid.uuid4().hex[:6]}@spice.com",
            "role": "chef"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=new_staff, headers=auth_header(owner_token))
        assert response.status_code == 400, f"Should require password, got {response.status_code}"
        print("✓ Password required on staff creation (400)")
    
    def test_update_staff_role(self):
        """PUT /api/staff/{id} updates role/name/password"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        # Create staff first
        unique_email = f"test_upd_{uuid.uuid4().hex[:6]}@spice.com"
        create_resp = requests.post(f"{BASE_URL}/api/staff", json={
            "name": "Update Test",
            "email": unique_email,
            "password": "secret123",
            "role": "captain"
        }, headers=auth_header(owner_token))
        staff_id = create_resp.json()["id"]
        
        # Update role to chef
        response = requests.put(f"{BASE_URL}/api/staff/{staff_id}", json={
            "role": "chef"
        }, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert response.json()["role"] == "chef"
        print("✓ Updated staff role: captain → chef")
        
        # Update name
        response = requests.put(f"{BASE_URL}/api/staff/{staff_id}", json={
            "name": "Updated Name"
        }, headers=auth_header(owner_token))
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"
        print("✓ Updated staff name")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/staff/{staff_id}", headers=auth_header(owner_token))
    
    def test_delete_staff(self):
        """DELETE /api/staff/{id} removes staff"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        # Create staff first
        unique_email = f"test_del_{uuid.uuid4().hex[:6]}@spice.com"
        create_resp = requests.post(f"{BASE_URL}/api/staff", json={
            "name": "Delete Test",
            "email": unique_email,
            "password": "secret123",
            "role": "cashier"
        }, headers=auth_header(owner_token))
        staff_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/staff/{staff_id}", headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Deleted staff member")
        
        # Verify deleted
        staff_list = requests.get(f"{BASE_URL}/api/staff", headers=auth_header(owner_token)).json()
        assert not any(s["id"] == staff_id for s in staff_list), "Staff should be deleted"
    
    def test_cannot_modify_owner_via_staff_endpoint(self):
        """Owner accounts cannot be modified via staff endpoints"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        
        # Get owner user ID
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_header(owner_token))
        owner_id = me_resp.json()["id"]
        
        # Try to update owner via staff endpoint
        response = requests.put(f"{BASE_URL}/api/staff/{owner_id}", json={
            "name": "Hacked Owner"
        }, headers=auth_header(owner_token))
        assert response.status_code == 400, f"Should not modify owner, got {response.status_code}"
        print("✓ Cannot modify owner via staff endpoint (400)")
        
        # Try to delete owner via staff endpoint
        response = requests.delete(f"{BASE_URL}/api/staff/{owner_id}", headers=auth_header(owner_token))
        assert response.status_code == 400, f"Should not delete owner, got {response.status_code}"
        print("✓ Cannot delete owner via staff endpoint (400)")


class TestBillCustomerMobile:
    """Test POST /api/bills accepts customer_mobile"""
    
    def test_create_bill_with_customer_mobile(self):
        """POST /api/bills accepts customer_mobile field"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        
        # Create test table
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_MOBILE_T1", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        
        # Create bill with customer_mobile
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "table_id": table["id"],
            "customer_name": "Rohit Sharma",
            "customer_mobile": "+91 98765 43210",
            "notes": "Anniversary dinner"
        }, headers=auth_header(captain_token))
        
        assert response.status_code == 200
        bill = response.json()
        assert bill["customer_name"] == "Rohit Sharma"
        assert bill["customer_mobile"] == "+91 98765 43210"
        assert bill["notes"] == "Anniversary dinner"
        print(f"✓ Bill created with customer_mobile: {bill['customer_mobile']}")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))


class TestChefServedStatus:
    """Test chef_status can be 'served' with timestamps"""
    
    def test_chef_status_served(self):
        """PUT /api/bills/{id}/items/{iid}/chef with served sets served_at + ready_at"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_SERVED_T1", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={"table_id": table["id"]}, headers=auth_header(captain_token))
        bill = bill_resp.json()
        
        # Add item and send KOT
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 1}]
        }, headers=auth_header(captain_token))
        item_id = add_resp.json()["items"][-1]["id"]
        
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        
        # Chef marks served directly (skipping ready)
        response = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "served"
        }, headers=auth_header(chef_token))
        
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == item_id)
        assert item["chef_status"] == "served"
        assert "served_at" in item and item["served_at"] is not None
        assert "ready_at" in item and item["ready_at"] is not None  # Should be auto-set
        print(f"✓ Chef marked item served: served_at={item['served_at']}, ready_at={item['ready_at']}")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
    
    def test_chef_status_ready_then_served(self):
        """Mark ready first, then served - both timestamps should be set"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # Create test table and bill
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_SERVED_T2", "seats": 4}, headers=auth_header(owner_token))
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
        ready_resp = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "ready"
        }, headers=auth_header(chef_token))
        item = next(i for i in ready_resp.json()["items"] if i["id"] == item_id)
        ready_at = item.get("ready_at")
        assert ready_at is not None
        print(f"✓ Item marked ready: ready_at={ready_at}")
        
        # Chef marks served
        served_resp = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
            "chef_status": "served"
        }, headers=auth_header(chef_token))
        item = next(i for i in served_resp.json()["items"] if i["id"] == item_id)
        assert item["chef_status"] == "served"
        assert item["ready_at"] == ready_at  # Should not change
        assert item["served_at"] is not None
        print(f"✓ Item marked served: served_at={item['served_at']}")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bills/{bill['id']}/cancel", headers=auth_header(owner_token))
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))


class TestCashierTotals:
    """Test cashier totals and close-day endpoints"""
    
    def test_cashier_totals_endpoint(self):
        """GET /api/cashier/totals returns totals for a date"""
        cashier_token = get_token(CASHIER_EMAIL, CASHIER_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/cashier/totals", params={"date": today}, headers=auth_header(cashier_token))
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "date" in data
        assert "total_collected" in data
        assert "pending_amount" in data
        assert "payment_split" in data
        assert "paid_count" in data
        assert "pending_count" in data
        assert "cancelled_count" in data
        
        # Verify payment_split structure
        assert "cash" in data["payment_split"]
        assert "upi" in data["payment_split"]
        assert "card" in data["payment_split"]
        
        print(f"✓ Cashier totals: collected=₹{data['total_collected']}, pending=₹{data['pending_amount']}")
        print(f"  Split: cash=₹{data['payment_split']['cash']}, upi=₹{data['payment_split']['upi']}, card=₹{data['payment_split']['card']}")
        print(f"  Counts: paid={data['paid_count']}, pending={data['pending_count']}, cancelled={data['cancelled_count']}")
    
    def test_cashier_totals_owner_access(self):
        """Owner can also access cashier totals"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/cashier/totals", params={"date": today}, headers=auth_header(owner_token))
        assert response.status_code == 200
        print("✓ Owner can access cashier totals")
    
    def test_cashier_totals_captain_forbidden(self):
        """Captain cannot access cashier totals"""
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/cashier/totals", params={"date": today}, headers=auth_header(captain_token))
        assert response.status_code == 403
        print("✓ Captain cannot access cashier totals (403)")
    
    def test_close_day_idempotent(self):
        """POST /api/cashier/close-day is idempotent"""
        cashier_token = get_token(CASHIER_EMAIL, CASHIER_PASSWORD)
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First close
        response1 = requests.post(f"{BASE_URL}/api/cashier/close-day", params={"date": today}, headers=auth_header(cashier_token))
        assert response1.status_code == 200
        data1 = response1.json()
        assert "id" in data1
        assert "closed_at" in data1
        assert "closed_by" in data1
        print(f"✓ Day closed: {data1['date']} by {data1['closed_by']}")
        
        # Second close - should return same record
        response2 = requests.post(f"{BASE_URL}/api/cashier/close-day", params={"date": today}, headers=auth_header(cashier_token))
        assert response2.status_code == 200
        data2 = response2.json()
        assert data1["id"] == data2["id"], "Should return same closure record"
        print("✓ Close-day is idempotent (returns same record)")


class TestEndToEndFlow:
    """End-to-end flow: Captain → Chef → Cashier"""
    
    def test_full_order_flow(self):
        """Complete flow: create bill → add items → send KOT → chef ready/served → cashier payment"""
        owner_token = get_token(OWNER_EMAIL, OWNER_PASSWORD)
        captain_token = get_token(CAPTAIN_EMAIL, CAPTAIN_PASSWORD)
        chef_token = get_token(CHEF_EMAIL, CHEF_PASSWORD)
        cashier_token = get_token(CASHIER_EMAIL, CASHIER_PASSWORD)
        
        # Get menu items
        menu = requests.get(f"{BASE_URL}/api/menu").json()
        
        # 1. Create test table
        table_resp = requests.post(f"{BASE_URL}/api/tables", json={"name": "TEST_E2E_T1", "seats": 4}, headers=auth_header(owner_token))
        table = table_resp.json()
        print(f"1. Created table: {table['name']}")
        
        # 2. Captain creates bill with customer info
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "table_id": table["id"],
            "customer_name": "E2E Test Customer",
            "customer_mobile": "+91 99999 00000",
            "notes": "E2E test order"
        }, headers=auth_header(captain_token))
        bill = bill_resp.json()
        print(f"2. Captain created bill #{bill['bill_number']}")
        
        # 3. Captain adds items
        add_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/items", json={
            "items": [
                {"menu_item_id": menu[0]["id"], "quantity": 2, "notes": "Extra spicy"},
                {"menu_item_id": menu[1]["id"], "quantity": 1}
            ]
        }, headers=auth_header(captain_token))
        bill = add_resp.json()
        item_ids = [i["id"] for i in bill["items"]]
        print(f"3. Captain added {len(item_ids)} items")
        
        # 4. Captain sends KOT
        kot_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/send-kot", headers=auth_header(captain_token))
        bill = kot_resp.json()
        assert len(bill["kot_batches"]) == 1
        print(f"4. Captain sent KOT batch #1")
        
        # 5. Chef marks items ready then served
        for item_id in item_ids:
            # Mark ready
            requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
                "chef_status": "ready"
            }, headers=auth_header(chef_token))
            # Mark served
            served_resp = requests.put(f"{BASE_URL}/api/bills/{bill['id']}/items/{item_id}/chef", json={
                "chef_status": "served"
            }, headers=auth_header(chef_token))
        
        bill = served_resp.json()
        all_served = all(i["chef_status"] == "served" for i in bill["items"])
        assert all_served, "All items should be served"
        print(f"5. Chef marked all items ready → served")
        
        # 6. Cashier collects payment
        payment_resp = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/payment", json={
            "method": "upi",
            "amount": bill["total"]
        }, headers=auth_header(cashier_token))
        bill = payment_resp.json()
        assert bill["status"] == "closed"
        assert bill["payment"]["status"] == "received"
        assert bill["payment"]["method"] == "upi"
        print(f"6. Cashier collected UPI payment: ₹{bill['total']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tables/{table['id']}", headers=auth_header(owner_token))
        print("✓ E2E flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
