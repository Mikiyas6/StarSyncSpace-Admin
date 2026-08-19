import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { deleteMenuItem } from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  const { isLoading: isDeleting, mutate: deleteMenuItemMutation } =
    useMutation({
      mutationFn: deleteMenuItem,
      onSuccess: () => {
        toast.success("Menu item deleted");
        queryClient.invalidateQueries({ queryKey: menuQueryKey });
      },
      onError: (err) => toast.error(err.message),
    });

  return { isDeleting, deleteMenuItem: deleteMenuItemMutation };
}