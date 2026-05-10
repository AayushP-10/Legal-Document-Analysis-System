CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed')),
  folder TEXT,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow all insert on documents" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on documents" ON public.documents FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on documents" ON public.documents FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('legal-documents', 'legal-documents', true);

CREATE POLICY "Allow public read on legal-documents" ON storage.objects FOR SELECT USING (bucket_id = 'legal-documents');
CREATE POLICY "Allow public upload on legal-documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'legal-documents');
CREATE POLICY "Allow public update on legal-documents" ON storage.objects FOR UPDATE USING (bucket_id = 'legal-documents');
CREATE POLICY "Allow public delete on legal-documents" ON storage.objects FOR DELETE USING (bucket_id = 'legal-documents');