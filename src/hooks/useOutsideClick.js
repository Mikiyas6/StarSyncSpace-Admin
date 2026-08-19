// src/hooks/useOutsideClick.js
import { useEffect, useRef } from "react";

export function useOutsideClick(handler, listenCapturing = true) {
  const ref = useRef();

  useEffect(
    function () {
      function handleClick(e) {
        // Add check to ensure handler exists
        if (ref.current && !ref.current.contains(e.target) && handler) {
          handler();
        }
      }

      // Use mousedown instead of click for better UX
      document.addEventListener("mousedown", handleClick, listenCapturing);

      return () =>
        document.removeEventListener("mousedown", handleClick, listenCapturing);
    },
    [handler, listenCapturing]
  );

  return ref;
}
