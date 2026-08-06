"""
Lightweight auth guard for the Flask API.

The frontend authenticates directly against Supabase Auth (sign up / sign in
happen in the browser via @supabase/supabase-js). Every API request then
carries the resulting access token as:

    Authorization: Bearer <supabase_access_token>

require_auth() verifies that token against Supabase (which also confirms it
hasn't expired / been revoked) and exposes the authenticated user as
`flask.g.user` for the rest of the request. Routes use `g.user.id` instead of
trusting a client-supplied user id.
"""

from functools import wraps
from flask import request, jsonify, g
from supabase_client import get_client


def get_current_user():
    """Verify the bearer token from the Authorization header. Returns the
    Supabase user object, or None if missing/invalid."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    try:
        client = get_client()
        result = client.auth.get_user(token)
        return result.user if result else None
    except Exception:
        return None


def require_auth(fn):
    """Decorator: rejects the request with 401 unless a valid Supabase
    session token is present. On success, sets g.user and g.access_token."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required"}), 401
        g.user = user
        g.access_token = request.headers.get("Authorization", "").split(" ", 1)[1].strip()
        return fn(*args, **kwargs)

    return wrapper
