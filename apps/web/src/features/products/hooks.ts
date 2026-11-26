import { useQuery } from '@tanstack/react-query';
import { getProduct, listProducts, type Product } from './api';

export const productsKey = (workspaceId: string | undefined) => ['products', workspaceId] as const;
export const productKey = (id: string | undefined) => ['product', id] as const;

const busy = (p: Product | null | undefined) =>
  p?.cutout_status === 'pending' || p?.cutout_status === 'processing';

/** Product list. Refreshes every 2 s while any cutout is still being made. */
export function useProducts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: productsKey(workspaceId),
    queryFn: () => listProducts(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: (q) => (q.state.data?.some(busy) ? 2000 : false),
  });
}

/** One product. Refreshes every 1.5 s while its cutout is being made. */
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKey(id),
    queryFn: () => getProduct(id!),
    enabled: Boolean(id),
    refetchInterval: (q) => (busy(q.state.data) ? 1500 : false),
  });
}
