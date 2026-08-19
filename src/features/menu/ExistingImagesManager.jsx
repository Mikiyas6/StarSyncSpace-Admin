import { useState } from "react";
import styled from "styled-components";
import { GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import { useMenuOverview } from "./useMenuOverview";
import { useMenuItemImages } from "./useMenuItemImages";

const StyledManager = styled.div`
  margin: 1.2rem 0;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1.2rem;
`;

const Box = styled.div`
  position: relative;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background-color: var(--color-grey-100);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.dragging {
    opacity: 0.4;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
`;

const Handle = styled.span`
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.92);
  border-radius: var(--border-radius-sm);
  padding: 0.4rem;
  color: var(--color-grey-500);

  svg {
    width: 1.6rem;
    height: 1.6rem;
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 0.6rem;
  left: 3.2rem;
  background-color: var(--color-brand-600);
  color: var(--color-brand-50);
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.3rem 0.8rem;
  border-radius: 100px;
`;

const Actions = styled.div`
  position: absolute;
  bottom: 0.6rem;
  right: 0.6rem;
  display: flex;
  gap: 0.4rem;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--border-radius-sm);
    background-color: rgba(255, 255, 255, 0.92);
    color: var(--color-grey-700);
    padding: 0.5rem;
    transition: all 0.2s;

    &:hover {
      background-color: #fff;
      color: var(--color-brand-600);
    }

    &.remove:hover {
      color: var(--color-red-700);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
`;

const Dropzone = styled.label`
  margin-top: 1.2rem;
  border: 2px dashed var(--color-grey-300);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-50);
  padding: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--color-grey-600);
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &.dragging {
    border-color: var(--color-brand-600);
    background-color: var(--color-brand-50);
  }

  svg {
    width: 1.8rem;
    height: 1.8rem;
  }

  input {
    display: none;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.55);

  svg {
    width: 2rem;
    height: 2rem;
    color: var(--color-brand-600);
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
`;

function ExistingImagesManager({ menuItemId }) {
  const { data: overview } = useMenuOverview();
  const images =
    overview?.images?.filter((img) => img.menu_item_id === menuItemId) ?? [];

  const {
    isUploading,
    uploadImage,
    isDeleting,
    deleteImage,
    isSettingPrimary,
    setPrimary,
    isReordering,
    reorderImages,
  } = useMenuItemImages(menuItemId);

  const [dragIndex, setDragIndex] = useState(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(targetIndex) {
    setDragging(false);
    if (dragIndex === null || dragIndex === targetIndex) return;
    const reordered = [...images];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderImages(reordered);
  }

  return (
    <StyledManager>
      <Grid>
        {images.map((img, index) => (
          <Box
            key={img.id}
            className={dragging && dragIndex === index ? "dragging" : ""}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setDragging(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
          >
            <img src={img.url} alt={img.alt_text || "Menu item photo"} />
            <Handle title="Drag to reorder">
              <GripVertical aria-hidden />
            </Handle>
            {img.is_primary && <Badge>Primary</Badge>}
            <Actions>
              {!img.is_primary && (
                <button
                  type="button"
                  onClick={() => setPrimary(img.id)}
                  disabled={isSettingPrimary}
                  title="Make this the main card photo"
                  aria-label="Make primary"
                >
                  <Star aria-hidden />
                </button>
              )}
              <button
                type="button"
                className="remove"
                onClick={() => deleteImage(img.id)}
                disabled={isDeleting}
                aria-label="Remove photo"
                title="Remove photo"
              >
                <Trash2 aria-hidden />
              </button>
            </Actions>
            {isReordering && <LoadingOverlay />}
          </Box>
        ))}
      </Grid>

      <Dropzone
        className={dragging && dragIndex === null ? "dragging" : ""}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) uploadImage(file);
        }}
      >
        <ImagePlus aria-hidden />
        Add more photos
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            Array.from(e.target.files).forEach((file) => uploadImage(file));
            e.target.value = "";
          }}
        />
      </Dropzone>
      <p style={{ fontSize: "1.2rem", color: "var(--color-grey-500)" }}>
        Drag photos to reorder the gallery. The Primary photo is the menu card
        image.
      </p>
    </StyledManager>
  );
}

export default ExistingImagesManager;