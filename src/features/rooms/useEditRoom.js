import toast from "react-hot-toast";
import { createEditRoom } from "../../services/apiRooms";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useEditRoom() {
  const queryClient = useQueryClient();
  const { isLoading: isEditing, mutate: editRoom } = useMutation({
    mutationFn: ({ newRoomData, id }) => createEditRoom(newRoomData, id),
    onSuccess: () => {
      toast.success("Room successfully updated!");
      queryClient.invalidateQueries({
        queryKey: ["rooms"],
      });
    },
    onError: (error) => {
      toast.error("Failed to update room: " + error.message);
    },
  });
  return { isEditing, editRoom };
}
