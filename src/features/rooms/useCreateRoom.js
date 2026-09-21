import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createEditRoom } from "../../services/apiRooms";
import { revalidateClientSite } from "../../services/revalidateClientSite";

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { isLoading: isCreating, mutate: createRoom } = useMutation({
    mutationFn: createEditRoom,
    onSuccess: () => {
      toast.success("Room created successfully!");
      queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
      revalidateClientSite(["/", "/rooms"]);
    },
    onError: (error) => {
      toast.error("Failed to create room: " + error.message);
    },
  });
  return { isCreating, createRoom };
}
