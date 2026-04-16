from dotenv import load_dotenv, find_dotenv
import os
from supabase import create_client, Client

load_dotenv(find_dotenv())

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    # We allow this for initialization, but it will fail on query.
    # In production, these should always be set.
    print("Warning: SUPABASE_URL or SUPABASE_KEY not set.")

supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

def get_supabase():
    return supabase
