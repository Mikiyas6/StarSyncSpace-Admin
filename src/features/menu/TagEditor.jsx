import { useState } from "react";
import styled from "styled-components";
import { Plus, X } from "lucide-react";

const StyledTagEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background-color: var(--color-grey-100);
  border: 1px solid var(--color-grey-200);
  border-radius: 100px;
  padding: 0.4rem 0.6rem 0.4rem 1.2rem;
  font-size: 1.3rem;
  font-weight: 500;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 50%;
    padding: 0.3rem;
    color: var(--color-grey-500);
    transition: all 0.2s;

    &:hover {
      background-color: var(--color-grey-200);
      color: var(--color-grey-800);
    }

    svg {
      width: 1.3rem;
      height: 1.3rem;
    }
  }
`;

const AddRow = styled.div`
  display: flex;
  gap: 0.8rem;
  align-items: center;
`;

const TextInput = styled.input`
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  flex: 1;
  min-width: 0;
`;

const AddButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: none;
  border-radius: var(--border-radius-sm);
  background-color: var(--color-brand-600);
  color: var(--color-brand-50);
  padding: 0.8rem 1.2rem;
  font-weight: 500;
  font-size: 1.3rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-brand-700);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 1.4rem;
    height: 1.4rem;
  }
`;

const Hint = styled.p`
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

function TagEditor({ value = [], onChange, placeholder, hint, id }) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = draft.trim();
    if (!tag) return;
    const exists = value.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );
    if (exists) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <StyledTagEditor>
      {value.length > 0 && (
        <Chips>
          {value.map((tag) => (
            <Chip key={tag}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                <X aria-hidden />
              </button>
            </Chip>
          ))}
        </Chips>
      )}
      <AddRow>
        <TextInput
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <AddButton type="button" onClick={addTag} disabled={!draft.trim()}>
          <Plus aria-hidden /> Add
        </AddButton>
      </AddRow>
      {hint && <Hint>{hint}</Hint>}
    </StyledTagEditor>
  );
}

export default TagEditor;