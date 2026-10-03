import React, { useState, useEffect, useRef } from 'react';
import { Copy, Edit3, X, AlertCircle } from 'lucide-react';

export interface PromptDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'success' | 'danger';
  icon?: React.ReactNode;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title = 'Enter Name',
  message = 'Please enter a name below.',
  initialValue = '',
  placeholder = 'Enter name...',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  icon,
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Reset state and handle focus when dialog opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setValue(initialValue);
      setErrorMessage(null);
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.();
    }
  }, [isOpen, initialValue]);

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmed = value.trim();
    if (!trimmed) {
      setErrorMessage('Dashboard name cannot be empty.');
      inputRef.current?.focus();
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(trimmed);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred.');
      setIsSubmitting(false);
    }
  };

  const getConfirmBtnClasses = () => {
    switch (confirmVariant) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-2 focus:ring-emerald-500/50 shadow-sm disabled:opacity-50';
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white focus:ring-2 focus:ring-rose-500/50 shadow-sm disabled:opacity-50';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-2 focus:ring-indigo-500/50 shadow-sm disabled:opacity-50';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      aria-describedby="prompt-dialog-desc"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl text-slate-200 overflow-hidden relative"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              {icon || <Copy className="w-4 h-4" />}
            </div>
            <h3 id="prompt-dialog-title" className="text-sm font-semibold text-white">
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3.5">
            <p id="prompt-dialog-desc" className="text-xs text-slate-300 leading-relaxed">
              {message}
            </p>

            <div className="space-y-1.5">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => {
                  setValue(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder={placeholder}
                disabled={isSubmitting}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden transition-colors ${
                  errorMessage
                    ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50'
                }`}
              />

              {errorMessage && (
                <div className="flex items-center space-x-1.5 text-xs text-rose-400 pt-0.5 animate-in fade-in duration-100">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-hidden ${getConfirmBtnClasses()}`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
