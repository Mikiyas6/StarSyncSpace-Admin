import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import supabase from "../../services/supabase";
import {
  MENU_IMAGES_BUCKET,
  getNextImageSortOrder,
  insertMenuItemImages,
  normalizeMenuItemInput,
  updateMenuItem,
  uploadMenuItemImage,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useEditMenuItem() {
  const queryClient = useQueryClient();

  const { isLoading: isEditing, mutate: editMenuItemMutation } = useMutation({
    mutationFn: async ({ id, input, files = [] }) => {
      const payload = normalizeMenuItemInput(input);
      if (payload.section_id === input.original_section_id) {
        delete payload.section_id;
      }

      let sortOrder = await getNextImageSortOrder(id);

      const uploaded = [];
      try {
        for (const file of files) {
          const image = await uploadMenuItemImage({ file, sortOrder });
          uploaded.push(image);
          sortOrder += 1;
        }

        const item = await updateMenuItem(id, payload);

        if (uploaded.length > 0) {
          await insertMenuItemImages(
            uploaded.map(({ url, sortOrder: order }) => ({
              menu_item_id: id,
              url,
              sort_order: order,
            }))
          );
        }
        return item;
      } catch (err) {
        if (uploaded.length > 0) {
          await Promise.allSettled(
            uploaded.map(({ name }) =>
              supabase.storage.from(MENU_IMAGES_BUCKET).remove([name])
            )
          );
        }
        throw err;
      }
    },
    onSuccess: (item) => {
      toast.success(`${item.name} updated`);
      queryClient.invalidateQueries({ queryKey: menuQueryKey });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editMenuItem: editMenuItemMutation };
}