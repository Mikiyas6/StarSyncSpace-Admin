import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSetting as updateSettingApi } from "../../services/apiSettings";
import { revalidateClientSite } from "../../services/revalidateClientSite";

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  const { isLoading: isUpdating, mutate: updateSetting } = useMutation({
    mutationFn: updateSettingApi,
    onSuccess: () => {
      toast.success("Setting successfully Edited!");
      queryClient.invalidateQueries({
        queryKey: ["settings"],
      });
      /* These settings ARE the booking rules — opening hours, the
         minimum and maximum length, the turnaround gap. The public site
         holds them in its data cache for five minutes, so without this
         the slot grid went on offering (and the server went on
         enforcing) the old rules long after the admin changed them. */
      revalidateClientSite(["/", "/rooms"]);
    },
    onError: (error) => {
      toast.error("Failed to edit settings: " + error.message);
    },
  });
  return { isUpdating, updateSetting };
}
