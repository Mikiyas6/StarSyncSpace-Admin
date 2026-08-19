import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createMenuSection,
  deleteMenuSection,
  updateMenuSection,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useMenuSections() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: menuQueryKey });

  const { isLoading: isCreating, mutate: createSection } = useMutation({
    mutationFn: createMenuSection,
    onSuccess: () => {
      toast.success("Section created");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isUpdating, mutate: updateSection } = useMutation({
    mutationFn: ({ id, updates }) => updateMenuSection(id, updates),
    onSuccess: () => {
      toast.success("Section updated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isDeleting, mutate: deleteSection } = useMutation({
    mutationFn: deleteMenuSection,
    onSuccess: () => {
      toast.success("Section deleted");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    isCreating,
    createSection,
    isUpdating,
    updateSection,
    isDeleting,
    deleteSection,
  };
}