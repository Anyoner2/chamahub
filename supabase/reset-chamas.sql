begin;

-- Remove dependent requests first, then clear every chama record.
delete from public.chama_join_requests;
delete from public.chamas;

commit;
