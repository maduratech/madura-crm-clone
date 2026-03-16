import React, { useState, useEffect, useMemo } from 'react';
import { Destination, LoggedInUser, DestinationStatus } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconListBullet } from '../constants';
import { useToast } from './ToastProvider';
import { useRouter } from '../contexts/RouterProvider';
import { useData } from '../contexts/DataProvider';
import { supabase } from '../lib/supabase';

const IconGrid: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void }> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">
          Delete
        </button>
      </div>
    </div>
  </div>
);

const DestinationDetailPanel: React.FC<{
  destination: Destination | null;
  onClose: () => void;
  onSave: (destination: Partial<Destination>) => Promise<boolean>;
  onDelete: (destinationId: number) => Promise<void>;
  currentUser: LoggedInUser;
}> = ({ destination, onClose, onSave, onDelete, currentUser }) => {
  const isNew = !destination;
  const { addToast } = useToast();
  const { navigate } = useRouter();
  const [edited, setEdited] = useState<Partial<Destination>>(
    destination || { name: '', status: 'Active', display_order: 0 }
  );
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const handleChange = (field: keyof Destination, value: any) => {
    setEdited((prev) => ({ ...prev, [field]: value }));
    if (field === 'name' && isNew && typeof value === 'string') setEdited((prev) => ({ ...prev, slug: slugFromName(value) }));
  };

  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file (JPEG, PNG, WebP).', 'error');
      return;
    }
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverImageFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleRemoveCoverImage = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverImageFile(null);
    setCoverPreviewUrl(null);
    handleChange('cover_image_url', null);
  };

  const handleSave = async () => {
    if (!edited.name?.trim()) {
      addToast('Destination name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      let payload = { ...edited };
      if (coverImageFile) {
        const slug = edited.slug || slugFromName(edited.name || '');
        const filePath = `public/destination-covers/${slug}-${Date.now()}-${coverImageFile.name}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, coverImageFile, { upsert: true });
        if (uploadError) {
          addToast('Failed to upload cover image. ' + (uploadError.message || ''), 'error');
          setSaving(false);
          return;
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        payload = { ...payload, cover_image_url: `${data.publicUrl}?t=${Date.now()}` };
        setCoverImageFile(null);
        if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
        setCoverPreviewUrl(null);
      }
      const success = await onSave(payload);
      if (success) {
        addToast(isNew ? 'Destination created.' : 'Destination updated.', 'success');
        if (payload.cover_image_url) setEdited((prev) => ({ ...prev, cover_image_url: payload.cover_image_url }));
        if (isNew && edited.id) navigate(`/destinations/${edited.id}`);
        else setIsEditing(false);
      }
    } catch (e: any) {
      addToast(e?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!destination?.id) return;
    try {
      await onDelete(destination.id);
      addToast('Destination deleted.', 'success');
      onClose();
    } catch (e: any) {
      addToast(e?.message || 'Failed to delete', 'error');
    }
  };

  const statusOptions: { value: DestinationStatus; label: string }[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Archived', label: 'Archived' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl flex flex-col z-50 border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'New destination' : edited.name || 'Destination'}
          </h2>
          <div className="flex items-center gap-1">
            {!isNew && !isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  aria-label="Edit"
                >
                  <IconPencil className="w-5 h-5" />
                </button>
                {currentUser.role === 'Super Admin' && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label="Delete"
                  >
                    <IconTrash className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
            {isEditing ? (
              <input
                type="text"
                value={edited.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
                placeholder="e.g. Singapore"
              />
            ) : (
              <p className="text-slate-900 font-medium py-1">{edited.name}</p>
            )}
          </div>

          {!isNew && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Slug</label>
              <p className="text-sm text-slate-600 font-mono">{destination.slug}</p>
            </div>
          )}

          {isEditing && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Country / Region</label>
                <input
                  type="text"
                  value={edited.country_region || ''}
                  onChange={(e) => handleChange('country_region', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Singapore, Southeast Asia"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Short description</label>
                <textarea
                  value={edited.short_description || ''}
                  onChange={(e) => handleChange('short_description', e.target.value || null)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="1–2 lines for cards and lists"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Itinerary snippet</label>
                <input
                  type="text"
                  value={edited.itinerary_snippet || ''}
                  onChange={(e) => handleChange('itinerary_snippet', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Singapore – city & nature in 3–5 days"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Cover image</label>
                <div className="space-y-2">
                  {(edited.cover_image_url || coverPreviewUrl) && (
                    <div className="relative inline-block">
                      <img
                        src={coverPreviewUrl || edited.cover_image_url || ''}
                        alt="Cover preview"
                        className="w-full max-w-xs h-32 object-cover rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveCoverImage}
                        className="absolute top-1 right-1 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 text-xs"
                        title="Remove image"
                      >
                        <IconX className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors">
                      {edited.cover_image_url || coverPreviewUrl ? 'Change image' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleCoverImageSelect}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">JPEG, PNG, WebP or GIF</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Display order</label>
                  <input
                    type="number"
                    value={edited.display_order ?? 0}
                    onChange={(e) => handleChange('display_order', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={edited.status || 'Active'}
                    onChange={(e) => handleChange('status', e.target.value as DestinationStatus)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {!isNew && (
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/destinations/${destination.id}`)}
                className="w-full py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                View all attractions
              </button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => { setEdited(destination || { name: '' }); setIsEditing(false); }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isNew ? 'Create destination' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
      {showDeleteConfirm && (
        <ConfirmationModal
          title="Delete destination"
          message="This will remove the destination and all its attractions. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};

const Destinations: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
  const { addToast } = useToast();
  const { navigate } = useRouter();
  const { destinations, sightseeing, transfers, refreshDestinations, refreshSightseeing, fetchTransfers, loadingDestinations } = useData();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [saving, setSaving] = useState(false);

  // Load destinations, sightseeing, and transfers when visiting so All Transfers/Attractions have data
  useEffect(() => {
    if (destinations.length === 0 && !loadingDestinations) refreshDestinations();
    fetchTransfers();
    refreshSightseeing?.();
  }, [destinations.length, loadingDestinations, refreshDestinations, fetchTransfers, refreshSightseeing]);

  const withCount = useMemo(() => {
    const attractionsByDest: Record<number, number> = {};
    const transfersByDest: Record<number, number> = {};
    sightseeing.forEach((s) => { attractionsByDest[s.destination_id] = (attractionsByDest[s.destination_id] || 0) + 1; });
    transfers.forEach((t) => { if (t.destination_id != null) transfersByDest[t.destination_id] = (transfersByDest[t.destination_id] || 0) + 1; });
    return destinations.map((d) => ({
      ...d,
      attractions_count: attractionsByDest[d.id] ?? 0,
      transfers_count: transfersByDest[d.id] ?? 0,
    }));
  }, [destinations, sightseeing, transfers]);

  const filtered = useMemo(() => {
    return withCount.filter((d) => {
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.country_region || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || (d.status || 'Active') === filterStatus;
      const matchCountry = filterCountry === 'all' || (d.country_region || '') === filterCountry;
      return matchSearch && matchStatus && matchCountry;
    });
  }, [withCount, search, filterStatus, filterCountry]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    withCount.forEach((d) => { if (d.country_region) set.add(d.country_region); });
    return Array.from(set).sort();
  }, [withCount]);

  const handleSave = async (payload: Partial<Destination>): Promise<boolean> => {
    setSaving(true);
    try {
      if (payload.id) {
        const { error } = await supabase
          .from('destinations')
          .update({
            name: payload.name,
            country_region: payload.country_region ?? null,
            short_description: payload.short_description ?? null,
            itinerary_snippet: payload.itinerary_snippet ?? null,
            cover_image_url: payload.cover_image_url ?? null,
            display_order: payload.display_order ?? 0,
            status: payload.status || 'Active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const slug = payload.slug || slugFromName(payload.name || '');
        const { data, error } = await supabase
          .from('destinations')
          .insert({
            name: payload.name,
            slug,
            country_region: payload.country_region ?? null,
            short_description: payload.short_description ?? null,
            itinerary_snippet: payload.itinerary_snippet ?? null,
            cover_image_url: payload.cover_image_url ?? null,
            display_order: payload.display_order ?? 0,
            status: payload.status || 'Active',
          })
          .select('id')
          .single();
        if (error) throw error;
        if (data) payload.id = data.id;
      }
      await refreshDestinations();
      return true;
    } catch (e: any) {
      addToast(e?.message || 'Failed to save destination', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    const { error } = await supabase.from('destinations').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refreshDestinations();
  };

  const openPanel = (dest: Destination | null) => {
    setSelected(dest);
    setPanelOpen(true);
  };

  if (loadingDestinations && destinations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Destinations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage regions and link them to attractions for itineraries.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="List"
            >
              <IconListBullet className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="Grid"
            >
              <IconGrid className="w-5 h-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => openPanel(null)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
          >
            <IconPlus className="w-5 h-5" />
            New destination
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search destinations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All status</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
          <option value="Archived">Archived</option>
        </select>
        {countryOptions.length > 0 && (
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All regions</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-slate-500 text-center">
            {search || filterStatus !== 'all' || filterCountry !== 'all' ? 'No destinations match the filters.' : 'No destinations yet.'}
          </p>
          {!search && filterStatus === 'all' && filterCountry === 'all' && (
            <button
              type="button"
              onClick={() => openPanel(null)}
              className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Create your first destination
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Attractions · Transfers</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="w-24 px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/destinations/${d.id}`)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {d.cover_image_url ? (
                        <img src={d.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium">
                          {d.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-slate-900">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{d.country_region || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{d.attractions_count ?? 0} attractions · {d.transfers_count ?? 0} transfers</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      (d.status || 'Active') === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                      (d.status || '') === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {d.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openPanel(d)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" aria-label="Edit">
                        <IconPencil className="w-4 h-4" />
                      </button>
                      {currentUser.role === 'Super Admin' && (
                        <button
                          type="button"
                          onClick={() => { if (confirm('Delete this destination and all its attractions?')) handleDelete(d.id).catch((err) => addToast(err.message, 'error')); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/destinations/${d.id}`)}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                {d.cover_image_url ? (
                  <img src={d.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl font-bold">
                    {d.name.charAt(0)}
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    (d.status || 'Active') === 'Active' ? 'bg-white/90 text-emerald-800' : 'bg-white/90 text-slate-600'
                  }`}>
                    {d.status || 'Active'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 truncate">{d.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{d.country_region || 'No region'}</p>
                <p className="text-xs text-slate-400 mt-2">{d.attractions_count ?? 0} attractions · {d.transfers_count ?? 0} transfers</p>
              </div>
              <div className="px-4 pb-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => openPanel(d)} className="flex-1 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                  Edit
                </button>
                {currentUser.role === 'Super Admin' && (
                  <button
                    type="button"
                    onClick={() => { if (confirm('Delete this destination?')) handleDelete(d.id).catch((err) => addToast(err.message, 'error')); }}
                    className="py-2 px-3 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {panelOpen && (
        <DestinationDetailPanel
          destination={selected}
          onSave={handleSave}
          onClose={() => { setPanelOpen(false); setSelected(null); }}
          onDelete={handleDelete}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default Destinations;
