import React, { useState, useRef } from 'react';
import { LoggedInUser } from '../types';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataProvider';
import { useRouter } from '../contexts/RouterProvider';

const FormInput: React.FC<{ 
    label: string; 
    type: string; 
    id: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    placeholder?: string,
    onClear?: () => void;
}> = 
({ label, type, id, value, onChange, placeholder, onClear }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
            {label}
        </label>
        <div className="relative">
            <input
                type={type}
                id={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
            />
            {type === 'date' && value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                    Clear
                </button>
            )}
        </div>
    </div>
);

const Profile: React.FC<{currentUser: LoggedInUser}> = ({ currentUser }) => {
    const { addToast } = useToast();
    const { fetchData } = useData();
    const { navigate } = useRouter();
    
    const [profile, setProfile] = useState({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
    });
    
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar_url);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setProfile(prev => ({ ...prev, [id]: value }));
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                addToast('File size should not exceed 1MB.', 'error');
                return;
            }
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveChanges = async () => {
        setLoading(true);
        try {
            let changesMade = false;
        
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found. Please log in again.');

            const staffUpdatePayload: { name?: string; phone?: string; avatar_url?: string } = {};

            if (avatarFile) {
                const filePath = `public/staff-avatars/${user.id}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, { 
                        upsert: true,
                        cacheControl: '3600'
                    });

                if (uploadError) {
                     if (uploadError.message.includes('policy')) {
                         throw new Error("Avatar upload failed. Please ensure the 'avatars' storage bucket has the correct security policies set up.");
                     }
                    throw new Error(`Avatar upload failed: ${uploadError.message}`);
                }

                const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                staffUpdatePayload.avatar_url = `${data.publicUrl}?t=${new Date().getTime()}`;
            }

            if (profile.name !== currentUser.name) staffUpdatePayload.name = profile.name;
            if (profile.phone !== currentUser.phone) staffUpdatePayload.phone = profile.phone;

            if (Object.keys(staffUpdatePayload).length > 0) {
                changesMade = true;
                const { error: profileError } = await supabase
                    .from('staff')
                    .update(staffUpdatePayload)
                    .eq('user_id', user.id);
                if (profileError) {
                     if (profileError.code === '42501') { // Supabase permission denied
                        throw new Error("Profile update failed: You don't have permission to perform this action. Please check Row Level Security policies.");
                    }
                    throw new Error(`Profile update failed: ${profileError.message}`);
                }
            }

            if (profile.email !== currentUser.email) {
                addToast('Email updates are not supported at this time.', 'error');
            }

            if (changesMade) {
                addToast('Profile changes saved!', 'success');
                // Force a reload to ensure all components (including header/sidebar) get the updated user profile.
                // This is the most reliable way to handle the stale state in AuthProvider.
                setTimeout(() => window.location.reload(), 1000);
            } else {
                addToast('No profile changes to save.', 'success');
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

  return (
    <div className="w-full space-y-6">
      {/* Profile Information Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Profile Information</h2>
            <button onClick={handleSaveChanges} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-[#191974] border border-transparent rounded-[5px] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400">
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
        
        <div className="flex items-center space-x-6 mb-6">
            <img className="h-24 w-24 rounded-full object-cover" src={avatarPreview} alt="User profile" />
            <div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-[5px] hover:bg-slate-50">
                    Change Photo
                </button>
                <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF. 1MB max.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label="Full Name" type="text" id="name" value={profile.name} onChange={handleProfileChange} />
            <FormInput label="Email Address (Cannot be changed)" type="email" id="email" value={profile.email} onChange={() => {}} />
            <FormInput label="Phone Number" type="tel" id="phone" value={profile.phone} onChange={handleProfileChange} />
        </div>
      </div>

      {/* Change Password — dedicated page (same as reset-password flow) */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Password</h2>
          <button
            onClick={() => navigate('/reset-password')}
            className="px-4 py-2 text-sm font-medium text-white bg-[#191974] border border-transparent rounded-[5px] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Change password
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Click &quot;Change password&quot; to open the dedicated password page. From there you can set a new password safely at any time.
        </p>
      </div>
    </div>
  );
};

export default Profile;