import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateMenuItem } from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";
import { refreshPublicMenu } from "./refreshPublicMenu";

// Optimistic availability/featured toggles from the menu table.
export function useToggleMenuItemFlag() {
  const queryClient = useQueryClient();

  const { isLoading: isToggling, mutate: toggleFlag } = useMutation({
    mutationFn: ({ id, flag, value }) =>
      updateMenuItem(id, { [flag]: value }),
    onMutate: async ({ id, flag }) => {
      await queryClient.cancelQueries({ queryKey: menuQueryKey });
      const previous = queryClient.getQueryData(menuQueryKey);
      queryClient.setQueryData(menuQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item) =>
            item.id === id ? { ...item, [flag]: !item[flag] } : item
          ),
        };
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(menuQueryKey, context.previous);
      toast.error(err.message);
    },
    /* The value, not just the flag: "Hidden" and "Back on the menu" are
       opposite outcomes of one switch, and a toast that says "Visibility
       updated" for both leaves you checking the row to find out which
       way it went. */
    onSuccess: (_data, { flag, value }) => {
      const said = {
        is_available: value ? "Back on sale" : "Marked sold out",
        is_hidden: value
          ? "Hidden — it is off the customer menu and still here"
          : "Back on the customer menu",
        is_featured: value ? "Featured" : "No longer featured",
      };
      toast.success(said[flag] ?? "Menu item updated");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: menuQueryKey });
      refreshPublicMenu();
    },
  });

  return { isToggling, toggleFlag };
}