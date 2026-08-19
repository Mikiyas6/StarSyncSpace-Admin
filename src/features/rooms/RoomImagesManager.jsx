import { useState } from "react";
import styled from "styled-components";
import { useQuery } from "@tanstack/react-query";
import FileInput from "../../ui/FileInput";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getRoomImages } from "../../services/apiRooms";
import { useCreateRoomImage, useDeleteRoomImage } from "./useRoomImages";

const StyledPhotos = styled.div`
  grid-column: 1 / -1;
  border-top: 1px solid var(--color-grey-100);
  padding-top: 1.6rem;
`;

const PhotoGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  margin-top: 1.2rem;
`;

const PhotoBox = styled.div`
  position: relative;
  width: 12rem;
  height: 8rem;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 1px solid var(--color-grey-200);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  button {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    padding: 0.2rem 0.6rem;
    font-size: 1.1rem;
  }
`;

function RoomImagesManager({ roomId }) {
  const { data: images, isLoading } = useQuery({
    queryKey: ["roomImages", roomId],
    queryFn: () => getRoomImages(roomId),
    enabled: Boolean(roomId),
  });
  const { isCreating, createRoomImage } = useCreateRoomImage();
  const { isDeleting, deleteRoomImage } = useDeleteRoomImage();
  const [file, setFile] = useState(null);

  function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    createRoomImage(
      { file, roomId, sortOrder: (images?.length ?? 0) + 1 },
      {
        onSuccess: () => setFile(null),
      }
    );
  }

  return (
    <StyledPhotos>
      <label>Extra photos (gallery)</label>
      <p style={{ fontSize: "1.3rem", color: "var(--color-grey-500)" }}>
        These appear as thumbnails under the main room photo on the website.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <PhotoGrid>
          {images?.map((img) => (
            <PhotoBox key={img.id}>
              <img src={img.url} alt="Room photo" />
              <Button
                size="small"
                variation="danger"
                onClick={() => deleteRoomImage(img.id)}
                disabled={isDeleting}
              >
                Remove
              </Button>
            </PhotoBox>
          ))}
        </PhotoGrid>
      )}

      <form
        onSubmit={handleUpload}
        style={{
          display: "flex",
          gap: "1.2rem",
          alignItems: "center",
          marginTop: "1.2rem",
        }}
      >
        <FileInput
          id="extraImage"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <Button disabled={isCreating || !file}>Add photo</Button>
      </form>
    </StyledPhotos>
  );
}

export default RoomImagesManager;