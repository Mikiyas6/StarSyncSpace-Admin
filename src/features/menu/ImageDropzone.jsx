import { useEffect, useState } from "react";
import styled from "styled-components";
import { ImagePlus, Star, Trash2 } from "lucide-react";

const Dropzone = styled.div`
  border: 2px dashed var(--color-grey-300);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-50);
  padding: 2.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &.dragging {
    border-color: var(--color-brand-600);
    background-color: var(--color-brand-50);
  }

  svg {
    width: 3.2rem;
    height: 3.2rem;
    color: var(--color-grey-400);
  }

  span {
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--color-grey-600);
  }

  small {
    font-size: 1.2rem;
    color: var(--color-grey-500);
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1.2rem;
  margin-top: 1.2rem;
`;

const PreviewBox = styled.div`
  position: relative;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background-color: var(--color-grey-100);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--color-brand-600);
  color: var(--color-brand-50);
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.3rem 0.8rem;
  border-radius: 100px;
`;

const BoxActions = styled.div`
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
      background-color: #ffffff;
      color: var(--color-brand-600);
    }

    &.remove:hover {
      color: var(--color-red-700);
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
`;

const FileName = styled.span`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.78), transparent);
  color: #fff;
  font-size: 1.1rem;
  padding: 1.6rem 0.8rem 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Staged files for a not-yet-created menu item. Previews locally, uploads on
// form submit through the parent.
function ImageDropzone({ files, setFiles, id }) {
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function addFiles(list) {
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (incoming.length > 0) setFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <Dropzone
        className={dragging ? "dragging" : ""}
        onClick={() => document.getElementById(id)?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus aria-hidden />
        <span>Drag &amp; drop photos here, or click to browse</span>
        <small>Upload the first image — it will become the card photo.</small>
      </Dropzone>
      <HiddenInput
        id={id}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {previews.length > 0 && (
        <PreviewGrid>
          {previews.map((url, index) => (
            <PreviewBox key={url}>
              <img src={url} alt={files[index]?.name || "New photo"} />
              {index === 0 && <Badge>Primary</Badge>}
              <FileName>{files[index]?.name}</FileName>
              <BoxActions>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="remove"
                  aria-label={`Remove ${files[index]?.name || "photo"}`}
                >
                  <Trash2 aria-hidden />
                </button>
              </BoxActions>
            </PreviewBox>
          ))}
        </PreviewGrid>
      )}
    </div>
  );
}

export default ImageDropzone;