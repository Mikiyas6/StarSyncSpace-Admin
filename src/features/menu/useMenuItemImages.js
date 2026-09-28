import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  attachMenuItemImage,
  deleteMenuItemImage,
  reorderMenuItemImages,
  setPrimaryMenuItemImage,
  updateMenuItemImage,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useMenuItemImages(menuItemId) {
  const queryClient = useQueryClient();

  /* The menu is where photos are edited, but it is not the only place
     they are SHOWN — the inventory screen puts a thumbnail on every
     stocked row, and its rows come from a different query. Invalidating
     only the menu left a newly added photo invisible on the page the
     person was most likely looking at when they added it. */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: menuQueryKey });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["stockable-items"] });
  };

  /* attachMenuItemImage(), not uploadMenuItemImage().

     The latter only puts the file in the bucket and returns its URL —
     the menu_item_images row is a separate call. This hook used to make
     just that upload and then report success, so adding a photo to an
     existing item left a file in storage, no row, and a green toast for
     a photo that never appeared. Both halves now happen in one place,
     and a failed insert takes the orphaned file with it. */
  const { isLoading: isUploading, mutate: uploadImage } = useMutation({
    mutationFn: (file) => attachMenuItemImage({ file, menuItemId }),
    onSuccess: ({ isPrimary }) => {
      toast.success(
        isPrimary ? "Photo added — it is now the main one" : "Photo added",
      );
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