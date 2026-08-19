import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  deleteMenuItemImage,
  getNextImageSortOrder,
  reorderMenuItemImages,
  setPrimaryMenuItemImage,
  updateMenuItemImage,
  uploadMenuItemImage,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useMenuItemImages(menuItemId) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: menuQueryKey });

  const { isLoading: isUploading, mutate: uploadImage } = useMutation({
    mutationFn: async (file) => {
      const sortOrder = await getNextImageSortOrder(menuItemId);
      return uploadMenuItemImage({ file, menuItemId, sortOrder });
    },
    onSuccess: () => {
      toast.success("Photo uploaded");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isDeleting, mutate: deleteImage } = useMutation({
    mutationFn: deleteMenuItemImage,
    onSuccess: () => {
      toast.success("Photo removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isUpdating, mutate: updateImage } = useMutation({
    mutationFn: ({ id, updates }) => updateMenuItemImage(id, updates),
    onSuccess: () => {
      toast.success("Photo updated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isSettingPrimary, mutate: setPrimary } = useMutation({
    mutationFn: async (imageId) =>
      setPrimaryMenuItemImage(menuItemId, imageId),
    onSuccess: () => {
      toast.success("Primary photo updated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isLoading: isReordering, mutate: reorderImages } = useMutation({
    mutationFn: (ordered) => reorderMenuItemImages(menuItemId, ordered),
    onSuccess: () => {
      toast.success("Photo order saved");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    isUploading,
    uploadImage,
    isDeleting,
    deleteImage,
    isUpdating,
    updateImage,
    isSettingPrimary,
    setPrimary,
    isReordering,
    reorderImages,
  };
}