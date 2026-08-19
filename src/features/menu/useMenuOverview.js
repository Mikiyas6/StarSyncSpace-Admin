import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ensureMenuCategories,
  getMenuOverview,
} from "../../services/apiMenu";

export const menuQueryKey = ["menuOverview"];

export function useMenuOverview() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: menuQueryKey,
    queryFn: getMenuOverview,
  });

  const { mutate: ensureCategories } = useMutation({
    mutationFn: ensureMenuCategories,
    onSuccess: ({ seeded }) => {
      if (seeded) {
        toast.success("Created Food & Drinks categories");
        queryClient.invalidateQueries({ queryKey: menuQueryKey });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return { ...query, ensureCategories };
}