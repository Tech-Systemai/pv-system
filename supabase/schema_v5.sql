-- Phase 1 Database Expansion
-- Add tables for sales_logs, audit_logs, and contracts

-- 1. Sales Logs (Used for Revenue and Collections tracking)
CREATE TABLE IF NOT EXISTS public.sales_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Sale', 'Collection')),
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Verified, Rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for sales_logs
ALTER TABLE public.sales_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales can view their own logs" 
    ON public.sales_logs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Management can view all sales logs" 
    ON public.sales_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'supervisor', 'accountant')));

CREATE POLICY "Sales can insert their own logs" 
    ON public.sales_logs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- 2. Audit Logs (System tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- e.g., 'profile', 'payroll', 'ticket'
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owner and admin can view audit logs" 
    ON public.audit_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Authenticated users can insert audit logs via triggers/functions" 
    ON public.audit_logs FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- 3. Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Signed, Expired
    effective_date DATE,
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts" 
    ON public.contracts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Management can manage all contracts" 
    ON public.contracts FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'hr')));
