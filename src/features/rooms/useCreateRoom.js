import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createEditRoom } from "../../services/apiRooms";

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { isLoading: isCreating, mutate: createRoom } = useMutation({
    mutationFn: createEditRoom,
    onSuccess: () => {
      toast.success("Room created successfully!");
      queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
    },
    onError: (error) => {
      toast.error("Failed to create room: " + error.message);
    },
  });
  return { isCreating, createRoom };
}
