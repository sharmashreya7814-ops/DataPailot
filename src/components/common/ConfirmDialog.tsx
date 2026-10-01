import React, { useEffect, useRef } from 'react';
import { AlertTriangle, FileText, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  itemDetails?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  icon?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Unsaved SQL Changes',
  message = 'This query has unsaved changes. If you close it, your changes will be lost.',
  itemName,
  itemDetails,
  confirmText = 'Close Query',
  cancelText = 'Keep Editing',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  icon
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Manage focus trap & restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus safe "Keep Editing" action by default
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.();
    }
  }, [isOpen]);

  // Handle keyboard interaction (Escape to cancel)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getConfirmBtnClasses = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white focus:ring-2 focus:ring-rose-500/50 shadow-sm';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white focus:ring-2 focus:ring-amber-500/50 shadow-sm';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-2 focus:ring-indigo-500/50 shadow-sm';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl text-slate-200 overflow-hidden relative"
      >
        {/* Header with Icon and Title */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              {icon || <AlertTriangle className="w-4 h-4" />}
            </div>
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-white">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          <p id="confirm-dialog-desc" className="text-xs text-slate-300 leading-relaxed">
            {message}
          </p>

          {/* Item Name & Details Card */}
          {itemName && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
              <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono font-medium text-slate-200 truncate">
                  {itemName}
                </div>
                {itemDetails && (
                  <div className="text-[11px] text-slate-400 truncate">
                    {itemDetails}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end space-x-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-hidden ${getConfirmBtnClasses()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
