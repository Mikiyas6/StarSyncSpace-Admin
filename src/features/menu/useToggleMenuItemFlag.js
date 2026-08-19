import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateMenuItem } from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

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
    onSuccess: (_data, { flag }) => {
      toast.success(
        flag === "is_available"
          ? "Availability updated"
          : "Featured status updated"
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: menuQueryKey });
    },
  });

  return { isToggling, toggleFlag };
}