REVOKE ALL ON FUNCTION private.kick_generation_worker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kick_generation_worker(uuid) TO service_role;