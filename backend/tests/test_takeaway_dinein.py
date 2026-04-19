"""
Spice POS - Takeaway vs Dine-In order flow tests (Iteration 4)
Verifies: order_type field, validation, filtering, full pipelines, tables,
analytics & cashier aggregation regressions.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')

OWNER = ("owner@spice.com", "owner123")
CAPTAIN = ("captain@spice.com", "captain123")
CHEF = ("chef@spice.com", "chef123")
CASHIER = ("cashier@spice.com", "cashier123")


def _tok(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "owner": _tok(*OWNER),
        "captain": _tok(*CAPTAIN),
        "chef": _tok(*CHEF),
        "cashier": _tok(*CASHIER),
    }


@pytest.fixture(scope="module")
def menu():
    return requests.get(f"{BASE_URL}/api/menu").json()


@pytest.fixture(scope="module")
def a_table(tokens):
    # pick an unoccupied seeded table
    tables = requests.get(f"{BASE_URL}/api/tables", headers=_h(tokens["captain"])).json()
    free = next((t for t in tables if t["status"] == "available"), None)
    if not free:
        # create a fresh table
        r = requests.post(f"{BASE_URL}/api/tables",
                          json={"name": f"TEST_T_{uuid.uuid4().hex[:4]}", "seats": 4},
                          headers=_h(tokens["owner"]))
        return r.json()
    return free


# ---- Auth regression ----
def test_all_four_roles_login():
    for email, pw in [OWNER, CAPTAIN, CHEF, CASHIER]:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, f"{email} login failed"
        body = r.json()
        assert "token" in body and "user" in body
        assert body["user"]["email"] == email


# ---- Takeaway bill creation ----
def test_create_takeaway_bill(tokens):
    r = requests.post(f"{BASE_URL}/api/bills",
                      json={"order_type": "takeaway",
                            "customer_name": "TEST_Ravi",
                            "customer_mobile": "9999999999"},
                      headers=_h(tokens["captain"]))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["order_type"] == "takeaway"
    assert b["table_name"] == "TAKEAWAY"
    assert b["table_id"] is None
    assert b["status"] == "open"
    # verify persisted via GET
    g = requests.get(f"{BASE_URL}/api/bills/{b['id']}", headers=_h(tokens["captain"]))
    assert g.status_code == 200
    assert g.json()["table_name"] == "TAKEAWAY"


# ---- Dine-in bill creation ----
def test_create_dinein_bill(tokens, a_table):
    r = requests.post(f"{BASE_URL}/api/bills",
                      json={"order_type": "dine_in", "table_id": a_table["id"],
                            "customer_name": "TEST_Dine"},
                      headers=_h(tokens["captain"]))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["order_type"] == "dine_in"
    assert b["table_id"] == a_table["id"]
    assert b["table_name"] == a_table["name"]
    assert b["status"] == "open"


# ---- Dine-in without table_id → 400 ----
def test_dinein_missing_table_id_400(tokens):
    r = requests.post(f"{BASE_URL}/api/bills",
                      json={"order_type": "dine_in"},
                      headers=_h(tokens["captain"]))
    assert r.status_code == 400
    assert "table" in r.text.lower()


# ---- Filtering bills by order_type ----
def test_list_bills_filter_order_type(tokens):
    r1 = requests.get(f"{BASE_URL}/api/bills?order_type=takeaway",
                      headers=_h(tokens["captain"]))
    assert r1.status_code == 200
    for b in r1.json():
        assert b.get("order_type") == "takeaway"
        assert b.get("table_id") is None
        assert b.get("table_name") == "TAKEAWAY"

    r2 = requests.get(f"{BASE_URL}/api/bills?order_type=dine_in",
                      headers=_h(tokens["captain"]))
    assert r2.status_code == 200
    for b in r2.json():
        assert b.get("order_type") == "dine_in"
        assert b.get("table_id") is not None


# ---- Full takeaway pipeline ----
def test_takeaway_full_pipeline(tokens, menu):
    cap, chef, cash, own = tokens["captain"], tokens["chef"], tokens["cashier"], tokens["owner"]

    bill = requests.post(f"{BASE_URL}/api/bills",
                         json={"order_type": "takeaway",
                               "customer_name": "TEST_Pipe",
                               "customer_mobile": "9000000001"},
                         headers=_h(cap)).json()
    bid = bill["id"]

    # add items
    r = requests.post(f"{BASE_URL}/api/bills/{bid}/items",
                      json={"items": [{"menu_item_id": menu[0]["id"], "quantity": 2},
                                      {"menu_item_id": menu[1]["id"], "quantity": 1}]},
                      headers=_h(cap))
    assert r.status_code == 200
    bill = r.json()
    assert len(bill["items"]) == 2
    item_ids = [i["id"] for i in bill["items"]]

    # send KOT
    r = requests.post(f"{BASE_URL}/api/bills/{bid}/send-kot", headers=_h(cap))
    assert r.status_code == 200
    bill = r.json()
    assert len(bill["kot_batches"]) == 1
    for it in bill["items"]:
        assert it["sent_to_kitchen"] is True

    # chef ready → served
    for iid in item_ids:
        r = requests.put(f"{BASE_URL}/api/bills/{bid}/items/{iid}/chef",
                         json={"chef_status": "ready"}, headers=_h(chef))
        assert r.status_code == 200
        r = requests.put(f"{BASE_URL}/api/bills/{bid}/items/{iid}/chef",
                         json={"chef_status": "served"}, headers=_h(chef))
        assert r.status_code == 200

    # payment (cash)
    total = r.json()["total"]
    assert total > 0
    r = requests.post(f"{BASE_URL}/api/bills/{bid}/payment",
                      json={"method": "cash", "amount": total}, headers=_h(cash))
    assert r.status_code == 200
    paid = r.json()
    assert paid["status"] == "closed"
    assert paid["payment"]["status"] == "received"
    assert paid["payment"]["method"] == "cash"

    # verify persistence
    g = requests.get(f"{BASE_URL}/api/bills/{bid}", headers=_h(own)).json()
    assert g["status"] == "closed"
    assert g["order_type"] == "takeaway"


# ---- Full dine-in pipeline (simpler, validates no regression) ----
def test_dinein_full_pipeline(tokens, menu):
    own = tokens["owner"]
    cap, chef, cash = tokens["captain"], tokens["chef"], tokens["cashier"]
    # fresh table just for this test
    t = requests.post(f"{BASE_URL}/api/tables",
                     json={"name": f"TEST_DI_{uuid.uuid4().hex[:4]}", "seats": 2},
                     headers=_h(own)).json()
    try:
        bill = requests.post(f"{BASE_URL}/api/bills",
                             json={"order_type": "dine_in", "table_id": t["id"]},
                             headers=_h(cap)).json()
        bid = bill["id"]
        r = requests.post(f"{BASE_URL}/api/bills/{bid}/items",
                          json={"items": [{"menu_item_id": menu[2]["id"], "quantity": 1}]},
                          headers=_h(cap))
        assert r.status_code == 200
        iid = r.json()["items"][0]["id"]
        requests.post(f"{BASE_URL}/api/bills/{bid}/send-kot", headers=_h(cap))
        requests.put(f"{BASE_URL}/api/bills/{bid}/items/{iid}/chef",
                     json={"chef_status": "ready"}, headers=_h(chef))
        requests.put(f"{BASE_URL}/api/bills/{bid}/items/{iid}/chef",
                     json={"chef_status": "served"}, headers=_h(chef))
        pay = requests.post(f"{BASE_URL}/api/bills/{bid}/payment",
                            json={"method": "upi", "amount": 1000},
                            headers=_h(cash))
        assert pay.status_code == 200
        assert pay.json()["status"] == "closed"
    finally:
        # cleanup table (bill is closed so table not occupied)
        requests.delete(f"{BASE_URL}/api/tables/{t['id']}", headers=_h(own))


# ---- Tables endpoint: takeaway must NOT occupy any table ----
def test_tables_open_bill_attachment(tokens):
    cap, own = tokens["captain"], tokens["owner"]
    # create a takeaway OPEN bill, check no table gets occupied
    ta = requests.post(f"{BASE_URL}/api/bills",
                       json={"order_type": "takeaway", "customer_name": "TEST_NO_OCC"},
                       headers=_h(cap)).json()

    # create dine-in bill on a fresh table
    t = requests.post(f"{BASE_URL}/api/tables",
                     json={"name": f"TEST_OCC_{uuid.uuid4().hex[:4]}", "seats": 2},
                     headers=_h(own)).json()
    dine = requests.post(f"{BASE_URL}/api/bills",
                         json={"order_type": "dine_in", "table_id": t["id"]},
                         headers=_h(cap)).json()

    tables = requests.get(f"{BASE_URL}/api/tables", headers=_h(cap)).json()
    mine = next((x for x in tables if x["id"] == t["id"]), None)
    assert mine is not None
    assert mine["status"] == "occupied"
    assert mine["open_bill"] and mine["open_bill"]["id"] == dine["id"]

    # takeaway bill must not appear as any table's open_bill
    for x in tables:
        if x.get("open_bill"):
            assert x["open_bill"]["id"] != ta["id"], "takeaway bill wrongly attached to table"

    # cleanup
    requests.post(f"{BASE_URL}/api/bills/{ta['id']}/cancel", headers=_h(own))
    requests.post(f"{BASE_URL}/api/bills/{dine['id']}/cancel", headers=_h(own))
    requests.delete(f"{BASE_URL}/api/tables/{t['id']}", headers=_h(own))


# ---- Analytics regression ----
def test_analytics_summary_and_csv(tokens):
    own = tokens["owner"]
    today = datetime.utcnow().strftime("%Y-%m-%d")
    s = requests.get(f"{BASE_URL}/api/analytics/summary?date={today}", headers=_h(own))
    assert s.status_code == 200
    data = s.json()
    for k in ["revenue", "orders_count", "category_sales", "payment_split", "pie"]:
        assert k in data

    c = requests.get(f"{BASE_URL}/api/analytics/export?date={today}", headers=_h(own))
    assert c.status_code == 200
    assert "text/csv" in c.headers.get("content-type", "")
    # header row should include Bill# & Table columns
    first = c.text.splitlines()[0]
    assert "Bill#" in first and "Table" in first


# ---- Cashier totals regression (mixed bills) ----
def test_cashier_totals(tokens):
    cash = tokens["cashier"]
    today = datetime.utcnow().strftime("%Y-%m-%d")
    r = requests.get(f"{BASE_URL}/api/cashier/totals?date={today}", headers=_h(cash))
    assert r.status_code == 200
    d = r.json()
    for k in ["total_collected", "pending_amount", "payment_split", "paid_count",
              "pending_count", "cancelled_count"]:
        assert k in d
    assert set(d["payment_split"].keys()) == {"cash", "upi", "card"}
