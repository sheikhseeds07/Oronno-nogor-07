-- Live server uses the anon key; allow it to save ad-click tracking on checkout intents.
grant execute on function public.set_landing_intent_tracking(uuid,text,text,text,text) to anon;
