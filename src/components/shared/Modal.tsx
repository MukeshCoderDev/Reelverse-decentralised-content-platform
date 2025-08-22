// src/components/shared/Modal.tsx
import React from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string; // For the inner content div
  overlayClassName?: string; // For the overlay div
  contentClassName?: string; // For the content wrapper div
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  overlayClassName,
  contentClassName,
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className={overlayClassName || "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"}>
      <div className={contentClassName || "bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-auto"}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className={className}>{children}</div>
      </div>
    </div>,
    document.body // Render modal outside the main app div
  );
};
