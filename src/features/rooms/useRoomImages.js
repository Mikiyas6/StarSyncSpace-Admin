import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createRoomImage as createRoomImageApi,
  deleteRoomImage as deleteRoomImageApi,
} from "../../services/apiRooms";
import { revalidateClientSite } from "../../services/revalidateClientSite";

export function useCreateRoomImage() {
  const queryClient = useQueryClient();
  const { isLoading: isCreating, mutate: createRoomImage } = useMutation({
    mutationFn: ({ file, roomId, sortOrder }) =>
      createRoomImageApi(file, roomId, sortOrder),
    onSuccess: (_data, variables) => {
      toast.success("Photo added");
      queryClient.invalidateQueries({ queryKey: ["roomImages"] });
      revalidateClientSite([`/rooms/${variables.roomId}`]);
    },
    onError: (err) => toast.error(err.message),
  });
  return { isCreating, createRoomImage };
}

export function useDeleteRoomImage() {
  const queryClient = useQueryClient();
  const { isLoading: isDeleting, mutate: deleteRoomImage } = useMutation({
    mutationFn: deleteRoomImageApi,
    onSuccess: () => {
      toast.success("Photo deleted");
      queryClient.invalidateQueries({ queryKey: ["roomImages"] });
      revalidateClientSite(["/rooms"]);
    },
    onError: (err) => toast.error(err.message),
  });
  return { isDeleting, deleteRoomImage };
}