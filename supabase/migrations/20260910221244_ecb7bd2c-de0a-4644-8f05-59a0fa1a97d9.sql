CREATE OR REPLACE FUNCTION public.arm_generation_sweeper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.arm_generation_sweeper();
END;
$$;

REVOKE ALL ON FUNCTION public.arm_generation_sweeper() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arm_generation_sweeper() FROM anon;
REVOKE ALL ON FUNCTION public.arm_generation_sweeper() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.arm_generation_sweeper() TO service_role;