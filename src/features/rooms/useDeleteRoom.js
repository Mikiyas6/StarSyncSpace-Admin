import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { deleteRoom as deleteRoomApi } from "../../services/apiRooms";
import { revalidateClientSite } from "../../services/revalidateClientSite";
export function useDeleteRoom() {
  const queryClient = useQueryClient();
  const {
    isLoading: isDeleting,
    mutate: deleteRoom /**mutate - A function that triggers the mutation. */,
  } = useMutation({
    //mutationFn is the function that runs when mutate() is called.
    mutationFn: deleteRoomApi,
    onSuccess: (data) => {
      toast.success("Room successfully deleted");
      queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
      revalidateClientSite(["/", "/rooms", `/rooms/${data?.[0]?.id}`]);
    },
    onError: (err) => toast.error(err.message),
  });
  return { isDeleting, deleteRoom };
}
