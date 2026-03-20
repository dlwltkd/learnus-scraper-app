import re


def test_get_version_returns_latest(client):
    resp = client.get("/version")
    assert resp.status_code == 200
    data = resp.json()
    assert "version" in data
    assert "force_update_min" in data


def test_version_format_is_semver(client):
    resp = client.get("/version")
    version = resp.json()["version"]
    assert re.match(r"^\d+\.\d+\.\d+$", version), f"Version '{version}' is not semver"


def test_force_update_min_is_present(client):
    resp = client.get("/version")
    val = resp.json()["force_update_min"]
    assert val is not None
    assert isinstance(val, str)
    assert len(val) > 0
