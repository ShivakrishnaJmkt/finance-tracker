// components/ProfilePhotoUploader.jsx
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";

const CLOUD_NAME = "dok5qnux9";          // ✅ నీ cloud name
const UPLOAD_PRESET = "profile-uploads"; // ✅ నీ preset name

export default function ProfileImageUploader({ onUploaded }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("cloud_name", CLOUD_NAME);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,  // ✅ ఇక్కడ fix
        { method: "POST", body: formData }
      );

      const data = await res.json();
       console.log("Cloudinary response:", data);
      const imageUrl = data.secure_url;
      if (!imageUrl) {
        console.error("No secure_url from Cloudinary", data);
        return;
      }

      const profileRef = doc(db, `users/${user.uid}/profile/img`);
      await setDoc(profileRef, {
        url: imageUrl,
        filename: file.name,
        uploadedAt: new Date(),
      });

      onUploaded(imageUrl);
    } catch (err) {
      console.error("Profile upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="text-xs file:mr-2 file:px-3 file:py-1 file:rounded file:border-0 file:bg-purple-700 file:text-white hover:file:bg-purple-600"
      />
      {uploading && (
        <p className="mt-1 text-xs text-purple-400">Uploading…</p>
      )}
    </div>
  );
}
