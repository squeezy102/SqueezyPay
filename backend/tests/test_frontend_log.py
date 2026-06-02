"""
Tests for the /api/frontend-log endpoint.

Coverage:
- POST with full error payload returns 204
- POST with minimal payload (message only) returns 204
- POST with warning level returns 204
"""


def test_log_frontend_error(client):
    response = client.post("/api/frontend-log/", json={
        "level": "ERROR",
        "message": "useEffect is not defined",
        "detail": "ReferenceError: useEffect is not defined\n    at NavBar.jsx:122",
        "component": "\n    at AdminLink\n    at Sidebar\n    at AppShell",
    })
    assert response.status_code == 204


def test_log_frontend_minimal(client):
    response = client.post("/api/frontend-log/", json={
        "message": "Something crashed",
    })
    assert response.status_code == 204


def test_log_frontend_warning(client):
    response = client.post("/api/frontend-log/", json={
        "level": "WARNING",
        "message": "Component rendered with missing prop",
        "component": "BillCard",
    })
    assert response.status_code == 204
