import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import supabase from "../../services/supabase";
import {
  MENU_IMAGES_BUCKET,
  createMenuItem,
  insertMenuItemImages,
  normalizeMenuItemInput,
  uploadMenuItemImage,
} from "../../services/apiMenu";
import { menuQueryKey } from "./useMenuOverview";

export function useCreateMenuItem() {
  const queryClient = useQueryClient();

  const { isLoading: isCreating, mutate: createMenuItemMutation } =
    useMutation({
      mutationFn: async ({ input, files = [] }) => {
        const uploaded = [];
        try {
          for (let i = 0; i < files.length; i++) {
            const image = await uploadMenuItemImage({
              file: files[i],
              sortOrder: i,
            });
            uploaded.push(image);
          }

          const payload = normalizeMenuItemInput(input);
          const item = await createMenuItem(payload);

          if (uploaded.length > 0) {
            await insertMenuItemImages(
              uploaded.map(({ url, sortOrder }) => ({
                menu_item_id: item.id,
                url,
                sort_order: sortOrder,
              }))
            );
          }

          return { item, images: uploaded };
        } catch (err) {
          // Remove anything already written to storage so a failed attempt
          // leaves no orphaned files behind.
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
      onSuccess: ({ item }, { files }) => {
        toast.success(
          files.length
            ? `${item.name} added with ${files.length} photo${files.length > 1 ? "s" : ""}`
            : `${item.name} added`
        );
        queryClient.invalidateQueries({ queryKey: menuQueryKey });
      },
      onError: (err) => toast.error(err.message),
    });

  return { isCreating, createMenuItem: createMenuItemMutation };
}
