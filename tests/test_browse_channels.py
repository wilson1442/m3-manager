import sys
from pathlib import Path

# Make backend/server.py importable. server.py calls load_dotenv on backend/.env
# at import time and uses a lazy Motor client, so no DB connection is required.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import server


def test_group_channels_by_category_counts_and_sorts():
    channels = [
        {"name": "ESPN", "group": "Sports", "url": "http://x/1"},
        {"name": "FOX", "group": "Sports", "url": "http://x/2"},
        {"name": "CNN", "group": "News", "url": "http://x/3"},
    ]
    result = server.group_channels_by_category(channels)
    assert result == [
        {"name": "News", "channel_count": 1},
        {"name": "Sports", "channel_count": 2},
    ]


def test_group_channels_by_category_uncategorized_bucket():
    channels = [
        {"name": "NoGroup1", "url": "http://x/1"},
        {"name": "NoGroup2", "group": "", "url": "http://x/2"},
        {"name": "ESPN", "group": "Sports", "url": "http://x/3"},
    ]
    result = server.group_channels_by_category(channels)
    assert {"name": "Uncategorized", "channel_count": 2} in result
    assert {"name": "Sports", "channel_count": 1} in result


def test_group_channels_by_category_empty():
    assert server.group_channels_by_category([]) == []


def test_filter_channels_by_category_matches_group():
    channels = [
        {"name": "ESPN", "group": "Sports", "url": "http://x/1"},
        {"name": "CNN", "group": "News", "url": "http://x/2"},
    ]
    result = server.filter_channels_by_category(channels, "Sports")
    assert [c["name"] for c in result] == ["ESPN"]


def test_filter_channels_by_category_uncategorized_returns_groupless():
    channels = [
        {"name": "NoGroup", "url": "http://x/1"},
        {"name": "Empty", "group": "", "url": "http://x/2"},
        {"name": "ESPN", "group": "Sports", "url": "http://x/3"},
    ]
    result = server.filter_channels_by_category(channels, "Uncategorized")
    assert [c["name"] for c in result] == ["NoGroup", "Empty"]
