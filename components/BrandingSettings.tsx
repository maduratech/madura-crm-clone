import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

const APP_FAVICON_KEY = 'favicon_url';
const DEFAULT_FAVICON_PATH = '/vite.svg';
const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512KB is plenty for a favicon

function updateDocumentFavicon(href: string) {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (existing) {
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  document.head.appendChild(link);
}

const BrandingSettings: React.FC = () => {
  const { addToast } = useToast();
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .eq('key', APP_FAVICON_KEY)
          .limit(1);

        if (error) {
          // If table doesn't exist yet or RLS blocks it, fail quietly (keep default favicon).
          if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
            return;
          }
          console.error('[BrandingSettings] Error loading app_settings:', error);
          return;
        }

        const row = Array.isArray(data) && data.length > 0 ? data[0] as { key: string; value: string | null } : null;
        if (isMounted && row && typeof row.value === 'string' && row.value.trim()) {
          setCurrentFaviconUrl(row.value);
          setPreviewUrl(row.value);
          updateDocumentFavicon(row.value.trim());
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      addToast('Please select an image file (PNG, JPG, SVG, ICO).', 'error');
      return;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      addToast('Image is too large. Please use a file under 512KB.', 'error');
      return;
    }

    setFile(selected);
    const localUrl = URL.createObjectURL(selected);
    setPreviewUrl(localUrl);
  };

  const handleRemoveCustomFavicon = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: APP_FAVICON_KEY, value: null }, { onConflict: 'key' });

      if (error) {
        console.error('[BrandingSettings] Error clearing favicon setting:', error);
        addToast('Failed to remove custom favicon.', 'error');
        return;
      }

      setCurrentFaviconUrl('');
      setPreviewUrl('');
      setFile(null);
      updateDocumentFavicon(DEFAULT_FAVICON_PATH);
      addToast('Custom favicon removed. Using default icon now.', 'success');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!file && !currentFaviconUrl) {
      addToast('Please upload an image or continue using the default icon.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      let finalUrl = currentFaviconUrl;

      if (file) {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const timestamp = Date.now();
        const filePath = `public/branding/favicon-${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            upsert: true,
            cacheControl: '3600',
          });

        if (uploadError) {
          if (uploadError.message?.includes('policy')) {
            addToast("Upload failed. Please ensure the 'avatars' storage bucket allows uploads from authenticated users.", 'error');
          } else {
            addToast(`Upload failed: ${uploadError.message}`, 'error');
          }
          console.error('[BrandingSettings] Favicon upload error:', uploadError);
          return;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        finalUrl = `${data.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: APP_FAVICON_KEY, value: finalUrl || null },
          { onConflict: 'key' }
        );

      if (error) {
        console.error('[BrandingSettings] Error saving app_settings:', error);
        addToast('Failed to save branding settings.', 'error');
        return;
      }

      if (finalUrl) {
        setCurrentFaviconUrl(finalUrl);
        setPreviewUrl(finalUrl);
        updateDocumentFavicon(finalUrl);
      } else {
        updateDocumentFavicon(DEFAULT_FAVICON_PATH);
      }

      addToast('Branding settings saved successfully.', 'success');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm max-w-xl">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Branding</h2>
      <p className="text-sm text-slate-600 mb-6">
        Upload a favicon image for the CRM. If you don&apos;t upload anything, the default system icon will be used.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Favicon image
          </label>

          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Favicon preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">Default</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                onChange={handleFileChange}
                disabled={isLoading || isSaving}
                className="block text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
              />
              <p className="text-xs text-slate-500">
                PNG, JPG, SVG, or ICO. Recommended: square image, under 512KB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? 'Saving…' : 'Save favicon'}
          </button>

          {currentFaviconUrl && (
            <button
              type="button"
              onClick={handleRemoveCustomFavicon}
              disabled={isSaving}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Remove custom favicon
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BrandingSettings;

