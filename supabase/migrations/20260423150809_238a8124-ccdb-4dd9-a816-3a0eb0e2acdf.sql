-- Replace simple owner-only policies with business-member policies

-- Products
DROP POLICY IF EXISTS "own products" ON public.products;
CREATE POLICY "business products" ON public.products
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));

-- Customers
DROP POLICY IF EXISTS "own customers" ON public.customers;
CREATE POLICY "business customers" ON public.customers
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));

-- Sales
DROP POLICY IF EXISTS "own sales" ON public.sales;
CREATE POLICY "business sales" ON public.sales
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));

-- Sale items
DROP POLICY IF EXISTS "own sale items" ON public.sale_items;
CREATE POLICY "business sale items" ON public.sale_items
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));

-- Stock movements
DROP POLICY IF EXISTS "own stock movements" ON public.stock_movements;
CREATE POLICY "business stock movements" ON public.stock_movements
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));

-- Categories
DROP POLICY IF EXISTS "own categories" ON public.categories;
CREATE POLICY "business categories" ON public.categories
FOR ALL USING (user_id = public.get_business_owner(auth.uid()))
WITH CHECK (user_id = public.get_business_owner(auth.uid()));