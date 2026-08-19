import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  reorderMenuItems,
  reorderMenuSections,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useMenuOrder() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: menuQueryKey });

  const { isLoading: isReorderingSections, mutate: reorderSections } =
    useMutation({
      mutationFn: reorderMenuSections,
      onSuccess: () => {
        toast.success("Section order saved");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  const { isLoading: isReorderingItems, mutate: reorderItems } = useMutation({
    mutationFn: reorderMenuItems,
    onSuccess: () => {
      toast.success("Item order saved");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    isReorderingSections,
    reorderSections,
    isReorderingItems,
    reorderItems,
  };
}