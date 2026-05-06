
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intended text;
  r app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, preferred_language)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'fr'));

  intended := COALESCE(NEW.raw_user_meta_data->>'intended_role', 'candidate');
  IF intended = 'recruiter' THEN
    r := 'recruiter'::app_role;
  ELSE
    r := 'candidate'::app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
