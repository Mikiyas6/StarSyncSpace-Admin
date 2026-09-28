import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { deleteMenuItem } from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";
import { refreshPublicMenu } from "./refreshPublicMenu";

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  const { isLoading: isDeleting, mutate: deleteMenuItemMutation } =
    useMutation({
      mutationFn: deleteMenuItem,
      /* Two different outcomes, and the toast has to say which: an item
         that has ever been stocked or sold is archived rather than
         deleted, so its sales history survives. Saying "deleted" either
         way would be a lie the next stock report contradicts. Both are
         off the menu and out of every room's list, which is the part
         that is the same and the part people are watching for. */
      onSuccess: (result) => {
        toast.success(
          result?.archived
            ? "Removed from the menu and every room — its sales history is kept"
            : "Menu item deleted"
        );
        queryClient.invalidateQueries({ queryKey: menuQueryKey });
        /* The rooms' stock lists changed too, and the Inventory screen
           has its own cache: without this the item it just cleared is
           still sitting there at 0 until something else refetches. */
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["low-stock"] });
        queryClient.invalidateQueries({ queryKey: ["stockable-items"] });
        refreshPublicMenu();
      },
      onError: (err) => toast.error(err.message),
    });

  return { isDeleting, deleteMenuItem: deleteMenuItemMutation };
}