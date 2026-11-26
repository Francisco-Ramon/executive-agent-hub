-- Grant table usage and full permissions to authenticated and anon roles

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Tasks
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own tasks all" ON public.tasks;
CREATE POLICY "own tasks all" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Conversations
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own conversations all" ON public.conversations;
CREATE POLICY "own conversations all" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat Messages
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own chat_messages all" ON public.chat_messages;
CREATE POLICY "own chat_messages all" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Preferences
ALTER TABLE IF EXISTS public.preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prefs all" ON public.preferences;
CREATE POLICY "own prefs all" ON public.preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Books & Notes
ALTER TABLE IF EXISTS public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own books all" ON public.books;
CREATE POLICY "own books all" ON public.books FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notes all" ON public.notes;
CREATE POLICY "own notes all" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Documents & Document Chunks
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own documents all" ON public.documents;
CREATE POLICY "own documents all" ON public.documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.document_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own chunks all" ON public.document_chunks;
CREATE POLICY "own chunks all" ON public.document_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp Connections
ALTER TABLE IF EXISTS public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own whatsapp_connections all" ON public.whatsapp_connections;
CREATE POLICY "own whatsapp_connections all" ON public.whatsapp_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
