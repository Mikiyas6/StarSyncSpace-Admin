import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { duplicateMenuItem } from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useDuplicateMenuItem() {
  const queryClient = useQueryClient();

  const { isLoading: isDuplicating, mutate: duplicateMenuItemMutation } =
    useMutation({
      mutationFn: duplicateMenuItem,
      onSuccess: (item) => {
        toast.success(`${item.name} created`);
        queryClient.invalidateQueries({ queryKey: menuQueryKey });
      },
      onError: (err) => toast.error(err.message),
    });

  return { isDuplicating, duplicateMenuItem: duplicateMenuItemMutation };
}